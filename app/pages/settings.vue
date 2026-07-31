<script setup lang="ts">
import type { AppSettingsDto } from '../../shared/types/api'

interface HealthDto { status: string, version: string, expectedVersion: string, versionMatched: boolean }
const { data: settings, refresh } = await useFetch<AppSettingsDto>('/api/settings')
const { data: health, refresh: refreshHealth } = await useFetch<HealthDto>('/api/health')
const colorMode = useColorMode()
const heightCm = ref<number | null>(null)
const defaultDateRange = ref<AppSettingsDto['defaultDateRange']>('30d')
const theme = ref<AppSettingsDto['theme']>('system')
const saving = ref(false)
const message = ref('')
const restoreInput = ref<HTMLInputElement>()

watch(settings, (value) => {
  if (!value) return
  heightCm.value = value.heightCm
  defaultDateRange.value = value.defaultDateRange
  theme.value = value.theme
}, { immediate: true })

async function save() {
  if (heightCm.value == null) {
    message.value = '请填写身高'
    return
  }
  saving.value = true
  try {
    await $fetch('/api/settings', { method: 'PUT', body: { heightCm: heightCm.value, defaultDateRange: defaultDateRange.value, theme: theme.value } })
    colorMode.preference = theme.value
    message.value = '设置已保存'
    await refresh()
  } catch {
    message.value = '保存失败'
  } finally {
    saving.value = false
  }
}

async function restore(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!window.confirm('恢复备份会替换当前全部数据，确认继续？')) return
  try {
    const backup = JSON.parse(await file.text())
    await $fetch('/api/backup/restore', { method: 'POST', body: backup })
    message.value = '备份恢复完成'
    await Promise.all([refresh(), refreshHealth()])
  } catch {
    message.value = '备份文件无效或恢复失败，当前数据未被部分覆盖'
  } finally {
    if (restoreInput.value) restoreInput.value.value = ''
  }
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
          <label class="block text-sm">默认分析范围<select v-model="defaultDateRange" class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3"><option value="24h">24 小时</option><option value="7d">7 天</option><option value="30d">30 天</option><option value="90d">90 天</option><option value="all">全部</option></select></label>
          <label class="block text-sm">界面主题<select v-model="theme" class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label>
        </div>
        <button :disabled="saving" class="mt-6 w-full rounded-xl bg-primary px-5 py-3 font-semibold text-white">{{ saving ? '保存中…' : '保存设置' }}</button>
      </form>

      <section class="app-card rounded-3xl p-5 sm:p-6">
        <h2 class="font-bold">数据备份</h2><p class="mt-1 text-xs text-muted">JSON 可完整恢复，CSV 适合在表格软件中查看</p>
        <div class="mt-6 grid gap-3">
          <a href="/api/backup" download class="rounded-xl border border-default px-4 py-3 text-center text-sm font-medium hover:bg-elevated">下载 JSON 全量备份</a>
          <a href="/api/export/csv" download class="rounded-xl border border-default px-4 py-3 text-center text-sm font-medium hover:bg-elevated">导出 CSV 测量明细</a>
          <button type="button" class="rounded-xl border border-error/30 px-4 py-3 text-sm font-medium text-error hover:bg-error/5" @click="restoreInput?.click()">从 JSON 恢复数据</button>
          <input ref="restoreInput" type="file" accept="application/json,.json" class="hidden" @change="restore">
        </div>
        <p class="mt-4 text-xs leading-5 text-muted">恢复操作会先完整校验文件，再在一个数据库事务中替换现有数据</p>
      </section>

      <section class="app-card rounded-3xl p-5 sm:p-6 xl:col-span-2">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 class="font-bold">运行状态</h2><p class="mt-1 text-xs text-muted">应用通过 Nitro 服务端访问 MySQL，浏览器不会获得数据库凭据</p></div><button class="rounded-xl border border-default px-4 py-2 text-sm" @click="() => refreshHealth()">重新检测</button></div>
        <div class="mt-5 grid gap-3 sm:grid-cols-3"><div class="rounded-2xl bg-elevated p-4"><p class="text-xs text-muted">数据库连接</p><strong class="mt-1 block" :class="health?.status === 'ok' ? 'text-primary' : 'text-error'">{{ health?.status === 'ok' ? '正常' : '异常' }}</strong></div><div class="rounded-2xl bg-elevated p-4"><p class="text-xs text-muted">MySQL 版本</p><strong class="mt-1 block">{{ health?.version ?? '—' }}</strong></div><div class="rounded-2xl bg-elevated p-4"><p class="text-xs text-muted">预期版本</p><strong class="mt-1 block" :class="health?.versionMatched ? 'text-primary' : 'text-warning'">8.0.32 {{ health?.versionMatched ? '已匹配' : '不匹配' }}</strong></div></div>
      </section>
    </div>
    <p v-if="message" class="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-sm text-white shadow-xl lg:bottom-6">{{ message }}</p>
  </div>
</template>
