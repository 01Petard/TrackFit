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
const sleepGoalMinutes = ref(Math.round(store.settings.value.sleepGoalHours * 60))
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
      sleepGoalHours: sleepGoalMinutes.value / 60,
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

function updateSleepGoalHours(hours: number) {
  sleepGoalMinutes.value = hours >= 16 ? 16 * 60 : hours * 60 + sleepGoalMinutes.value % 60
}

function updateSleepGoalMinutes(minutes: number) {
  sleepGoalMinutes.value = Math.min(16 * 60, Math.floor(sleepGoalMinutes.value / 60) * 60 + minutes)
}
</script>

<template>
  <div>
    <PageHeader :title="t('pages.settings.title')" :description="t('pages.settings.description')" />
    <p v-if="!store.canWrite.value" class="mb-5 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{{ t('settings.readOnlyNotice') }}</p>

    <div class="grid gap-6 xl:grid-cols-2">
      <form class="app-card rounded-2xl p-5 sm:p-6" :class="!store.canWrite.value ? 'xl:col-span-2' : ''" @submit.prevent="save">
        <div class="app-section-heading"><span class="app-icon-tile"><AppIcon name="user" class="size-6" /></span><div><h2>{{ t('settings.personal') }}</h2><p>{{ t('settings.personalHint') }}</p></div></div>
        <div class="mt-6 space-y-5">
          <AppNumberField v-model.number="heightCm" :label="t('settings.height')" required :min="80" :max="250" :step="0.1" :disabled="!store.canWrite.value" :suggestions="[155, 160, 165, 170, 175]" />
          <fieldset class="app-inner-card p-4">
            <legend class="px-2 text-sm font-medium">{{ t('settings.weightTarget') }}</legend>
            <p class="mb-3 text-xs text-muted">{{ t('settings.weightTargetHint') }}</p>
            <div class="grid grid-cols-2 gap-3">
              <AppNumberField v-model.number="desiredWeightMinimum" :label="t('settings.minimum')" :min="20" :max="400" :step="0.1" :placeholder="t('settings.minimumExample')" :disabled="!store.canWrite.value" :suggestions="[50, 55, 60, 65, 70]" />
              <AppNumberField v-model.number="desiredWeightMaximum" :label="t('settings.maximum')" :min="20" :max="400" :step="0.1" :placeholder="t('settings.maximumExample')" :disabled="!store.canWrite.value" :suggestions="[55, 60, 65, 70, 75]" />
            </div>
          </fieldset>
          <fieldset class="app-inner-card p-4">
            <legend class="px-2 text-sm font-medium">{{ t('settings.behaviorGoals') }}</legend>
            <p class="mb-3 text-xs text-muted">{{ t('settings.behaviorGoalsHint') }}</p>
            <div class="grid gap-4">
              <div class="min-w-0">
                <p class="mb-2 text-sm">{{ t('settings.dailySleep') }}</p>
                <div class="grid grid-cols-2 gap-3">
                  <AppNumberField :model-value="Math.floor(sleepGoalMinutes / 60)" :label="t('date.hour')" unit="h" required :min="1" :max="16" :disabled="!store.canWrite.value" @update:model-value="updateSleepGoalHours(Number($event))" />
                  <AppNumberField :model-value="sleepGoalMinutes % 60" :label="t('date.minute')" unit="min" required :min="0" :max="sleepGoalMinutes >= 16 * 60 ? 0 : 55" :step="5" :disabled="!store.canWrite.value" @update:model-value="updateSleepGoalMinutes(Number($event))" />
                </div>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <button v-for="minutes in [360, 390, 420, 450, 480]" :key="minutes" type="button" class="app-quick-chip flex-1 px-2 text-xs" :aria-pressed="sleepGoalMinutes === minutes" :disabled="!store.canWrite.value" @click="sleepGoalMinutes = minutes">{{ Math.floor(minutes / 60) }} {{ t('date.hour') }}<template v-if="minutes % 60"> {{ minutes % 60 }} {{ t('date.minute') }}</template></button>
                </div>
              </div>
              <AppNumberField v-model.number="weeklyTrainingGoalMinutes" :label="t('settings.weeklyTraining')" unit="min" required :min="0" :max="10080" :step="5" duration-unit="minutes" :disabled="!store.canWrite.value" :suggestions="[30, 60, 90, 120, 150]" />
            </div>
          </fieldset>
          <label class="block text-sm">{{ t('settings.defaultRange') }}<select v-model="defaultDateRange" :disabled="!store.canWrite.value" class="app-select mt-2 w-full border border-default text-sm disabled:opacity-60"><option value="24h">{{ t('range.24h') }}</option><option value="7d">{{ t('range.7d') }}</option><option value="30d">{{ t('range.30d') }}</option><option value="90d">{{ t('range.90d') }}</option><option value="all">{{ t('range.all') }}</option></select></label>
          <label class="block text-sm">{{ t('settings.theme') }}<select v-model="theme" :disabled="!store.canWrite.value" class="app-select mt-2 w-full border border-default text-sm disabled:opacity-60"><option value="system">{{ t('settings.themeSystem') }}</option><option value="light">{{ t('settings.themeLight') }}</option><option value="dark">{{ t('settings.themeDark') }}</option></select></label>
        </div>
        <button v-if="store.canWrite.value" :disabled="saving" class="app-btn app-btn--primary mt-6 w-full"><AppIcon name="shield" class="size-4" />{{ t(saving ? 'common.saving' : 'settings.save') }}</button>
      </form>

      <section v-if="store.canWrite.value" class="app-card rounded-2xl p-5 sm:p-6">
        <div class="app-section-heading"><span class="app-icon-tile app-icon-tile--blue"><AppIcon name="database" class="size-6" /></span><div><h2>{{ t('settings.backup') }}</h2><p>{{ t('settings.backupHint') }}</p></div></div>
        <div class="mt-6 divide-y divide-default">
          <button type="button" class="flex w-full items-center gap-3 py-4 text-left hover:bg-elevated/60" @click="downloadJson"><span class="app-icon-tile"><AppIcon name="download" class="size-5" /></span><span class="flex-1"><strong class="block text-sm">{{ t('settings.downloadJson') }}</strong><span class="mt-1 block text-xs text-muted">{{ t('settings.backupHint') }}</span></span><AppIcon name="chevronRight" class="size-4 text-muted" /></button>
          <button type="button" class="flex w-full items-center gap-3 py-4 text-left hover:bg-elevated/60" @click="downloadCsv"><span class="app-icon-tile app-icon-tile--blue"><AppIcon name="file" class="size-5" /></span><span class="flex-1"><strong class="block text-sm">{{ t('settings.exportMeasurements') }}</strong><span class="mt-1 block text-xs text-muted">{{ t('settings.exportMeasurementsHint') }}</span></span><AppIcon name="chevronRight" class="size-4 text-muted" /></button>
          <button type="button" class="flex w-full items-center gap-3 py-4 text-left hover:bg-elevated/60" @click="downloadFile(store.exportTrainingCsv(locale as 'zh' | 'en'), 'trackfit-training.csv', 'text/csv;charset=utf-8')"><span class="app-icon-tile app-icon-tile--orange"><AppIcon name="dumbbell" class="size-5" /></span><span class="flex-1"><strong class="block text-sm">{{ t('settings.exportTraining') }}</strong><span class="mt-1 block text-xs text-muted">{{ t('settings.exportTrainingHint') }}</span></span><AppIcon name="chevronRight" class="size-4 text-muted" /></button>
          <button type="button" class="flex w-full items-center gap-3 py-4 text-left hover:bg-elevated/60" @click="downloadFile(store.exportSleepCsv(locale as 'zh' | 'en'), 'trackfit-sleep.csv', 'text/csv;charset=utf-8')"><span class="app-icon-tile app-icon-tile--purple"><AppIcon name="moon" class="size-5" /></span><span class="flex-1"><strong class="block text-sm">{{ t('settings.exportSleep') }}</strong><span class="mt-1 block text-xs text-muted">{{ t('settings.exportSleepHint') }}</span></span><AppIcon name="chevronRight" class="size-4 text-muted" /></button>
          <button type="button" class="mt-4 flex w-full items-center gap-3 rounded-xl border border-error/20 bg-error/5 px-4 py-4 text-left text-error hover:bg-error/10" @click="restoreInput?.click()"><span class="app-icon-tile app-icon-tile--red"><AppIcon name="upload" class="size-5" /></span><strong class="flex-1 text-sm">{{ t('settings.restoreJson') }}</strong><AppIcon name="chevronRight" class="size-4" /></button>
          <input ref="restoreInput" type="file" accept="application/json,.json" class="hidden" @change="restore">
        </div>
        <p class="mt-4 rounded-xl bg-error/5 px-3 py-2 text-xs leading-5 text-error">{{ t('settings.restoreHint') }}</p>
      </section>

      <section class="app-card rounded-2xl p-5 sm:p-6 xl:col-span-2">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div class="app-section-heading"><span class="app-icon-tile app-icon-tile--blue"><AppIcon name="shield" class="size-6" /></span><div><h2>{{ t('settings.status') }}</h2><p>{{ t('settings.statusHint') }}</p></div></div><button class="app-btn app-btn--secondary" @click="store.refresh(true)"><AppIcon name="refresh" class="size-4" />{{ t('settings.recheck') }}</button></div>
        <div class="mt-5 grid gap-3 sm:grid-cols-4">
          <div class="app-inner-card p-4"><span class="app-icon-tile"><AppIcon name="shield" class="size-5" /></span><p class="mt-3 text-xs text-muted">{{ t('settings.storagePermission') }}</p><strong class="mt-1 block" :class="store.writable.value ? 'text-primary' : 'text-warning'">{{ t(store.writable.value ? 'settings.writable' : 'settings.readOnly') }}</strong></div>
          <div class="app-inner-card p-4"><span class="app-icon-tile app-icon-tile--blue"><AppIcon name="refresh" class="size-5" /></span><p class="mt-3 text-xs text-muted">{{ t('settings.lastUpdated') }}</p><strong class="mt-1 block text-sm">{{ store.data.value ? formatDateTime(store.data.value.exportedAt) : '—' }}</strong></div>
          <div class="app-inner-card p-4"><span class="app-icon-tile app-icon-tile--purple"><AppIcon name="database" class="size-5" /></span><p class="mt-3 text-xs text-muted">{{ t('settings.dataSize') }}</p><strong class="mt-1 block text-sm">{{ t('settings.dataSizeValue', counts) }}</strong></div>
          <div class="app-inner-card p-4"><span class="app-icon-tile app-icon-tile--orange"><AppIcon name="link" class="size-5" /></span><p class="mt-3 text-xs text-muted">{{ t('settings.conflicts') }}</p><strong class="mt-1 block text-sm" :class="store.conflictCount.value ? 'text-warning' : 'text-primary'">{{ t('settings.conflictCount', { count: store.conflictCount.value }) }}</strong></div>
        </div>
      </section>
    </div>
    <p v-if="message" class="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-sm text-white shadow-xl lg:bottom-6">{{ message }}</p>
  </div>
</template>
