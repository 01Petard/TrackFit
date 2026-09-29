<script setup lang="ts">
import type { TrainingWrite } from '../../shared/schemas/trackfit'
import type { MakeupKind } from '../../shared/utils/makeup'
import dayjs from 'dayjs'

const props = defineProps<{ open: boolean, date: string | null, kind: MakeupKind }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const store = useTrackFitData()
const { t } = useI18n()
const { metricName, formatError, formatDateTime } = useTrackFitI18n()
const values = reactive<Record<number, string>>({})
const measurementDate = ref('')
const measurementTime = ref('08:00')
const trainingDate = ref('')
const trainingTime = ref('18:00')
const trainingType = ref<TrainingWrite['type']>('strength')
const trainingDuration = ref(30)
const bedtime = ref('')
const sleepHours = ref(8)
const sleepMinutes = ref(0)
const sleepQuality = ref(80)
const saving = ref(false)
const errorMessage = ref('')
const enabledMetrics = computed(() => store.metrics.value.filter(metric => metric.enabled && (props.kind === 'all' || metric.code === 'weight')))
const latestWeight = computed(() => {
  const metric = enabledMetrics.value.find(item => item.code === 'weight')
  return metric == null ? null : store.listMeasurements({ page: 1, pageSize: 1, metricId: metric.id }).items[0]?.values.find(value => value.metricId === metric.id)?.value ?? null
})
const trainingTypes = computed(() => ([
  { value: 'strength' as const, label: t('training.strength'), icon: 'dumbbell' as const },
  { value: 'cardio' as const, label: t('training.cardio'), icon: 'run' as const },
  { value: 'mobility' as const, label: t('training.mobility'), icon: 'stretch' as const },
]))
const wakeUpAt = computed(() => dayjs(bedtime.value).add(sleepHours.value * 60 + sleepMinutes.value, 'minute'))
const latestSelectableDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
const displayDate = computed(() => props.kind === 'weight' ? measurementDate.value : props.kind === 'training' ? trainingDate.value : props.date)

watch(sleepHours, (hours) => {
  if (hours >= 24) sleepMinutes.value = 0
})

watch(() => props.open, (open) => {
  if (!open || !props.date) return
  for (const key of Object.keys(values)) delete values[Number(key)]
  const weightMetric = enabledMetrics.value.find(metric => metric.code === 'weight')
  if (weightMetric && latestWeight.value != null) values[weightMetric.id] = String(latestWeight.value)
  measurementDate.value = props.date
  measurementTime.value = '08:00'
  trainingDate.value = props.date
  trainingTime.value = '18:00'
  trainingType.value = 'strength'
  trainingDuration.value = 30
  bedtime.value = dayjs(`${props.date}T07:00:00`).subtract(8, 'hour').format('YYYY-MM-DDTHH:mm:ss')
  sleepHours.value = 8
  sleepMinutes.value = 0
  sleepQuality.value = 80
  errorMessage.value = ''
})

async function save() {
  if (!props.date) return
  const date = props.kind === 'weight' ? measurementDate.value : props.kind === 'training' ? trainingDate.value : props.date
  if (!date) return
  const metricValues = Object.entries(values)
    .filter(([, value]) => value !== '')
    .map(([metricId, value]) => ({ metricId: Number(metricId), value: Number(value) }))
  if ((props.kind === 'all' || props.kind === 'weight') && !metricValues.length) {
    errorMessage.value = t('measurement.validation.oneMetric')
    return
  }
  if ((props.kind === 'all' || props.kind === 'sleep') && (!wakeUpAt.value.isValid() || wakeUpAt.value.format('YYYY-MM-DD') !== date)) {
    errorMessage.value = t('makeup.wakeDateMismatch')
    return
  }

  saving.value = true
  errorMessage.value = ''
  try {
    const measurement = { measuredAt: new Date(`${date}T${measurementTime.value}:00`), values: metricValues }
    const training = { type: trainingType.value, durationMinutes: trainingDuration.value }
    const trainingAt = new Date(`${date}T${trainingTime.value}:00`)
    const sleep = { fellAsleepAt: new Date(bedtime.value), durationMinutes: sleepHours.value * 60 + sleepMinutes.value, quality: sleepQuality.value }
    if (props.kind === 'all') await store.saveMakeupDay({ date, measurement, training, trainingAt, sleep })
    else if (props.kind === 'weight') await store.saveSingleMakeupDay({ kind: 'weight', date, measurement })
    else if (props.kind === 'training') await store.saveSingleMakeupDay({ kind: 'training', date, training, trainingAt })
    else await store.saveSingleMakeupDay({ kind: 'sleep', date, sleep })
    emit('update:open', false)
  } catch (error) {
    errorMessage.value = formatError(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open && date" class="fixed inset-0 z-50 grid items-end bg-slate-950/50 backdrop-blur-sm sm:place-items-center sm:p-4" @click.self="emit('update:open', false)">
      <section role="dialog" aria-modal="true" aria-labelledby="makeup-title" class="app-card max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-default p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-7">
        <header class="mb-5 flex items-start justify-between gap-4">
          <div class="flex items-center gap-3"><span class="app-icon-tile"><AppIcon name="calendar" class="size-6" /></span><div><h2 id="makeup-title" class="text-xl font-bold">{{ t(kind === 'all' ? 'makeup.title' : 'makeup.singleTitle', { date: displayDate, kind: t(kind === 'weight' ? 'metrics.weight' : kind === 'sleep' ? 'common.sleep' : 'common.training') }) }}</h2><p class="mt-1 text-sm text-muted">{{ t(kind === 'all' ? 'makeup.description' : 'makeup.singleDescription') }}</p></div></div>
          <button type="button" class="grid size-9 shrink-0 place-items-center rounded-full bg-elevated text-muted hover:text-highlighted" :aria-label="t('common.closeNamed', { name: t(kind === 'all' ? 'makeup.name' : 'makeup.singleName') })" @click="emit('update:open', false)">×</button>
        </header>

        <form class="space-y-5" @submit.prevent="save">
          <section v-if="kind === 'all' || kind === 'weight'" class="rounded-2xl border border-default p-4">
            <h3 class="mb-3 flex items-center gap-2 font-semibold"><AppIcon name="weight" class="size-5 text-primary" />{{ t('makeup.body') }}</h3>
            <label v-if="kind === 'weight'" class="mb-4 block text-sm">{{ t('makeup.measurementDate') }}<input v-model="measurementDate" type="date" required :max="latestSelectableDate" class="app-select mt-2 w-full border border-default text-sm"></label>
            <label class="mb-4 block text-sm">{{ t('makeup.measurementTime') }}<input v-model="measurementTime" type="time" required class="app-select mt-2 w-full border border-default text-sm"></label>
            <div class="grid gap-4 sm:grid-cols-2">
              <AppNumberField v-for="metric in enabledMetrics" :key="metric.id" v-model="values[metric.id]" :label="metricName(metric)" :unit="metric.unit" :min="metric.minimumValue ?? undefined" :max="metric.maximumValue ?? undefined" :step="metric.code === 'weight' ? 0.01 : 10 ** -metric.decimalPlaces" />
            </div>
            <p class="mt-3 text-xs text-muted">{{ t('makeup.bodyHint') }}</p>
          </section>

          <section v-if="kind === 'all' || kind === 'sleep'" class="rounded-2xl border border-default p-4">
            <h3 class="mb-3 flex items-center gap-2 font-semibold"><AppIcon name="moon" class="size-5 text-primary" />{{ t('makeup.sleep') }}</h3>
            <p class="mb-2 text-sm">{{ t('behaviorDialog.bedtime') }}</p>
            <AppBedtimeField v-model="bedtime" />
            <div class="mt-4 grid grid-cols-2 gap-3">
              <AppNumberField v-model.number="sleepHours" :label="t('behaviorDialog.durationHoursField')" unit="h" required :min="0" :max="24" />
              <AppNumberField v-model.number="sleepMinutes" :label="t('behaviorDialog.durationMinutesField')" unit="min" required :min="0" :max="sleepHours === 24 ? 0 : 59" :step="5" input-step="any" />
            </div>
            <div class="mt-4"><AppNumberField v-model.number="sleepQuality" :label="t('behaviorDialog.sleepScore')" unit="/ 100" required :min="1" :max="100" /></div>
            <p class="mt-3 text-xs" :class="wakeUpAt.isValid() && wakeUpAt.format('YYYY-MM-DD') === date ? 'text-muted' : 'text-error'">{{ t('makeup.wakeTime', { time: wakeUpAt.isValid() ? formatDateTime(wakeUpAt.toDate()) : '—' }) }}</p>
          </section>

          <section v-if="kind === 'all' || kind === 'training'" class="rounded-2xl border border-default p-4">
            <h3 class="mb-3 flex items-center gap-2 font-semibold"><AppIcon name="dumbbell" class="size-5 text-primary" />{{ t('makeup.training') }}</h3>
            <label v-if="kind === 'training'" class="mb-4 block text-sm">{{ t('makeup.trainingDate') }}<input v-model="trainingDate" type="date" required :max="latestSelectableDate" class="app-select mt-2 w-full border border-default text-sm"></label>
            <label class="mb-4 block text-sm">{{ t('makeup.trainingTime') }}<input v-model="trainingTime" type="time" required class="app-select mt-2 w-full border border-default text-sm"></label>
            <div class="mb-4 grid grid-cols-3 gap-2"><button v-for="item in trainingTypes" :key="item.value" type="button" :aria-pressed="trainingType === item.value" class="flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-xs font-semibold" :class="trainingType === item.value ? 'border-primary/50 bg-primary/5 text-primary' : 'border-default text-muted'" @click="trainingType = item.value"><AppIcon :name="item.icon" class="size-5" />{{ item.label }}</button></div>
            <AppNumberField v-model.number="trainingDuration" :label="t('behaviorDialog.durationMinutes')" unit="min" required :min="1" :max="1440" duration-unit="minutes" />
          </section>

          <p v-if="errorMessage" role="alert" class="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{{ errorMessage }}</p>
          <div class="flex gap-3 border-t border-default pt-5"><button type="button" class="app-btn app-btn--secondary flex-1" @click="emit('update:open', false)">{{ t('common.cancel') }}</button><button type="submit" :disabled="saving" class="app-btn app-btn--primary flex-1"><AppIcon name="shield" class="size-4" />{{ t(saving ? 'common.saving' : kind === 'all' ? 'makeup.save' : 'common.saveRecord') }}</button></div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
