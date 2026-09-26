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
const training = reactive({ type: 'strength' as TrainingWrite['type'], durationMinutes: 30, note: '' })
const sleep = reactive({ fellAsleepAt: '', durationHours: 8, durationMinutes: 0, quality: 80 })
const calculatedWakeUpAt = computed(() => {
  const fellAsleepAt = dayjs(sleep.fellAsleepAt)
  const durationMinutes = sleep.durationHours * 60 + sleep.durationMinutes
  if (!fellAsleepAt.isValid() || durationMinutes <= 0) return '—'
  return formatDateTime(fellAsleepAt.add(durationMinutes, 'minute').toDate())
})
const trainingTemplates = computed(() => [
  { label: t('training.strength'), icon: 'dumbbell' as const, type: 'strength' as const, durationMinutes: 30 },
  { label: t('training.cardio'), icon: 'run' as const, type: 'cardio' as const, durationMinutes: 30 },
  { label: t('training.mobility'), icon: 'stretch' as const, type: 'mobility' as const, durationMinutes: 30 },
])

watch(() => props.open, (open) => {
  if (!open) return
  errorMessage.value = ''
  const sourceTraining = props.item?.training
  Object.assign(training, {
    type: sourceTraining && sourceTraining.type !== 'other' ? sourceTraining.type : 'strength',
    durationMinutes: sourceTraining?.durationMinutes ?? 30,
    note: sourceTraining?.note ?? '',
  })
  const sourceSleep = props.item?.sleep
  const durationMinutes = sourceSleep?.durationMinutes ?? 480
  const defaultWakeTime = dayjs().hour() >= 7 ? dayjs().hour(7).minute(0).second(0) : dayjs()
  Object.assign(sleep, {
    fellAsleepAt: dayjs(sourceSleep?.fellAsleepAt ?? defaultWakeTime.subtract(8, 'hour')).format('YYYY-MM-DDTHH:mm:ss'),
    durationHours: Math.floor(durationMinutes / 60),
    durationMinutes: durationMinutes % 60,
    quality: sourceSleep?.quality ?? 80,
  })
}, { immediate: true })

watch(() => sleep.durationHours, (hours) => {
  if (hours >= 24) sleep.durationMinutes = 0
})

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
      if (sleep.durationHours * 60 + sleep.durationMinutes < 1) {
        errorMessage.value = t('behaviorDialog.durationRequired')
        return
      }
      await store.saveSleep({
        fellAsleepAt: new Date(sleep.fellAsleepAt).toISOString(),
        durationMinutes: sleep.durationHours * 60 + sleep.durationMinutes,
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
      <section role="dialog" aria-modal="true" class="app-card max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-default p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-7">
        <header class="mb-6 flex items-start justify-between gap-4">
          <div class="flex items-center gap-3">
            <span class="app-icon-tile" :class="kind === 'sleep' ? 'app-icon-tile--purple' : ''"><AppIcon :name="kind === 'sleep' ? 'moon' : 'dumbbell'" class="size-6" /></span>
            <div><h2 class="text-xl font-bold">{{ t('behaviorDialog.title', { action: t(item ? 'common.edit' : 'common.add'), kind: t(kind === 'training' ? 'common.training' : 'common.sleep') }) }}</h2><p class="mt-1 text-sm text-muted">{{ t('behaviorDialog.description') }}</p></div>
          </div>
          <button class="grid size-9 place-items-center rounded-full bg-elevated text-muted hover:text-highlighted" @click="emit('update:open', false)">×</button>
        </header>

        <form class="space-y-5" @submit.prevent="save">
          <template v-if="kind === 'training'">
            <div class="rounded-2xl border border-primary/25 bg-primary/5 p-4">
              <p class="mb-3 flex items-center gap-2 text-sm font-semibold text-primary"><AppIcon name="dumbbell" class="size-4" />{{ t('behaviorDialog.trainingType') }}</p>
              <div class="grid grid-cols-3 gap-2">
                <button v-for="template in trainingTemplates" :key="template.label" type="button" :aria-pressed="training.type === template.type" class="flex min-w-0 flex-col items-center gap-2 rounded-xl border px-2 py-3 text-xs font-semibold" :class="training.type === template.type ? 'border-primary/50 bg-white text-primary shadow-sm' : 'border-default bg-white/70 text-muted hover:border-primary/30'" @click="item ? training.type = template.type : applyTemplate(template)"><AppIcon :name="template.icon" class="size-5" />{{ template.label }}</button>
              </div>
            </div>
            <div>
              <p class="mb-2 flex items-center gap-2 text-sm font-medium"><AppIcon name="clock" class="size-4 text-primary" />{{ t('behaviorDialog.durationMinutes') }}</p>
              <AppNumberField v-model.number="training.durationMinutes" :label="t('behaviorDialog.durationMinutes')" hide-label unit="min" required :min="1" :max="1440" duration-unit="minutes" :placeholder="t('behaviorDialog.durationPlaceholder')" :recent="props.item?.training?.durationMinutes" :suggestions="[20, 25, 30, 35, 45]" />
            </div>
            <label class="block">
              <span class="mb-2 flex items-center gap-2 text-sm font-medium"><AppIcon name="file" class="size-4 text-primary" />{{ t('common.note') }} <span class="font-normal text-muted">{{ t('common.optional') }}</span></span>
              <textarea v-model="training.note" maxlength="200" rows="3" class="w-full resize-none rounded-xl border border-default bg-default px-4 py-3 outline-none focus:border-primary" :placeholder="t('behaviorDialog.notePlaceholder')" />
              <span class="mt-1 block text-right text-xs text-muted">{{ training.note.length }} / 200</span>
            </label>
          </template>

          <template v-else>
            <div>
              <p class="mb-2 flex items-center gap-2 text-sm font-medium"><AppIcon name="clock" class="size-4 text-primary" />{{ t('behaviorDialog.bedtime') }}</p>
              <AppBedtimeField v-model="sleep.fellAsleepAt" />
            </div>
            <div class="space-y-3">
              <p class="flex items-center gap-2 text-sm font-medium"><AppIcon name="moon" class="size-4 text-primary" />{{ t('behaviorDialog.sleepHours') }}</p>
              <div class="grid grid-cols-2 gap-3">
                <AppNumberField v-model.number="sleep.durationHours" :label="t('behaviorDialog.durationHoursField')" unit="h" required :min="0" :max="24" :placeholder="t('behaviorDialog.hoursPlaceholder')" />
                <AppNumberField v-model.number="sleep.durationMinutes" :label="t('behaviorDialog.durationMinutesField')" unit="min" required :min="0" :max="sleep.durationHours === 24 ? 0 : 59" :step="1" :placeholder="t('behaviorDialog.minutesPlaceholder')" />
              </div>
              <div class="flex flex-wrap gap-2">
                <button v-for="minutes in [360, 390, 420, 450, 480]" :key="minutes" type="button" :aria-pressed="sleep.durationHours * 60 + sleep.durationMinutes === minutes" class="app-quick-chip px-3 text-xs" @click="sleep.durationHours = Math.floor(minutes / 60); sleep.durationMinutes = minutes % 60">{{ Math.floor(minutes / 60) }} {{ t('date.hour') }}<template v-if="minutes % 60"> {{ minutes % 60 }} {{ t('date.minute') }}</template></button>
              </div>
            </div>
            <div>
              <p class="mb-2 flex items-center gap-2 text-sm font-medium"><AppIcon name="sparkles" class="size-4 text-primary" />{{ t('behaviorDialog.sleepScore') }}</p>
              <AppNumberField v-model.number="sleep.quality" :label="t('behaviorDialog.sleepScore')" hide-label unit="/ 100" required :min="1" :max="100" :placeholder="t('behaviorDialog.scorePlaceholder')" :recent="props.item?.sleep?.quality" :suggestions="[50, 60, 70, 80, 90]" />
            </div>
            <p class="flex gap-3 rounded-xl bg-primary/5 px-4 py-3 text-sm text-muted">
              <AppIcon name="info" class="size-5 shrink-0 text-primary" /><span>{{ t('behaviorDialog.wakeTime') }}：<strong class="font-semibold text-highlighted">{{ calculatedWakeUpAt }}</strong><span class="mt-1 block text-xs">{{ t('behaviorDialog.wakeHint') }}</span></span>
            </p>
          </template>

          <p v-if="errorMessage" class="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{{ errorMessage }}</p>
          <div class="flex gap-3 border-t border-default pt-5"><button type="button" class="app-btn app-btn--secondary flex-1" @click="emit('update:open', false)">{{ t('common.cancel') }}</button><button :disabled="saving" class="app-btn app-btn--primary flex-1"><AppIcon name="shield" class="size-4" />{{ t(saving ? 'common.saving' : 'common.saveRecord') }}</button></div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
