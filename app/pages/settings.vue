<script setup lang="ts">
import type { AppSettingsDto } from '../../shared/types/api'
import { backupSchema } from '../../shared/schemas/trackfit'

const store = useTrackFitData()
await store.ensureLoaded()
const { t, locale } = useI18n()
const { formatDateTime, formatError } = useTrackFitI18n()
const colorMode = useColorMode()
const heightCm = ref<number | null>(store.settings.value.heightCm)
const desiredWeightMinimum = ref<number | ''>(store.settings.value.desiredWeightMinimum ?? '')
const desiredWeightMaximum = ref<number | ''>(store.settings.value.desiredWeightMaximum ?? '')
const defaultDateRange = ref<AppSettingsDto['defaultDateRange']>(store.settings.value.defaultDateRange)
const sleepGoalHours = ref(store.settings.value.sleepGoalHours)
const weeklyTrainingGoalMinutes = ref(store.settings.value.weeklyTrainingGoalMinutes)
const theme = ref<AppSettingsDto['theme']>(store.settings.value.theme)
const saving = ref(false)
const message = ref('')
const restoreInput = ref<HTMLInputElement>()
const counts = computed(() => ({
  metrics: store.data.value?.metrics.length ?? 0,
  bodyRecords: store.data.value?.bodyRecords.length ?? 0,
  values: store.data.value?.bodyRecords.reduce((total, record) => total + record.values.length, 0) ?? 0,
}))

async function save() {
  if (heightCm.value == null) {
    message.value = t('settings.validation.height')
    return
  }
  const hasMinimum = desiredWeightMinimum.value !== ''
  const hasMaximum = desiredWeightMaximum.value !== ''
  if (hasMinimum !== hasMaximum) {
    message.value = t('settings.validation.weightPair')
    return
  }
  if (hasMinimum && hasMaximum && desiredWeightMinimum.value >= desiredWeightMaximum.value) {
    message.value = t('settings.validation.weightOrder')
    return
  }
  saving.value = true
  try {
    await store.saveSettings({
      heightCm: heightCm.value,
      desiredWeightMinimum: desiredWeightMinimum.value === '' ? null : desiredWeightMinimum.value,
      desiredWeightMaximum: desiredWeightMaximum.value === '' ? null : desiredWeightMaximum.value,
      defaultDateRange: defaultDateRange.value,
      sleepGoalHours: sleepGoalHours.value,
      weeklyTrainingGoalMinutes: weeklyTrainingGoalMinutes.value,
      theme: theme.value,
    })
    colorMode.preference = theme.value
    message.value = t('settings.saved')
  } catch (error) {
    message.value = formatError(error)
  } finally {
    saving.value = false
  }
}

async function restore(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!window.confirm(t('settings.restoreConfirm'))) return
  try {
    const backup = backupSchema.parse(JSON.parse(await file.text()))
    await store.restore(backup)
    message.value = t('settings.restoreComplete')
  } catch (error) {
    message.value = t('settings.restoreFailed', { message: formatError(error) })
  } finally {
    if (restoreInput.value) restoreInput.value.value = ''
  }
}

function downloadJson() {
  downloadFile(store.exportJson(), 'trackfit-backup.json', 'application/json;charset=utf-8')
}

function downloadCsv() {
  downloadFile(store.exportCsv(locale.value as 'zh' | 'en'), 'trackfit-measurements.csv', 'text/csv;charset=utf-8')
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
    <PageHeader :title="t('pages.settings.title')" :description="t('pages.settings.description')" />
    <p v-if="!store.canWrite.value" class="mb-5 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{{ t('settings.readOnlyNotice') }}</p>

    <div class="grid gap-6 xl:grid-cols-2">
      <form class="app-card rounded-3xl p-5 sm:p-6" @submit.prevent="save">
        <h2 class="font-bold">{{ t('settings.personal') }}</h2><p class="mt-1 text-xs text-muted">{{ t('settings.personalHint') }}</p>
        <div class="mt-6 space-y-5">
          <label class="block text-sm">{{ t('settings.height') }}<input v-model.number="heightCm" :disabled="!store.canWrite.value" required type="number" min="80" max="250" step="0.1" class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3 disabled:opacity-60"></label>
          <fieldset class="rounded-2xl border border-default p-4">
            <legend class="px-2 text-sm font-medium">{{ t('settings.weightTarget') }}</legend>
            <p class="mb-3 text-xs text-muted">{{ t('settings.weightTargetHint') }}</p>
            <div class="grid grid-cols-2 gap-3">
              <label class="text-xs text-muted">{{ t('settings.minimum') }}<input v-model.number="desiredWeightMinimum" :disabled="!store.canWrite.value" type="number" min="20" max="400" step="0.1" :placeholder="t('settings.minimumExample')" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted disabled:opacity-60"></label>
              <label class="text-xs text-muted">{{ t('settings.maximum') }}<input v-model.number="desiredWeightMaximum" :disabled="!store.canWrite.value" type="number" min="20" max="400" step="0.1" :placeholder="t('settings.maximumExample')" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted disabled:opacity-60"></label>
            </div>
          </fieldset>
          <fieldset class="rounded-2xl border border-default p-4">
            <legend class="px-2 text-sm font-medium">{{ t('settings.behaviorGoals') }}</legend>
            <p class="mb-3 text-xs text-muted">{{ t('settings.behaviorGoalsHint') }}</p>
            <div class="grid grid-cols-2 gap-3">
              <label class="text-xs text-muted">{{ t('settings.dailySleep') }}<input v-model.number="sleepGoalHours" :disabled="!store.canWrite.value" required type="number" min="1" max="16" step="0.5" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted disabled:opacity-60"></label>
              <label class="text-xs text-muted">{{ t('settings.weeklyTraining') }}<input v-model.number="weeklyTrainingGoalMinutes" :disabled="!store.canWrite.value" required type="number" min="0" max="10080" step="5" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted disabled:opacity-60"></label>
            </div>
          </fieldset>
          <label class="block text-sm">{{ t('settings.defaultRange') }}<select v-model="defaultDateRange" :disabled="!store.canWrite.value" class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3 disabled:opacity-60"><option value="24h">{{ t('range.24h') }}</option><option value="7d">{{ t('range.7d') }}</option><option value="30d">{{ t('range.30d') }}</option><option value="90d">{{ t('range.90d') }}</option><option value="all">{{ t('range.all') }}</option></select></label>
          <label class="block text-sm">{{ t('settings.theme') }}<select v-model="theme" :disabled="!store.canWrite.value" class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3 disabled:opacity-60"><option value="system">{{ t('settings.themeSystem') }}</option><option value="light">{{ t('settings.themeLight') }}</option><option value="dark">{{ t('settings.themeDark') }}</option></select></label>
        </div>
        <button v-if="store.canWrite.value" :disabled="saving" class="mt-6 w-full rounded-xl bg-primary px-5 py-3 font-semibold text-white">{{ t(saving ? 'common.saving' : 'settings.save') }}</button>
      </form>

      <section v-if="store.canWrite.value" class="app-card rounded-3xl p-5 sm:p-6">
        <h2 class="font-bold">{{ t('settings.backup') }}</h2><p class="mt-1 text-xs text-muted">{{ t('settings.backupHint') }}</p>
        <div class="mt-6 grid gap-3">
          <button type="button" class="rounded-xl border border-default px-4 py-3 text-center text-sm font-medium hover:bg-elevated" @click="downloadJson">{{ t('settings.downloadJson') }}</button>
          <button type="button" class="rounded-xl border border-default px-4 py-3 text-center text-sm font-medium hover:bg-elevated" @click="downloadCsv">{{ t('settings.exportMeasurements') }}</button>
          <button type="button" class="rounded-xl border border-default px-4 py-3 text-center text-sm font-medium hover:bg-elevated" @click="downloadFile(store.exportTrainingCsv(locale as 'zh' | 'en'), 'trackfit-training.csv', 'text/csv;charset=utf-8')">{{ t('settings.exportTraining') }}</button>
          <button type="button" class="rounded-xl border border-default px-4 py-3 text-center text-sm font-medium hover:bg-elevated" @click="downloadFile(store.exportSleepCsv(locale as 'zh' | 'en'), 'trackfit-sleep.csv', 'text/csv;charset=utf-8')">{{ t('settings.exportSleep') }}</button>
          <button type="button" class="rounded-xl border border-error/30 px-4 py-3 text-sm font-medium text-error hover:bg-error/5" @click="restoreInput?.click()">{{ t('settings.restoreJson') }}</button>
          <input ref="restoreInput" type="file" accept="application/json,.json" class="hidden" @change="restore">
        </div>
        <p class="mt-4 text-xs leading-5 text-muted">{{ t('settings.restoreHint') }}</p>
      </section>

      <section class="app-card rounded-3xl p-5 sm:p-6 xl:col-span-2">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 class="font-bold">{{ t('settings.status') }}</h2><p class="mt-1 text-xs text-muted">{{ t('settings.statusHint') }}</p></div><button class="rounded-xl border border-default px-4 py-2 text-sm" @click="store.refresh(true)">{{ t('settings.recheck') }}</button></div>
        <div class="mt-5 grid gap-3 sm:grid-cols-4">
          <div class="rounded-2xl bg-elevated p-4"><p class="text-xs text-muted">{{ t('settings.storagePermission') }}</p><strong class="mt-1 block" :class="store.writable.value ? 'text-primary' : 'text-warning'">{{ t(store.writable.value ? 'settings.writable' : 'settings.readOnly') }}</strong></div>
          <div class="rounded-2xl bg-elevated p-4"><p class="text-xs text-muted">{{ t('settings.lastUpdated') }}</p><strong class="mt-1 block text-sm">{{ store.data.value ? formatDateTime(store.data.value.exportedAt) : '—' }}</strong></div>
          <div class="rounded-2xl bg-elevated p-4"><p class="text-xs text-muted">{{ t('settings.dataSize') }}</p><strong class="mt-1 block text-sm">{{ t('settings.dataSizeValue', counts) }}</strong></div>
          <div class="rounded-2xl bg-elevated p-4"><p class="text-xs text-muted">{{ t('settings.conflicts') }}</p><strong class="mt-1 block text-sm" :class="store.conflictCount.value ? 'text-warning' : 'text-primary'">{{ t('settings.conflictCount', { count: store.conflictCount.value }) }}</strong></div>
        </div>
      </section>
    </div>
    <p v-if="message" class="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-sm text-white shadow-xl lg:bottom-6">{{ message }}</p>
  </div>
</template>
