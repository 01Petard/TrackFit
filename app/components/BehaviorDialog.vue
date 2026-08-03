<script setup lang="ts">
import type { BehaviorTimelineItemDto, TrainingType } from '../../shared/types/api'
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
const saving = ref(false)
const errorMessage = ref('')
const training = reactive({ startedAt: '', type: 'strength' as TrainingType, durationMinutes: 45, intensity: 6, note: '' })
const sleep = reactive({ fellAsleepAt: '', wokeUpAt: '', quality: 80, note: '' })
const trainingTemplates = [
  { label: '力量训练', type: 'strength' as const, durationMinutes: 45, intensity: 8 },
  { label: '有氧', type: 'cardio' as const, durationMinutes: 30, intensity: 6 },
  { label: '拉伸', type: 'mobility' as const, durationMinutes: 15, intensity: 4 },
]

watch(() => props.open, (open) => {
  if (!open) return
  errorMessage.value = ''
  const sourceTraining = props.item?.training
  Object.assign(training, {
    startedAt: dayjs(sourceTraining?.startedAt ?? new Date()).format('YYYY-MM-DDTHH:mm:ss'),
    type: sourceTraining?.type ?? 'strength',
    durationMinutes: sourceTraining?.durationMinutes ?? 45,
    intensity: sourceTraining?.intensity ?? 6,
    note: sourceTraining?.note ?? '',
  })
  const sourceSleep = props.item?.sleep
  const defaultWakeTime = dayjs().hour() >= 7 ? dayjs().hour(7).minute(0).second(0) : dayjs()
  Object.assign(sleep, {
    fellAsleepAt: dayjs(sourceSleep?.fellAsleepAt ?? defaultWakeTime.subtract(8, 'hour')).format('YYYY-MM-DDTHH:mm:ss'),
    wokeUpAt: dayjs(sourceSleep?.wokeUpAt ?? defaultWakeTime).format('YYYY-MM-DDTHH:mm:ss'),
    quality: sourceSleep?.quality ?? 80,
    note: sourceSleep?.note ?? '',
  })
}, { immediate: true })

function applyTemplate(template: typeof trainingTemplates[number]) {
  Object.assign(training, template)
}

function copyLatestTraining() {
  const latest = store.listBehaviors().find(item => item.kind === 'training')?.training
  if (!latest) return
  Object.assign(training, {
    type: latest.type,
    durationMinutes: latest.durationMinutes,
    intensity: latest.intensity,
    note: latest.note ?? '',
  })
}

async function save() {
  saving.value = true
  errorMessage.value = ''
  try {
    if (props.kind === 'training') {
      await store.saveTraining({
        startedAt: new Date(training.startedAt).toISOString(),
        type: training.type,
        durationMinutes: training.durationMinutes,
        intensity: training.intensity,
        note: training.note || null,
      }, props.item?.training?.id)
    } else {
      await store.saveSleep({
        fellAsleepAt: new Date(sleep.fellAsleepAt).toISOString(),
        wokeUpAt: new Date(sleep.wokeUpAt).toISOString(),
        quality: sleep.quality,
        note: sleep.note || null,
      }, props.item?.sleep?.id)
    }
    emit('update:open', false)
    emit('saved')
  } catch (error) {
    errorMessage.value = getTrackFitErrorMessage(error)
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
          <div><h2 class="text-xl font-bold">{{ item ? '编辑' : '新增' }}{{ kind === 'training' ? '训练' : '睡眠' }}记录</h2><p class="mt-1 text-sm text-muted">用于趋势与相关性分析，不提供医疗诊断</p></div>
          <button class="grid size-9 place-items-center rounded-full bg-elevated text-muted" @click="emit('update:open', false)">×</button>
        </header>

        <form class="space-y-5" @submit.prevent="save">
          <template v-if="kind === 'training'">
            <div v-if="!item" class="flex flex-wrap gap-2">
              <button v-for="template in trainingTemplates" :key="template.label" type="button" class="rounded-lg border border-default px-3 py-2 text-xs hover:border-primary hover:text-primary" @click="applyTemplate(template)">{{ template.label }}</button>
              <button type="button" class="rounded-lg border border-default px-3 py-2 text-xs hover:border-primary hover:text-primary" @click="copyLatestTraining">复制上一条</button>
            </div>
            <label class="block text-sm">训练时间<AppDateField v-model="training.startedAt" mode="datetime" class="mt-2" /></label>
            <label class="block text-sm">训练类型<select v-model="training.type" class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3"><option value="strength">力量训练</option><option value="cardio">有氧</option><option value="mobility">拉伸与灵活性</option><option value="other">其他</option></select></label>
            <div class="grid grid-cols-2 gap-3">
              <label class="text-sm">时长（分钟）<input v-model.number="training.durationMinutes" required type="number" min="1" max="1440" class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3"></label>
              <label class="text-sm">主观强度（1–10）<input v-model.number="training.intensity" required type="number" min="1" max="10" class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3"></label>
            </div>
            <label class="block text-sm">备注<textarea v-model="training.note" maxlength="500" rows="3" class="mt-2 w-full resize-none rounded-xl border border-default bg-default px-4 py-3" /></label>
          </template>

          <template v-else>
            <label class="block text-sm">入睡时间<AppDateField v-model="sleep.fellAsleepAt" mode="datetime" class="mt-2" /></label>
            <label class="block text-sm">醒来时间<AppDateField v-model="sleep.wokeUpAt" mode="datetime" class="mt-2" /></label>
            <label class="block text-sm">睡眠质量（百分制）<input v-model.number="sleep.quality" required type="number" min="1" max="100" class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3"></label>
            <label class="block text-sm">备注<textarea v-model="sleep.note" maxlength="500" rows="3" class="mt-2 w-full resize-none rounded-xl border border-default bg-default px-4 py-3" /></label>
          </template>

          <p v-if="errorMessage" class="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{{ errorMessage }}</p>
          <div class="flex gap-3"><button type="button" class="flex-1 rounded-xl border border-default px-4 py-3 font-medium" @click="emit('update:open', false)">取消</button><button :disabled="saving" class="flex-1 rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60">{{ saving ? '保存中…' : '保存记录' }}</button></div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
