<script setup lang="ts">
import type { MetricDefinitionDto } from '../../shared/types/api'

const store = useTrackFitData()
await store.ensureLoaded()
const metrics = store.metrics
const showCreate = ref(false)
const saving = ref(false)
const savingMetricId = ref<number | null>(null)
const editingId = ref<number | null>(null)
const message = ref('')
const form = reactive({ name: '', code: '', unit: '', decimalPlaces: 1, minimumValue: '', maximumValue: '' })
const drafts = reactive<Record<number, { name: string, unit: string }>>({})

watch(metrics, (items) => {
  for (const metric of items) {
    if (!drafts[metric.id]) drafts[metric.id] = { name: metric.name, unit: metric.unit }
  }
}, { immediate: true })

async function createMetric() {
  saving.value = true
  message.value = ''
  try {
    await store.createMetric({
      name: form.name,
      code: form.code,
      unit: form.unit,
      decimalPlaces: form.decimalPlaces,
      minimumValue: form.minimumValue === '' ? null : Number(form.minimumValue),
      maximumValue: form.maximumValue === '' ? null : Number(form.maximumValue),
      sortOrder: 100 + metrics.value.length,
    })
    Object.assign(form, { name: '', code: '', unit: '', decimalPlaces: 1, minimumValue: '', maximumValue: '' })
    showCreate.value = false
  } catch (error) {
    message.value = getMessage(error)
  } finally {
    saving.value = false
  }
}

async function updateMetric(metric: MetricDefinitionDto, patch: Record<string, unknown>) {
  message.value = ''
  savingMetricId.value = metric.id
  try {
    await store.updateMetric(metric.id, patch)
    return true
  } catch (error) {
    message.value = getMessage(error)
    return false
  } finally {
    savingMetricId.value = null
  }
}

async function saveCustom(metric: MetricDefinitionDto) {
  const draft = drafts[metric.id]
  if (!draft) return
  if (await updateMetric(metric, { name: draft.name, unit: draft.unit })) editingId.value = null
}

function beginEdit(metric: MetricDefinitionDto) {
  drafts[metric.id] = { name: metric.name, unit: metric.unit }
  editingId.value = metric.id
}

function cancelEdit(metric: MetricDefinitionDto) {
  drafts[metric.id] = { name: metric.name, unit: metric.unit }
  editingId.value = null
}

function isDirty(metric: MetricDefinitionDto) {
  const draft = drafts[metric.id]
  return draft?.name.trim() !== metric.name || draft?.unit.trim() !== metric.unit
}

const getMessage = getTrackFitErrorMessage
</script>

<template>
  <div>
    <PageHeader title="指标管理" description="核心指标保持统一口径，也可以增加自己的数值指标">
      <button v-if="store.canWrite.value" class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/15 transition hover:bg-primary/90 sm:w-auto" @click="showCreate = !showCreate">
        <AppIcon :name="showCreate ? 'close' : 'plus'" class="size-[18px]" />
        {{ showCreate ? '收起表单' : '新增指标' }}
      </button>
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
      <div class="mt-5 flex justify-end gap-3"><button type="button" class="rounded-xl border border-default px-4 py-2.5 text-sm font-medium transition hover:bg-elevated" @click="showCreate = false">取消</button><button :disabled="saving" class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><AppIcon name="save" class="size-4" />{{ saving ? '保存中…' : '保存指标' }}</button></div>
    </form>

    <p v-if="message" class="mb-4 rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{{ message }}</p>

    <section class="app-card overflow-hidden rounded-3xl">
      <div class="border-b border-default px-5 py-4"><h2 class="font-bold">全部指标</h2><p class="mt-1 text-xs text-muted">已有数据的指标仅允许停用，不做物理删除</p></div>
      <div class="divide-y divide-default">
        <article v-for="metric in metrics" :key="metric.id" class="grid gap-4 p-5 lg:grid-cols-[minmax(230px,1fr)_minmax(260px,1fr)_auto] lg:items-center">
          <div>
            <div class="flex items-center gap-2"><strong>{{ metric.name }}</strong><span class="rounded-full px-2 py-0.5 text-[10px]" :class="metric.metricType === 'core' ? 'bg-primary/10 text-primary' : 'bg-elevated text-muted'">{{ metric.metricType === 'core' ? '核心' : '自定义' }}</span></div>
            <p class="mt-1 text-xs text-muted">{{ metric.code }} · {{ metric.unit }} · {{ metric.decimalPlaces }} 位小数<span v-if="metric.minimumValue != null || metric.maximumValue != null"> · {{ metric.minimumValue ?? '不限' }}–{{ metric.maximumValue ?? '不限' }}</span></p>
          </div>
          <div v-if="metric.metricType === 'custom' && editingId === metric.id && drafts[metric.id]" class="grid grid-cols-2 gap-2">
            <label class="text-[11px] text-muted">名称<input v-model="drafts[metric.id]!.name" maxlength="40" class="mt-1 w-full rounded-lg border border-primary/40 bg-default px-3 py-2 text-sm outline-none focus:border-primary"></label>
            <label class="text-[11px] text-muted">单位<input v-model="drafts[metric.id]!.unit" maxlength="12" class="mt-1 w-full rounded-lg border border-primary/40 bg-default px-3 py-2 text-sm outline-none focus:border-primary"></label>
          </div>
          <div v-else class="text-xs text-muted">{{ metric.metricType === 'core' ? '核心指标名称与单位固定' : '点击编辑后修改名称和单位' }}</div>
          <div class="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
            <div v-if="store.canWrite.value && metric.metricType === 'custom'" class="flex gap-2">
              <template v-if="editingId === metric.id">
                <button class="rounded-lg border border-default px-3 py-2 text-xs font-medium transition hover:bg-elevated" @click="cancelEdit(metric)">取消</button>
                <button :disabled="!isDirty(metric) || savingMetricId === metric.id" class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" @click="saveCustom(metric)"><AppIcon name="save" class="size-3.5" />保存</button>
              </template>
              <button v-else class="inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-2 text-xs font-medium transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary" @click="beginEdit(metric)"><AppIcon name="edit" class="size-3.5" />编辑</button>
            </div>
            <button v-if="store.canWrite.value" type="button" role="switch" :aria-checked="metric.enabled" :disabled="savingMetricId === metric.id" class="inline-flex items-center gap-2.5 rounded-lg px-1 py-1 text-sm disabled:opacity-50" @click="updateMetric(metric, { enabled: !metric.enabled })">
              <span class="relative h-6 w-11 rounded-full transition" :class="metric.enabled ? 'bg-primary' : 'bg-muted/25'"><span class="absolute top-1 size-4 rounded-full bg-white shadow-sm transition-all" :class="metric.enabled ? 'left-6' : 'left-1'" /></span>
              <span :class="metric.enabled ? 'text-highlighted' : 'text-muted'">{{ metric.enabled ? '已启用' : '已停用' }}</span>
            </button>
            <span v-else class="rounded-lg bg-elevated px-3 py-2 text-xs text-muted">{{ metric.enabled ? '已启用' : '已停用' }}</span>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
