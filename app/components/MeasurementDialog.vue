<script setup lang="ts">
import type { MeasurementDto } from '../../shared/types/api'
import dayjs from 'dayjs'

const props = defineProps<{
  open: boolean
  measurement?: MeasurementDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const store = useTrackFitData()
const { t } = useI18n()
const { metricName, formatError } = useTrackFitI18n()
await store.ensureLoaded()
const metrics = store.metrics
const measuredAt = ref('')
const note = ref('')
const values = reactive<Record<number, string>>({})
const saving = ref(false)
const errorMessage = ref('')

const enabledMetrics = computed(() => metrics.value.filter(metric => metric.enabled))
const weightMetric = computed(() => enabledMetrics.value.find(metric => metric.code === 'weight'))
const otherMetrics = computed(() => enabledMetrics.value.filter(metric => metric.code !== 'weight'))
const metricHistory = computed(() => {
  const history = new Map<number, number[]>()
  const records = [...(store.data.value?.bodyRecords ?? [])]
    .sort((a, b) => dayjs(b.measuredAt).valueOf() - dayjs(a.measuredAt).valueOf())
  for (const record of records) {
    for (const item of record.values) {
      const list = history.get(item.metricId)
      if (!list) history.set(item.metricId, [item.value])
      else if (!list.includes(item.value) && list.length < 5) list.push(item.value)
    }
  }
  return history
})

watch(() => props.open, (open) => {
  if (!open) return
  errorMessage.value = ''
  measuredAt.value = dayjs(props.measurement?.measuredAt ?? new Date()).format('YYYY-MM-DDTHH:mm:ss')
  note.value = props.measurement?.note ?? ''
  for (const key of Object.keys(values)) delete values[Number(key)]
  for (const item of props.measurement?.values ?? []) values[item.metricId] = String(item.value)
  if (!props.measurement && weightMetric.value) {
    const latestWeight = metricHistory.value.get(weightMetric.value.id)?.[0]
    if (latestWeight != null) values[weightMetric.value.id] = String(latestWeight)
  }
}, { immediate: true })

async function save() {
  const payloadValues = Object.entries(values)
    .filter(([, value]) => value !== '')
    .map(([metricId, value]) => ({ metricId: Number(metricId), value: Number(value) }))
  if (!payloadValues.length) {
    errorMessage.value = t('measurement.validation.oneMetric')
    return
  }

  saving.value = true
  errorMessage.value = ''
  try {
    await store.saveMeasurement({
      measuredAt: new Date(measuredAt.value).toISOString(),
      note: note.value || null,
      values: payloadValues,
    }, props.measurement?.id)
    emit('update:open', false)
    emit('saved')
  } catch (error) {
    errorMessage.value = formatError(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="open" class="fixed inset-0 z-50 grid items-end bg-slate-950/50 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" @click.self="emit('update:open', false)">
        <section role="dialog" aria-modal="true" class="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-default p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-7">
          <header class="mb-6 flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
              <span class="app-icon-tile"><AppIcon name="weight" class="size-6" /></span><div>
                <h2 class="text-xl font-bold">{{ t(measurement ? 'measurement.editTitle' : 'measurement.createTitle') }}</h2>
                <p class="mt-1 text-sm text-muted">{{ t('measurement.description') }}</p>
              </div>
            </div>
            <button class="grid size-9 place-items-center rounded-full bg-elevated text-muted hover:text-highlighted" @click="emit('update:open', false)">×</button>
          </header>

          <form class="space-y-5" @submit.prevent="save">
            <div class="block">
              <span class="mb-2 flex items-center justify-between text-sm font-medium"><span class="flex items-center gap-2"><AppIcon name="chart" class="size-4 text-primary" />{{ t('measurement.measuredAt') }}</span> <span class="text-xs font-normal text-muted">{{ t('measurement.measuredAtHint') }}</span></span>
              <AppDateField v-model="measuredAt" mode="datetime" prominent :placeholder="t('measurement.selectMeasuredAt')" />
            </div>

            <div v-if="weightMetric" class="rounded-2xl border border-primary/25 bg-primary/5 p-4">
              <div class="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><AppIcon name="weight" class="size-4" />{{ metricName(weightMetric) }}</div>
              <AppNumberField
                v-model="values[weightMetric.id]"
                :label="t('measurement.metricWithUnit', { name: metricName(weightMetric), unit: weightMetric.unit })"
                :min="weightMetric.minimumValue ?? undefined"
                :max="weightMetric.maximumValue ?? undefined"
                :step="0.01"
                :placeholder="t('measurement.weightExample')"
                :recent="metricHistory.get(weightMetric.id)?.[0]"
                :suggestions="[50, 60, 70, 80]"
              />
            </div>

            <section v-if="otherMetrics.length" class="rounded-2xl border border-default p-4">
              <div class="mb-4 flex items-start gap-2"><AppIcon name="barChart" class="mt-0.5 size-4 text-primary" /><div><h3 class="font-medium">{{ t('measurement.otherMetrics') }}</h3><p class="mt-1 text-xs text-muted">{{ t('measurement.otherMetricsHint') }}</p></div></div>
              <div class="grid gap-4 sm:grid-cols-2">
                <AppNumberField
                  v-for="metric in otherMetrics"
                  :key="metric.id"
                  v-model="values[metric.id]"
                  :label="metricName(metric)"
                  :unit="metric.unit"
                  :min="metric.minimumValue ?? undefined"
                  :max="metric.maximumValue ?? undefined"
                  :step="10 ** -metric.decimalPlaces"
                  :recent="metricHistory.get(metric.id)?.[0]"
                  :suggestions="(metricHistory.get(metric.id) ?? []).slice(1, 5)"
                />
              </div>
            </section>

            <label class="block">
              <span class="mb-2 flex items-center gap-2 text-sm font-medium"><AppIcon name="file" class="size-4 text-primary" />{{ t('common.note') }} <span class="font-normal text-muted">{{ t('common.optional') }}</span></span>
              <textarea v-model="note" maxlength="500" rows="3" class="w-full resize-none rounded-xl border border-default bg-default px-4 py-3 outline-none focus:border-primary" :placeholder="t('measurement.notePlaceholder')" />
            </label>

            <p v-if="errorMessage" class="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{{ errorMessage }}</p>

            <div class="flex gap-3 border-t border-default pt-5">
              <button type="button" class="app-btn app-btn--secondary flex-1" @click="emit('update:open', false)">{{ t('common.cancel') }}</button>
              <button type="submit" :disabled="saving" class="app-btn app-btn--primary flex-1">
                <AppIcon name="shield" class="size-4" />{{ t(saving ? 'common.saving' : 'common.saveRecord') }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-enter-active,
.dialog-leave-active { transition: opacity .2s ease; }
.dialog-enter-active section,
.dialog-leave-active section { transition: transform .2s ease; }
.dialog-enter-from,
.dialog-leave-to { opacity: 0; }
.dialog-enter-from section,
.dialog-leave-to section { transform: translateY(1.5rem) scale(.98); }
</style>
