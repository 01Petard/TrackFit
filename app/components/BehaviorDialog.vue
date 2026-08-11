<script setup lang="ts">
import type { TrainingWrite } from '../../shared/schemas/trackfit'
import type { BehaviorTimelineItemDto } from '../../shared/types/api'
import dayjs from 'dayjs'

const props = defineProps<{
  open: boolean
  kind: 'training' | 'sleep'
  item?: BehaviorTimelineItemDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const store = useTrackFitData()
const { t } = useI18n()
const { formatDateTime, formatError } = useTrackFitI18n()
const saving = ref(false)
const errorMessage = ref('')
const training = reactive({ type: 'strength' as TrainingWrite['type'], durationMinutes: 45, note: '' })
const sleep = reactive({ fellAsleepAt: '', durationHours: 8, quality: 80 })
const calculatedWakeUpAt = computed(() => {
  const fellAsleepAt = dayjs(sleep.fellAsleepAt)
  if (!fellAsleepAt.isValid() || sleep.durationHours <= 0) return '—'
  return formatDateTime(fellAsleepAt.add(sleep.durationHours, 'hour').toDate())
})
const trainingTemplates = computed(() => [
  { label: t('training.strength'), type: 'strength' as const, durationMinutes: 45 },
  { label: t('training.cardio'), type: 'cardio' as const, durationMinutes: 30 },
  { label: t('training.mobility'), type: 'mobility' as const, durationMinutes: 15 },
])

watch(() => props.open, (open) => {
  if (!open) return
  errorMessage.value = ''
  const sourceTraining = props.item?.training
  Object.assign(training, {
    type: sourceTraining && sourceTraining.type !== 'other' ? sourceTraining.type : 'strength',
    durationMinutes: sourceTraining?.durationMinutes ?? 45,
    note: sourceTraining?.note ?? '',
  })
  const sourceSleep = props.item?.sleep
  const defaultWakeTime = dayjs().hour() >= 7 ? dayjs().hour(7).minute(0).second(0) : dayjs()
  Object.assign(sleep, {
    fellAsleepAt: dayjs(sourceSleep?.fellAsleepAt ?? defaultWakeTime.subtract(8, 'hour')).format('YYYY-MM-DDTHH:mm:ss'),
    durationHours: sourceSleep ? Number((sourceSleep.durationMinutes / 60).toFixed(2)) : 8,
    quality: sourceSleep?.quality ?? 80,
  })
}, { immediate: true })

function applyTemplate(template: typeof trainingTemplates.value[number]) {
  Object.assign(training, template)
}

async function save() {
  saving.value = true
  errorMessage.value = ''
  try {
    if (props.kind === 'training') {
      await store.saveTraining({
        type: training.type,
        durationMinutes: training.durationMinutes,
        note: training.note || null,
      }, props.item?.training?.id)
    } else {
      await store.saveSleep({
        fellAsleepAt: new Date(sleep.fellAsleepAt).toISOString(),
        durationMinutes: Math.round(sleep.durationHours * 60),
        quality: sleep.quality,
      }, props.item?.sleep?.id)
    }
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
    <div v-if="open" class="fixed inset-0 z-50 grid items-end bg-slate-950/50 backdrop-blur-sm sm:place-items-center sm:p-4" @click.self="emit('update:open', false)">
      <section role="dialog" aria-modal="true" class="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-default p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-7">
        <header class="mb-6 flex items-start justify-between gap-4">
          <div><h2 class="text-xl font-bold">{{ t('behaviorDialog.title', { action: t(item ? 'common.edit' : 'common.add'), kind: t(kind === 'training' ? 'common.training' : 'common.sleep') }) }}</h2><p class="mt-1 text-sm text-muted">{{ t('behaviorDialog.description') }}</p></div>
          <button class="grid size-9 place-items-center rounded-full bg-elevated text-muted" @click="emit('update:open', false)">×</button>
        </header>

        <form class="space-y-5" @submit.prevent="save">
          <template v-if="kind === 'training'">
            <div v-if="!item" class="flex flex-wrap gap-2">
              <button v-for="template in trainingTemplates" :key="template.label" type="button" class="rounded-lg border border-default px-3 py-2 text-xs hover:border-primary hover:text-primary" @click="applyTemplate(template)">{{ template.label }}</button>
            </div>
            <label class="block text-sm">{{ t('behaviorDialog.trainingType') }}<select v-model="training.type" class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3"><option value="strength">{{ t('training.strength') }}</option><option value="cardio">{{ t('training.cardio') }}</option><option value="mobility">{{ t('training.mobility') }}</option></select></label>
            <label class="block text-sm">{{ t('behaviorDialog.durationMinutes') }}<input v-model.number="training.durationMinutes" required type="number" min="1" max="1440" class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3"></label>
            <label class="block text-sm">{{ t('common.note') }}<textarea v-model="training.note" maxlength="500" rows="3" class="mt-2 w-full resize-none rounded-xl border border-default bg-default px-4 py-3" /></label>
          </template>

          <template v-else>
            <label class="block text-sm">{{ t('behaviorDialog.bedtime') }}<AppDateField v-model="sleep.fellAsleepAt" mode="datetime" class="mt-2" /></label>
            <div class="grid grid-cols-2 gap-3">
              <label class="text-sm">{{ t('behaviorDialog.sleepHours') }}<input v-model.number="sleep.durationHours" required type="number" min="0.02" max="24" step="0.01" class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3"></label>
              <label class="text-sm">{{ t('behaviorDialog.sleepScore') }}<input v-model.number="sleep.quality" required type="number" min="1" max="100" class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3"></label>
            </div>
            <p class="rounded-xl bg-elevated px-4 py-3 text-sm text-muted">
              {{ t('behaviorDialog.wakeTime') }}：<span class="font-medium text-highlighted">{{ calculatedWakeUpAt }}</span>
            </p>
          </template>

          <p v-if="errorMessage" class="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{{ errorMessage }}</p>
          <div class="flex gap-3"><button type="button" class="flex-1 rounded-xl border border-default px-4 py-3 font-medium" @click="emit('update:open', false)">{{ t('common.cancel') }}</button><button :disabled="saving" class="flex-1 rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60">{{ t(saving ? 'common.saving' : 'common.saveRecord') }}</button></div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
