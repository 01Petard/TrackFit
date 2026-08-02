<script setup lang="ts">
import type { AppSettingsDto } from '../../shared/types/api'
import { backupSchema } from '../../shared/schemas/trackfit'

const store = useTrackFitData()
await store.ensureLoaded()
const colorMode = useColorMode()
const heightCm = ref<number | null>(store.settings.value.heightCm)
const desiredWeightMinimum = ref<number | ''>(store.settings.value.desiredWeightMinimum ?? '')
const desiredWeightMaximum = ref<number | ''>(store.settings.value.desiredWeightMaximum ?? '')
const defaultDateRange = ref<AppSettingsDto['defaultDateRange']>(store.settings.value.defaultDateRange)
const theme = ref<AppSettingsDto['theme']>(store.settings.value.theme)
const saving = ref(false)
const message = ref('')
const restoreInput = ref<HTMLInputElement>()
const counts = computed(() => ({
  metrics: store.data.value?.metrics.length ?? 0,
  sessions: store.data.value?.sessions.length ?? 0,
  values: store.data.value?.values.length ?? 0,
}))

async function save() {
  if (heightCm.value == null) {
    message.value = '请填写身高'
    return
  }
  const hasMinimum = desiredWeightMinimum.value !== ''
  const hasMaximum = desiredWeightMaximum.value !== ''
  if (hasMinimum !== hasMaximum) {
    message.value = '目标体重上下限必须同时填写'
    return
  }
  if (hasMinimum && hasMaximum && desiredWeightMinimum.value >= desiredWeightMaximum.value) {
    message.value = '目标体重下限必须小于上限'
    return
  }
  saving.value = true
  try {
    await store.saveSettings({
      heightCm: heightCm.value,
      desiredWeightMinimum: desiredWeightMinimum.value === '' ? null : desiredWeightMinimum.value,
      desiredWeightMaximum: desiredWeightMaximum.value === '' ? null : desiredWeightMaximum.value,
      defaultDateRange: defaultDateRange.value,
      theme: theme.value,
    })
    colorMode.preference = theme.value
    message.value = '设置已保存'
  } catch (error) {
    message.value = getTrackFitErrorMessage(error)
  } finally {
    saving.value = false
  }
}

async function restore(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!window.confirm('恢复备份会替换当前全部数据，确认继续？')) return
  try {
    const backup = backupSchema.parse(JSON.parse(await file.text()))
    await store.restore(backup)
    message.value = '备份恢复完成'
  } catch (error) {
    message.value = `恢复失败：${getTrackFitErrorMessage(error)}`
  } finally {
    if (restoreInput.value) restoreInput.value.value = ''
  }
}

function downloadJson() {
  downloadFile(store.exportJson(), 'trackfit-backup.json', 'application/json;charset=utf-8')
}

function downloadCsv() {
  downloadFile(store.exportCsv(), 'trackfit-measurements.csv', 'text/csv;charset=utf-8')
}

function downloadFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div>
    <PageHeader title="系统设置" description="配置身体基础信息，管理本地数据备份与运行状态" />

    <div class="grid gap-6 xl:grid-cols-2">
      <form class="app-card rounded-3xl p-5 sm:p-6" @submit.prevent="save">
        <h2 class="font-bold">个人与显示</h2><p class="mt-1 text-xs text-muted">身高用于计算 BMI，并在每次测量时保存快照</p>
        <div class="mt-6 space-y-5">
          <label class="block text-sm">身高（cm）<input v-model.number="heightCm" required type="number" min="80" max="250" step="0.1" class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3"></label>
          <fieldset class="rounded-2xl border border-default p-4">
            <legend class="px-2 text-sm font-medium">个人目标体重（kg）</legend>
            <p class="mb-3 text-xs text-muted">两个值需同时填写；保存后会在体重图表中显示目标区间</p>
            <div class="grid grid-cols-2 gap-3">
              <label class="text-xs text-muted">合适下限<input v-model.number="desiredWeightMinimum" type="number" min="20" max="400" step="0.1" placeholder="例如 60" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"></label>
              <label class="text-xs text-muted">最胖上限<input v-model.number="desiredWeightMaximum" type="number" min="20" max="400" step="0.1" placeholder="例如 75" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"></label>
            </div>
          </fieldset>
          <label class="block text-sm">默认分析范围<select v-model="defaultDateRange" class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3"><option value="24h">24 小时</option><option value="7d">7 天</option><option value="30d">30 天</option><option value="90d">90 天</option><option value="all">全部</option></select></label>
          <label class="block text-sm">界面主题<select v-model="theme" class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label>
        </div>
        <button :disabled="saving" class="mt-6 w-full rounded-xl bg-primary px-5 py-3 font-semibold text-white">{{ saving ? '保存中…' : '保存设置' }}</button>
      </form>

      <section class="app-card rounded-3xl p-5 sm:p-6">
        <h2 class="font-bold">数据备份</h2><p class="mt-1 text-xs text-muted">JSON 可完整恢复，CSV 适合在表格软件中查看</p>
        <div class="mt-6 grid gap-3">
          <button type="button" class="rounded-xl border border-default px-4 py-3 text-center text-sm font-medium hover:bg-elevated" @click="downloadJson">下载 JSON 全量备份</button>
          <button type="button" class="rounded-xl border border-default px-4 py-3 text-center text-sm font-medium hover:bg-elevated" @click="downloadCsv">导出 CSV 测量明细</button>
          <button type="button" class="rounded-xl border border-error/30 px-4 py-3 text-sm font-medium text-error hover:bg-error/5" @click="restoreInput?.click()">从 JSON 恢复数据</button>
          <input ref="restoreInput" type="file" accept="application/json,.json" class="hidden" @change="restore">
        </div>
        <p class="mt-4 text-xs leading-5 text-muted">恢复操作会先完整校验，再原子替换部署机器上的数据文件</p>
      </section>

      <section class="app-card rounded-3xl p-5 sm:p-6 xl:col-span-2">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 class="font-bold">数据文件状态</h2><p class="mt-1 text-xs text-muted">业务计算由浏览器完成，服务端只负责原子读写 JSON 文件</p></div><button class="rounded-xl border border-default px-4 py-2 text-sm" @click="store.refresh(true)">重新检测</button></div>
        <div class="mt-5 grid gap-3 sm:grid-cols-4">
          <div class="rounded-2xl bg-elevated p-4"><p class="text-xs text-muted">文件读写</p><strong class="mt-1 block" :class="store.writable.value ? 'text-primary' : 'text-error'">{{ store.writable.value ? '正常' : '异常' }}</strong></div>
          <div class="rounded-2xl bg-elevated p-4"><p class="text-xs text-muted">最后更新</p><strong class="mt-1 block text-sm">{{ store.data.value ? new Date(store.data.value.exportedAt).toLocaleString() : '—' }}</strong></div>
          <div class="rounded-2xl bg-elevated p-4"><p class="text-xs text-muted">数据规模</p><strong class="mt-1 block text-sm">{{ counts.metrics }} 指标 / {{ counts.sessions }} 记录 / {{ counts.values }} 数值</strong></div>
          <div class="rounded-2xl bg-elevated p-4"><p class="text-xs text-muted">同步冲突</p><strong class="mt-1 block text-sm" :class="store.conflictCount.value ? 'text-warning' : 'text-primary'">{{ store.conflictCount.value }} 次</strong></div>
        </div>
      </section>
    </div>
    <p v-if="message" class="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-sm text-white shadow-xl lg:bottom-6">{{ message }}</p>
  </div>
</template>
