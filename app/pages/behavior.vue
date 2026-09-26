<script setup lang="ts">
import type { BehaviorTimelineItemDto } from '../../shared/types/api'
import dayjs from 'dayjs'

const store = useTrackFitData()
const { t } = useI18n()
const { formatDateTime } = useTrackFitI18n()
await store.ensureLoaded()
const start = ref('')
const end = ref('')
const dialogOpen = ref(false)
const dialogKind = ref<'training' | 'sleep'>('training')
const editing = ref<BehaviorTimelineItemDto | null>(null)
const query = computed(() => ({
  start: start.value ? new Date(`${start.value}T00:00:00`).toISOString() : undefined,
  end: end.value ? new Date(`${end.value}T23:59:59`).toISOString() : undefined,
}))
const timeline = computed(() => store.listBehaviors(query.value))
const weekReport = computed(() => store.getPeriodReport('week'))
const latestSleep = computed(() => store.listBehaviors().find(item => item.kind === 'sleep')?.sleep)
const trainingTypeLabels = computed(() => ({ strength: t('training.strength'), cardio: t('training.cardio'), mobility: t('training.mobility'), other: t('training.other') }))
const completenessHints = computed(() => {
  const all = store.listBehaviors()
  const hints: string[] = []
  const latestMeasurement = store.data.value?.bodyRecords.reduce<string | undefined>((latest, item) => !latest || item.measuredAt > latest ? item.measuredAt : latest, undefined)
  const latestTraining = all.find(item => item.kind === 'training')?.occurredAt
  const latestSleepTime = all.find(item => item.kind === 'sleep')?.occurredAt
  if (!latestMeasurement || dayjs().diff(dayjs(latestMeasurement), 'day') >= 7) hints.push(t('behavior.measurementMissing'))
  if (!latestTraining || dayjs().diff(dayjs(latestTraining), 'day') >= 7) hints.push(t('behavior.trainingMissing'))
  if (!latestSleepTime || dayjs().diff(dayjs(latestSleepTime), 'day') >= 2) hints.push(t('behavior.sleepMissing'))
  const weight = store.getAnalytics('weight')?.points ?? []
  const latestWeight = weight.at(-1)?.value
  const previousWeight = weight.at(-2)?.value
  if (latestWeight != null && previousWeight != null && Math.abs(latestWeight - previousWeight) >= Math.max(2, previousWeight * 0.03)) {
    hints.push(t('behavior.weightChanged', { amount: Math.abs(latestWeight - previousWeight).toFixed(2) }))
  }
  return hints
})
const heatmapDays = computed(() => {
  const counts = new Map<string, number>()
  for (const item of store.data.value?.bodyRecords ?? []) {
    const key = dayjs(item.measuredAt).format('YYYY-MM-DD')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  for (const item of store.listBehaviors()) {
    const key = dayjs(item.occurredAt).format('YYYY-MM-DD')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from({ length: 28 }, (_, index) => {
    const date = dayjs().subtract(27 - index, 'day')
    return { key: date.format('YYYY-MM-DD'), label: date.format('MM-DD'), count: counts.get(date.format('YYYY-MM-DD')) ?? 0 }
  })
})

function openCreate(kind: 'training' | 'sleep') {
  editing.value = null
  dialogKind.value = kind
  dialogOpen.value = true
}

function openEdit(item: BehaviorTimelineItemDto) {
  editing.value = item
  dialogKind.value = item.kind
  dialogOpen.value = true
}

async function remove(item: BehaviorTimelineItemDto) {
  if (!window.confirm(t('behavior.confirmDelete', { kind: t(item.kind === 'training' ? 'common.training' : 'common.sleep') }))) return
  if (item.kind === 'training') await store.deleteTraining(item.id)
  else await store.deleteSleep(item.id)
}

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? t('common.hoursMinutes', { hours, minutes: rest }) : t('common.minutes', { count: rest })
}

function itemContent(item: BehaviorTimelineItemDto): string {
  if (item.training) return t('behavior.trainingContent', { type: trainingTypeLabels.value[item.training.type], minutes: item.training.durationMinutes })
  return t('behavior.sleepContent', { bedtime: formatDateTime(item.sleep!.fellAsleepAt), wakeTime: formatDateTime(item.sleep!.wokeUpAt), duration: durationLabel(item.sleep!.durationMinutes), score: item.sleep!.quality })
}
</script>

<template>
  <div>
    <PageHeader :title="t('behavior.title')" :description="t('behavior.description')">
      <div v-if="store.canWrite.value" class="grid grid-cols-2 gap-2 sm:flex"><button class="app-btn app-btn--secondary" :aria-label="`＋ ${t('common.sleep')}`" @click="openCreate('sleep')"><AppIcon name="plus" class="size-4" />{{ t('common.sleep') }}</button><button class="app-btn app-btn--primary" :aria-label="`＋ ${t('common.training')}`" @click="openCreate('training')"><AppIcon name="plus" class="size-4" />{{ t('common.training') }}</button></div>
    </PageHeader>

    <section class="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <article class="app-card p-5"><span class="app-icon-tile"><AppIcon name="dumbbell" class="size-6" /></span><p class="mt-4 text-sm text-muted">{{ t('behavior.weeklyTraining') }}</p><strong class="app-value mt-1 block text-2xl tabular-nums">{{ t('behavior.times', { count: weekReport?.training.count ?? 0 }) }}</strong></article>
      <article class="app-card p-5"><span class="app-icon-tile app-icon-tile--orange"><AppIcon name="run" class="size-6" /></span><p class="mt-4 text-sm text-muted">{{ t('behavior.weeklyDuration') }}</p><strong class="app-value mt-1 block text-2xl tabular-nums">{{ weekReport?.training.totalMinutes ?? 0 }} <span class="text-xs font-normal text-muted">/ {{ t('common.minutes', { count: store.settings.value.weeklyTrainingGoalMinutes }) }}</span></strong></article>
      <article class="app-card p-5"><span class="app-icon-tile app-icon-tile--purple"><AppIcon name="moon" class="size-6" /></span><p class="mt-4 text-sm text-muted">{{ t('behavior.latestSleep') }}</p><strong class="app-value mt-1 block text-2xl tabular-nums">{{ latestSleep ? durationLabel(latestSleep.durationMinutes) : '—' }}</strong></article>
      <article class="app-card p-5"><span class="app-icon-tile app-icon-tile--blue"><AppIcon name="target" class="size-6" /></span><p class="mt-4 text-sm text-muted">{{ t('behavior.weeklySleepGoal') }}</p><strong class="app-value mt-1 block text-2xl tabular-nums">{{ t('common.days', { count: weekReport?.sleep.goalDays ?? 0 }) }}</strong></article>
    </section>

    <section class="app-card mb-5 rounded-2xl p-4">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3"><div class="app-section-heading"><span class="app-icon-tile"><AppIcon name="barChart" class="size-6" /></span><div><h2>{{ t('behavior.heatmapTitle') }}</h2><p>{{ t('behavior.heatmapDescription') }}</p></div></div><div class="flex items-center gap-1 text-[10px] text-muted"><span>0</span><span v-for="level in [0, 1, 2, 3, 4, 5]" :key="level" class="size-3 rounded-sm" :class="level === 0 ? 'bg-elevated' : ''" :style="level ? { backgroundColor: `rgba(16, 185, 129, ${level / 5})` } : undefined" /><span>5+</span></div></div>
      <div class="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1 sm:grid-cols-[repeat(28,minmax(0,1fr))]">
        <div v-for="day in heatmapDays" :key="day.key" class="aspect-square rounded-[4px]" :class="day.count === 0 ? 'bg-elevated' : day.count === 1 ? 'bg-primary/20' : day.count === 2 ? 'bg-primary/40' : day.count === 3 ? 'bg-primary/60' : day.count === 4 ? 'bg-primary/80' : 'bg-primary'" :title="t('behavior.heatmapDay', { date: day.label, count: day.count })" />
      </div>
      <div class="mt-1 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1 sm:grid-cols-[repeat(28,minmax(0,1fr))]"> <span v-for="day in heatmapDays" :key="day.key" class="truncate text-center text-[9px] text-muted">{{ day.label.slice(-2) }}</span></div>
    </section>

    <section class="mb-5 flex gap-3 rounded-2xl border px-4 py-3 text-sm" :class="completenessHints.length ? 'border-warning/30 bg-warning/10 text-warning' : 'border-primary/20 bg-primary/5 text-primary'">
      <AppIcon name="sparkles" class="mt-0.5 size-5 shrink-0" /><div>
        <strong>{{ t(completenessHints.length ? 'behavior.completenessWarning' : 'behavior.completenessGood') }}</strong>
        <ul v-if="completenessHints.length" class="mt-2 list-disc space-y-1 pl-5 text-xs"><li v-for="hint in completenessHints" :key="hint">{{ hint }}</li></ul>
        <p v-else class="mt-1 text-xs">{{ t('behavior.completenessDescription') }}</p>
      </div>
    </section>

    <section class="app-card mb-5 grid gap-3 rounded-2xl p-4 sm:grid-cols-2">
      <div class="text-xs text-muted"><span>{{ t('common.startDate') }}</span><div class="mt-1.5"><AppDateField v-model="start" clearable :placeholder="t('common.anyStartDate')" /></div></div>
      <div class="text-xs text-muted"><span>{{ t('common.endDate') }}</span><div class="mt-1.5"><AppDateField v-model="end" clearable :placeholder="t('common.anyEndDate')" /></div></div>
    </section>

    <section class="app-card overflow-hidden rounded-3xl">
      <div v-if="!timeline.length" class="grid min-h-72 place-items-center text-center text-sm text-muted"><div><p class="text-3xl">◌</p><p class="mt-2">{{ t('behavior.empty') }}</p></div></div>
      <div v-else class="hidden overflow-x-auto md:block">
        <table class="app-table w-full text-left text-sm">
          <thead class="border-b border-default bg-elevated/60 text-xs text-muted"><tr><th class="px-5 py-4 font-medium">{{ t('behavior.time') }}</th><th class="px-5 py-4 font-medium">{{ t('behavior.type') }}</th><th class="px-5 py-4 font-medium">{{ t('behavior.content') }}</th><th class="px-5 py-4 font-medium">{{ t('common.note') }}</th><th v-if="store.canWrite.value" class="px-5 py-4 text-right font-medium">{{ t('common.actions') }}</th></tr></thead><tbody>
            <tr v-for="item in timeline" :key="`${item.kind}-${item.id}`" class="border-b border-default/70 last:border-0"><td class="whitespace-nowrap px-5 py-4">{{ formatDateTime(item.occurredAt) }}</td><td class="px-5 py-4"><span class="rounded-lg px-2.5 py-1 text-xs font-medium" :class="item.kind === 'training' ? 'bg-primary/10 text-primary' : 'bg-violet-500/10 text-violet-600'">{{ t(item.kind === 'training' ? 'common.training' : 'common.sleep') }}</span></td><td class="px-5 py-4">{{ itemContent(item) }}</td><td class="max-w-56 truncate px-5 py-4 text-muted">{{ item.training?.note || '—' }}</td><td v-if="store.canWrite.value" class="whitespace-nowrap px-5 py-4 text-right"><button class="mr-3 text-primary hover:underline" @click="openEdit(item)">{{ t('common.edit') }}</button><button class="text-error hover:underline" @click="remove(item)">{{ t('common.delete') }}</button></td></tr>
          </tbody>
        </table>
      </div>
      <div v-if="timeline.length" class="divide-y divide-default md:hidden">
        <article v-for="item in timeline" :key="`${item.kind}-${item.id}`" class="p-4"><div class="flex items-start justify-between gap-3"><div><span class="rounded-lg px-2 py-1 text-xs font-medium" :class="item.kind === 'training' ? 'bg-primary/10 text-primary' : 'bg-violet-500/10 text-violet-600'">{{ t(item.kind === 'training' ? 'common.training' : 'common.sleep') }}</span><strong class="mt-1 block">{{ item.training ? trainingTypeLabels[item.training.type] : durationLabel(item.sleep!.durationMinutes) }}</strong><p class="mt-1 text-xs text-muted">{{ formatDateTime(item.occurredAt) }}</p></div><div v-if="store.canWrite.value" class="flex gap-3 text-sm"><button class="text-primary" @click="openEdit(item)">{{ t('common.edit') }}</button><button class="text-error" @click="remove(item)">{{ t('common.delete') }}</button></div></div><p class="mt-3 text-xs text-muted">{{ item.training ? t('common.minutes', { count: item.training.durationMinutes }) : t('behavior.sleepScoreValue', { score: item.sleep!.quality }) }}<span v-if="item.training?.note"> · {{ item.training.note }}</span></p></article>
      </div>
    </section>

    <BehaviorDialog v-if="store.canWrite.value" v-model:open="dialogOpen" :kind="dialogKind" :item="editing" />
  </div>
</template>
