<script setup lang="ts">
import { buildRecordOverview } from '../../shared/utils/record-overview'
import dayjs from 'dayjs'

const store = useTrackFitData()
const { t, locale } = useI18n()
const { formatDateTime } = useTrackFitI18n()
const overview = computed(() => store.data.value ? buildRecordOverview(store.data.value) : null)
const completenessTone = computed(() => {
  const percent = overview.value?.completeness ?? 0
  if (percent >= 80) return { color: '#10b981', textColor: '#047857' }
  if (percent >= 40) return { color: '#eab308', textColor: '#854d0e' }
  return { color: '#ef4444', textColor: '#b91c1c' }
})
const settings = store.settings
const latestSleep = computed(() => store.listBehaviors().find(item => item.sleep && new Date(item.occurredAt) <= new Date())?.sleep)
const rows = computed(() => [
  { kind: 'training' as const, label: t('analysis.fitness') },
  { kind: 'body' as const, label: t('history.body') },
  { kind: 'sleep' as const, label: t('common.sleep') },
])
const weekday = computed(() => new Intl.DateTimeFormat(locale.value === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'narrow' }))

function durationLabel(minutes: number) {
  return t('common.hoursMinutes', { hours: Math.floor(minutes / 60), minutes: Math.round(minutes % 60) })
}

function heatColor(percent: number) {
  return percent === 0 ? '#eef4f3' : `rgba(16, 185, 129, ${0.14 + percent / 100 * 0.86})`
}
</script>

<template>
  <div v-if="overview" class="mb-5 space-y-4">
    <section class="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <article class="app-card flex min-w-0 items-center justify-between gap-2 p-4 sm:p-5">
        <div class="min-w-0"><div class="flex items-center gap-2"><span class="app-icon-tile !size-8 !rounded-lg"><AppIcon name="dumbbell" class="size-4" /></span><p class="text-xs text-muted">{{ t('behavior.weeklyTraining') }}</p></div><strong class="app-value mt-3 block text-xl font-semibold sm:text-2xl">{{ t('behavior.times', { count: overview.trainingCount }) }}</strong><p class="mt-1 text-xs text-muted">{{ t('historyPage.countGoal', { count: settings.weeklyTrainingGoalCount }) }}</p></div>
        <GoalRing class="hidden min-[480px]:grid" :percent="overview.trainingPercent" :label="t('behavior.weeklyTraining')" />
      </article>
      <article class="app-card flex min-w-0 items-center justify-between gap-2 p-4 sm:p-5">
        <div class="min-w-0"><div class="flex items-center gap-2"><span class="app-icon-tile app-icon-tile--orange !size-8 !rounded-lg"><AppIcon name="run" class="size-4" /></span><p class="text-xs text-muted">{{ t('behavior.weeklyDuration') }}</p></div><strong class="app-value mt-3 block text-xl font-semibold sm:text-2xl">{{ overview.trainingMinutes }} <span class="text-xs font-normal">{{ t('date.minute') }}</span></strong><p class="mt-1 text-xs text-muted">{{ t('historyPage.durationGoal', { minutes: settings.weeklyTrainingGoalMinutes }) }}</p></div>
        <GoalRing class="hidden min-[480px]:grid" :percent="overview.durationPercent" :label="t('behavior.weeklyDuration')" color="#fb923c" />
      </article>
      <article class="app-card min-w-0 p-4 sm:p-5">
        <div class="flex items-center gap-2"><span class="app-icon-tile app-icon-tile--purple !size-8 !rounded-lg"><AppIcon name="moon" class="size-4" /></span><p class="text-xs text-muted">{{ t('behavior.latestSleep') }}</p></div>
        <strong class="app-value mt-3 block text-lg font-semibold sm:text-xl">{{ latestSleep ? durationLabel(latestSleep.durationMinutes) : '—' }}</strong>
        <div class="mt-2 flex items-end justify-between gap-2"><p class="min-w-0 break-words text-[11px] leading-relaxed text-muted">{{ latestSleep ? t('historyPage.sleepWindow', { start: formatDateTime(latestSleep.fellAsleepAt), end: dayjs(latestSleep.wokeUpAt).format('HH:mm') }) : t('common.noRecords') }}</p><span class="hidden h-7 shrink-0 items-end gap-1 sm:flex" aria-hidden="true"><span v-for="day in overview.days.slice(-7)" :key="day.date" class="w-1 rounded-sm bg-violet-400" :style="{ height: `${Math.max(3, Math.min(day.sleepMinutes / 60, 12) * 2)}px`, opacity: day.sleepCount ? 1 : 0.2 }" /></span></div>
      </article>
      <article class="app-card min-w-0 p-4 sm:p-5">
        <div class="flex items-center gap-2"><span class="app-icon-tile app-icon-tile--blue !size-8 !rounded-lg"><AppIcon name="target" class="size-4" /></span><p class="text-xs text-muted">{{ t('behavior.weeklySleepGoal') }}</p></div><strong class="app-value mt-3 block text-xl font-semibold sm:text-2xl">{{ overview.sleepGoalDays }} / 7 <span class="text-xs font-normal">{{ t('historyPage.dayUnit') }}</span></strong>
        <div class="mt-2 grid grid-cols-7 gap-1"><div v-for="day in overview.weekDays" :key="day.date" class="text-center" :title="`${day.date} · ${durationLabel(day.sleepMinutes)}`"><span class="mx-auto block h-4 w-2 rounded-full" :class="day.sleepMinutes >= settings.sleepGoalHours * 60 ? 'bg-sky-500' : day.sleepCount ? 'bg-sky-300' : 'bg-slate-100'" /><span class="mt-1 block text-[9px] text-muted">{{ weekday.format(dayjs(day.date).toDate()) }}</span></div></div>
      </article>
    </section>

    <div class="grid gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
      <section class="app-card min-w-0 p-4 sm:p-5" data-testid="record-heatmap">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3"><div class="app-section-heading"><span class="app-icon-tile !size-8 !rounded-lg"><AppIcon name="barChart" class="size-4" /></span><h2>{{ t('behavior.heatmapTitle') }}</h2></div><div class="flex items-center gap-1 text-[10px] text-muted"><span>0%</span><span v-for="level in [0, 25, 50, 75, 100]" :key="level" class="size-2.5 rounded-sm" :style="{ backgroundColor: heatColor(level) }" /><span>100%</span></div></div>
        <div class="overflow-x-auto pb-1">
          <div class="min-w-[280px]">
            <div v-for="row in rows" :key="row.kind" data-testid="heatmap-row" class="mb-1 grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-2">
              <span class="text-[11px] text-muted">{{ row.label }}</span><div class="grid grid-cols-[repeat(28,minmax(0,1fr))] gap-1"><span v-for="day in overview.days" :key="day.date" data-testid="heatmap-cell" :data-kind="row.kind" :data-date="day.date" :data-percent="day[row.kind]" class="aspect-square rounded-sm" :style="{ backgroundColor: heatColor(day[row.kind]) }" role="img" :aria-label="`${day.date} · ${row.label} · ${day[row.kind]}%`" :title="`${day.date} · ${row.label} · ${day[row.kind]}%`" /></div>
            </div>
            <div class="ml-10 mt-2 grid grid-cols-[repeat(28,minmax(0,1fr))] gap-1"><span v-for="(day, index) in overview.days" :key="day.date" class="overflow-visible whitespace-nowrap text-[9px] text-muted" :class="index === 27 ? 'text-right' : ''">{{ index % 7 === 0 || index === 27 ? dayjs(day.date).format('MM-DD') : '' }}</span></div>
          </div>
        </div>
        <p class="mt-3 text-[11px] leading-relaxed text-muted">{{ t('historyPage.heatmapHint') }}</p>
      </section>
      <section class="app-card min-w-0 p-4 sm:p-5" data-testid="record-completeness">
        <div class="app-section-heading"><span class="app-icon-tile !size-8 !rounded-lg"><AppIcon name="sparkles" class="size-4" /></span><h2>{{ t('historyPage.completeness') }}</h2></div>
        <div class="mt-4 flex items-center gap-4"><GoalRing :percent="overview.completeness" :label="t('historyPage.completeness')" :color="completenessTone.color" :text-color="completenessTone.textColor" /><dl class="min-w-0 flex-1 space-y-2.5"><div v-for="item in overview.coverage" :key="item.kind" class="flex flex-wrap items-center justify-between gap-1 text-xs"><dt class="inline-flex items-center gap-1.5 text-muted"><AppIcon :name="item.days === 28 ? 'check' : 'calendar'" class="size-3.5 shrink-0 text-primary" />{{ rows.find(row => row.kind === item.kind)?.label }}</dt><dd class="whitespace-nowrap tabular-nums text-muted">{{ item.days }} / 28 {{ t('historyPage.dayUnit') }}</dd></div></dl></div>
        <p class="mt-3 text-[11px] leading-relaxed text-muted">{{ t('historyPage.completenessHint') }}</p>
      </section>
    </div>
  </div>
</template>
