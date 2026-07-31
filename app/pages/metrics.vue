<script setup lang="ts">
import type { MetricDefinitionDto } from '../../shared/types/api'

const { data: metrics, refresh } = await useFetch<MetricDefinitionDto[]>('/api/metrics', { default: () => [] })
const showCreate = ref(false)
const saving = ref(false)
const message = ref('')
const form = reactive({ name: '', code: '', unit: '', decimalPlaces: 1, minimumValue: '', maximumValue: '' })
const drafts = reactive<Record<number, { name: string, unit: string }>>({})

watch(metrics, (items) => {
  for (const metric of items) drafts[metric.id] = { name: metric.name, unit: metric.unit }
}, { immediate: true })

async function createMetric() {
  saving.value = true
  message.value = ''
  try {
    await $fetch('/api/metrics', {
      method: 'POST',
      body: {
        name: form.name,
        code: form.code,
        unit: form.unit,
        decimalPlaces: form.decimalPlaces,
        minimumValue: form.minimumValue === '' ? null : Number(form.minimumValue),
        maximumValue: form.maximumValue === '' ? null : Number(form.maximumValue),
        sortOrder: 100 + metrics.value.length,
      },
    })
    Object.assign(form, { name: '', code: '', unit: '', decimalPlaces: 1, minimumValue: '', maximumValue: '' })
    showCreate.value = false
    await refresh()
  } catch (error) {
    message.value = getMessage(error)
  } finally {
    saving.value = false
  }
}

async function updateMetric(metric: MetricDefinitionDto, patch: Record<string, unknown>) {
  message.value = ''
  try {
    await $fetch(`/api/metrics/${metric.id}`, { method: 'PUT', body: patch })
    await refresh()
  } catch (error) {
    message.value = getMessage(error)
  }
}

async function saveCustom(metric: MetricDefinitionDto) {
  const draft = drafts[metric.id]
  if (!draft) return
  await updateMetric(metric, { name: draft.name, unit: draft.unit })
}

function getMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    return (error.data as { statusMessage?: string }).statusMessage ?? '操作失败'
  }
  return '操作失败'
}
</script>

<template>
  <div>
    <PageHeader title="指标管理" description="核心指标保持统一口径，也可以增加自己的数值指标">
      <button class="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white sm:w-auto" @click="showCreate = !showCreate">＋ 自定义指标</button>
    </PageHeader>

    <form v-if="showCreate" class="app-card mb-5 rounded-3xl p-5 sm:p-6" @submit.prevent="createMetric">
      <h2 class="mb-4 font-bold">新增自定义指标</h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label class="text-xs text-muted">指标名称<input v-model="form.name" required maxlength="40" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"></label>
        <label class="text-xs text-muted">指标编码<input v-model="form.code" required pattern="[a-z][a-z0-9_]+" placeholder="例如 visceral_fat" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"></label>
        <label class="text-xs text-muted">单位<input v-model="form.unit" required maxlength="12" placeholder="例如 level" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"></label>
        <label class="text-xs text-muted">小数位<select v-model.number="form.decimalPlaces" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"><option :value="0">0</option><option :value="1">1</option><option :value="2">2</option><option :value="3">3</option></select></label>
        <label class="text-xs text-muted">合理最小值<input v-model="form.minimumValue" type="number" step="any" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"></label>
        <label class="text-xs text-muted">合理最大值<input v-model="form.maximumValue" type="number" step="any" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"></label>
      </div>
      <div class="mt-5 flex justify-end gap-3"><button type="button" class="rounded-xl border border-default px-4 py-2.5 text-sm" @click="showCreate = false">取消</button><button :disabled="saving" class="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white">{{ saving ? '保存中…' : '保存指标' }}</button></div>
    </form>

    <p v-if="message" class="mb-4 rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{{ message }}</p>

    <section class="app-card overflow-hidden rounded-3xl">
      <div class="border-b border-default px-5 py-4"><h2 class="font-bold">全部指标</h2><p class="mt-1 text-xs text-muted">已有数据的指标仅允许停用，不做物理删除</p></div>
      <div class="divide-y divide-default">
        <article v-for="metric in metrics" :key="metric.id" class="grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
          <div>
            <div class="flex items-center gap-2"><strong>{{ metric.name }}</strong><span class="rounded-full px-2 py-0.5 text-[10px]" :class="metric.metricType === 'core' ? 'bg-primary/10 text-primary' : 'bg-elevated text-muted'">{{ metric.metricType === 'core' ? '核心' : '自定义' }}</span></div>
            <p class="mt-1 text-xs text-muted">{{ metric.code }} · {{ metric.unit }} · {{ metric.decimalPlaces }} 位小数<span v-if="metric.minimumValue != null || metric.maximumValue != null"> · {{ metric.minimumValue ?? '不限' }}–{{ metric.maximumValue ?? '不限' }}</span></p>
          </div>
          <div v-if="metric.metricType === 'custom' && drafts[metric.id]" class="grid grid-cols-2 gap-2"><input v-model="drafts[metric.id]!.name" class="rounded-lg border border-default bg-default px-2.5 py-2 text-sm"><input v-model="drafts[metric.id]!.unit" class="rounded-lg border border-default bg-default px-2.5 py-2 text-sm"></div><div v-else class="text-xs text-muted">核心指标名称与单位固定</div>
          <div class="flex items-center justify-end gap-3"><button v-if="metric.metricType === 'custom'" class="text-sm text-primary" @click="saveCustom(metric)">保存修改</button><label class="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" class="size-4 accent-emerald-500" :checked="metric.enabled" @change="updateMetric(metric, { enabled: ($event.target as HTMLInputElement).checked })">启用</label></div>
        </article>
      </div>
    </section>
  </div>
</template>

