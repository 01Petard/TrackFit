<script setup lang="ts">
import type { MovingAveragePeriod } from '../../shared/types/api'
import type { MakeupKind } from '../../shared/utils/makeup'
import { buildMetricTrendInsight } from '../../shared/utils/analytics'
import dayjs from 'dayjs'

const dialogOpen = ref(false)
const behaviorDialogOpen = ref(false)
const behaviorDialogKind = ref<'training' | 'sleep'>('training')
const managerDialogOpen = ref(false)
const managerDialogKind = ref<'records' | 'metrics'>('records')
const makeupOpen = ref(false)
const makeupKind = ref<MakeupKind>('all')
const start = dayjs().subtract(7, 'day').toISOString()
const weightStart = dayjs().subtract(30, 'day').toISOString()
const store = useTrackFitData()
const { locale, t } = useI18n()
const localePath = useLocalePath()
const { formatDescriptor, metricName } = useTrackFitI18n()
await store.ensureLoaded()
const analytics = computed(() => store.getAnalytics('weight', weightStart))
const latestAnalytics = computed(() => new Map(
  ['weight', 'waist', 'body_fat'].map(code => [code, store.getAnalytics(code)]),
))
const weightMetricId = computed(() => store.metrics.value.find(metric => metric.code === 'weight')?.id)
const latestWeightRecord = computed(() => weightMetricId.value == null
  ? undefined
  : store.listMeasurements({ page: 1, pageSize: 1, metricId: weightMetricId.value }).items[0])
const settings = store.settings
const visibleMovingAverages = ref<MovingAveragePeriod[]>([3, 7, 30, 90])

function openManager(kind: 'records' | 'metrics') {
  managerDialogKind.value = kind
  managerDialogOpen.value = true
}

function openBehaviorDialog(kind: 'training' | 'sleep') {
  behaviorDialogKind.value = kind
  behaviorDialogOpen.value = true
}

function openMakeup(kind: MakeupKind) {
  makeupKind.value = kind
  makeupOpen.value = true
}

const behaviors = computed(() => store.listBehaviors())
const todayCount = computed(() => (
  (store.data.value?.bodyRecords.filter(record => dayjs(record.measuredAt).isSame(dayjs(), 'day')).length ?? 0)
  + behaviors.value.filter(item => dayjs(item.occurredAt).isSame(dayjs(), 'day')).length
))
const recentRecords = computed(() => store.listHistoryRecords().slice(0, 8))
const todayTraining = computed(() => behaviors.value.filter(item => item.kind === 'training' && dayjs(item.occurredAt).isSame(dayjs(), 'day')).reduce((total, item) => total + (item.training?.durationMinutes ?? 0), 0))
const latestSleep = computed(() => behaviors.value.find(item => item.kind === 'sleep')?.sleep)
const recordingStreak = computed(() => {
  const recordedDays = new Set([
    ...(store.data.value?.bodyRecords ?? []).map(item => dayjs(item.measuredAt).format('YYYY-MM-DD')),
    ...behaviors.value.map(item => dayjs(item.occurredAt).format('YYYY-MM-DD')),
  ])
  let cursor = dayjs()
  if (!recordedDays.has(cursor.format('YYYY-MM-DD'))) cursor = cursor.subtract(1, 'day')
  let days = 0
  while (recordedDays.has(cursor.format('YYYY-MM-DD'))) {
    days++
    cursor = cursor.subtract(1, 'day')
  }
  return days
})
const latestMissingDay = computed(() => store.getLatestMissingDay())
const latestSingleMissing = computed(() => ({
  weight: store.getLatestMissingDay('weight'),
  sleep: store.getLatestMissingDay('sleep'),
  training: store.getLatestMissingDay('training'),
}))
const makeupDate = computed(() => makeupKind.value === 'all' ? latestMissingDay.value : latestSingleMissing.value[makeupKind.value])
const cards = computed(() => [
  { label: t('metrics.weight'), icon: 'weight' as const, value: latestAnalytics.value.get('weight')?.summary?.latest, unit: 'kg', change: latestAnalytics.value.get('weight')?.summary?.previousChange, measuredAt: latestAnalytics.value.get('weight')?.points.at(-1)?.measuredAt, color: '#19a974', values: latestAnalytics.value.get('weight')?.points.slice(-7).map(point => point.value) ?? [] },
  { label: 'BMI', icon: 'bmi' as const, value: latestWeightRecord.value?.bmi, unit: '', change: null, measuredAt: latestWeightRecord.value?.measuredAt, color: '#4a92c7', values: store.listMeasurements({ page: 1, pageSize: 7, metricId: weightMetricId.value }).items.slice().reverse().flatMap(record => record.bmi == null ? [] : [record.bmi]) },
  { label: t('metrics.waist'), icon: 'waist' as const, value: latestAnalytics.value.get('waist')?.summary?.latest, unit: 'cm', change: latestAnalytics.value.get('waist')?.summary?.previousChange, measuredAt: latestAnalytics.value.get('waist')?.points.at(-1)?.measuredAt, color: '#5e8fbe', values: latestAnalytics.value.get('waist')?.points.slice(-7).map(point => point.value) ?? [] },
  { label: t('metrics.bodyFat'), icon: 'percent' as const, value: latestAnalytics.value.get('body_fat')?.summary?.latest, unit: '%', change: latestAnalytics.value.get('body_fat')?.summary?.previousChange, measuredAt: latestAnalytics.value.get('body_fat')?.points.at(-1)?.measuredAt, color: '#9276bd', values: latestAnalytics.value.get('body_fat')?.points.slice(-7).map(point => point.value) ?? [] },
])
const insightColors = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6', '#6366f1', '#ec4899']
const fixedInsightColors: Record<string, string> = { weight: '#10b981', waist: '#0ea5e9', body_fat: '#8b5cf6' }
const smartInsights = computed(() => store.metrics.value.filter(metric => metric.enabled).flatMap((metric, index) => {
  const metricAnalytics = store.getAnalytics(metric.code, start)
  if (!metricAnalytics?.summary) return []
  const insight = buildMetricTrendInsight(metricAnalytics)
  return insight ? [{
    code: metric.code,
    color: fixedInsightColors[metric.code] ?? insightColors[index % insightColors.length],
    name: metricName(metricAnalytics.metric),
    unit: metricAnalytics.metric.unit,
    latest: metricAnalytics.summary.latest,
    count: metricAnalytics.summary.count,
    values: metricAnalytics.points.map(point => point.value),
    direction: insight.direction,
    trendLabel: formatDescriptor(insight.trend),
    changeLabel: formatDescriptor(insight.change),
    evaluation: formatDescriptor(insight.evaluation),
    tone: insight.tone,
  }] : []
}))
const behaviorInsights = computed(() => {
  const recent = store.listBehaviors({ start })
  const trainings = recent.flatMap(item => item.training ? [item.training] : [])
  const sleeps = recent.flatMap(item => item.sleep ? [item.sleep] : [])
  const insights = []

  if (trainings.length) {
    const dailyMinutes = new Map<string, number>()
    for (const item of trainings) {
      const day = dayjs(item.recordedAt).format('YYYY-MM-DD')
      dailyMinutes.set(day, (dailyMinutes.get(day) ?? 0) + item.durationMinutes)
    }
    const values = Array.from({ length: 7 }, (_, index) => dailyMinutes.get(dayjs().subtract(6 - index, 'day').format('YYYY-MM-DD')) ?? 0)
    const total = values.reduce((sum, value) => sum + value, 0)
    const goal = settings.value.weeklyTrainingGoalMinutes
    insights.push({
      code: 'training_duration',
      color: '#f59e0b',
      name: t('home.insights.trainingDuration'),
      unit: t('common.minuteUnit'),
      latest: values.at(-1) ?? 0,
      count: trainings.length,
      values,
      direction: total >= goal ? 'up' as const : 'stable' as const,
      trendLabel: t(total >= goal ? 'home.insights.weeklyGoalReached' : 'home.insights.accumulating'),
      changeLabel: t('home.insights.sevenDayMinutes', { total }),
      evaluation: goal > 0 ? t('home.insights.trainingGoalProgress', { goal, percent: Math.round(total / goal * 100) }) : t('home.insights.noTrainingGoal'),
      tone: total >= goal ? 'positive' as const : 'neutral' as const,
    })
  }

  if (sleeps.length) {
    const dailyScores = new Map<string, number[]>()
    for (const item of sleeps) {
      const day = dayjs(item.wokeUpAt).format('YYYY-MM-DD')
      dailyScores.set(day, [...(dailyScores.get(day) ?? []), item.quality])
    }
    const values = [...dailyScores.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, scores]) => Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length))
    const average = values.reduce((sum, value) => sum + value, 0) / values.length
    const latest = values.at(-1) ?? 0
    const change = values.length > 1 ? latest - values[0]! : 0
    insights.push({
      code: 'sleep_score',
      color: '#6366f1',
      name: t('home.insights.sleepScore'),
      unit: t('common.pointUnit'),
      latest,
      count: values.length,
      values,
      direction: change > 0 ? 'up' as const : change < 0 ? 'down' as const : 'stable' as const,
      trendLabel: t(change > 0 ? 'home.insights.scoreUp' : change < 0 ? 'home.insights.scoreDown' : 'home.insights.scoreStable'),
      changeLabel: values.length > 1 ? t('home.insights.scoreChange', { change: `${change > 0 ? '+' : ''}${change}` }) : t('home.insights.noComparableChange'),
      evaluation: t('home.insights.sleepEvaluation', { average: average.toFixed(1), latest }),
      tone: change >= 0 ? 'positive' as const : 'warning' as const,
    })
  }
  return insights
})
const dashboardInsights = computed(() => [...smartInsights.value, ...behaviorInsights.value])
const featuredInsights = computed(() => {
  const weight = dashboardInsights.value.find(item => item.code === 'weight')
  const training = dashboardInsights.value.find(item => item.code === 'training_duration')
  const sleepScore = dashboardInsights.value.find(item => item.code === 'sleep_score')
  return [
    { code: 'weight', icon: 'weight' as const, title: t('home.weightTrend.title'), color: '#10b981', latest: weight?.latest ?? cards.value[0]?.value ?? '—', unit: 'kg', values: weight?.values ?? [], direction: weight?.direction ?? 'insufficient' as const, trendLabel: weight?.trendLabel ?? t('common.noRecords'), changeLabel: weight?.changeLabel ?? t('home.insights.noComparableChange') },
    { code: 'training_duration', icon: 'dumbbell' as const, title: t('home.insights.trainingDuration'), color: '#eaa11b', latest: training?.latest ?? todayTraining.value, unit: t('common.minuteUnit'), values: training?.values ?? [], direction: training?.direction ?? 'insufficient' as const, trendLabel: training?.trendLabel ?? t('common.noRecords'), changeLabel: training?.changeLabel ?? t('home.insights.noComparableChange') },
    { code: 'sleep_score', icon: 'moon' as const, title: t('home.insights.sleepScore'), color: '#7964ed', latest: sleepScore?.latest ?? latestSleep.value?.quality ?? '—', unit: t('common.pointUnit'), values: sleepScore?.values ?? [], direction: sleepScore?.direction ?? 'insufficient' as const, trendLabel: sleepScore?.trendLabel ?? t('common.noRecords'), changeLabel: sleepScore?.changeLabel ?? t('home.insights.noComparableChange') },
  ]
})
const smartSummary = computed(() => {
  if (!dashboardInsights.value.length) return t('home.insights.emptySummary')
  const trends = dashboardInsights.value.map(item => `${item.name} ${item.trendLabel}`).join(locale.value === 'zh' ? '，' : ', ')
  const weight = dashboardInsights.value.find(item => item.code === 'weight')
  return t('home.insights.summary', { count: dashboardInsights.value.length, trends, evaluation: weight?.evaluation ?? t('home.insights.keepRecording') })
})

function formatLastMeasuredAt(measuredAt?: string): string {
  if (!measuredAt) return t('home.noValidRecord')
  return new Intl.DateTimeFormat(locale.value === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(measuredAt))
}

function durationLabel(minutes: number): string {
  return t('common.hoursMinutes', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
}

function trendSymbol(direction: 'up' | 'down' | 'stable' | 'insufficient'): string {
  if (direction === 'up') return '↗'
  if (direction === 'down') return '↘'
  if (direction === 'stable') return '→'
  return '·'
}
</script>

<template>
  <div>
    <PageHeader :title="t('home.title')" :description="t('home.description')">
      <div class="flex flex-wrap gap-2">
        <button v-if="store.canWrite.value" class="app-btn app-btn--primary" @click="dialogOpen = true"><AppIcon name="plus" class="size-4" />{{ t('home.quickRecord') }}</button>
        <button class="app-btn app-btn--secondary" @click="openManager('records')"><AppIcon name="file" class="size-4" />{{ t('common.measurementRecords') }}</button>
        <button class="app-btn app-btn--secondary" @click="openManager('metrics')"><AppIcon name="barChart" class="size-4" />{{ t('common.metricManagement') }}</button>
      </div>
    </PageHeader>

    <NuxtLink v-if="store.canWrite.value && settings?.heightCm == null" :to="localePath('/settings')" class="mb-6 flex items-center justify-between rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
      <span>{{ t('home.setHeightNotice') }}</span><span>{{ t('common.goToSettings') }} →</span>
    </NuxtLink>

    <NuxtLink v-if="store.canWrite.value && (settings.desiredWeightMinimum == null || settings.desiredWeightMaximum == null)" :to="localePath('/settings')" class="mb-6 flex items-center justify-between rounded-2xl border border-default bg-elevated px-4 py-3 text-sm text-muted">
      <span>{{ t('home.setWeightTargetNotice') }}</span><span>{{ t('common.goToSettings') }} →</span>
    </NuxtLink>

    <section class="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article v-for="card in cards" :key="card.label" class="app-card min-w-0 p-5">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-3"><span class="app-icon-tile"><AppIcon :name="card.icon" class="size-6" /></span><span class="text-sm font-bold text-[#253d59]">{{ card.label }}</span></div>
          <span v-if="card.change != null" class="app-pill">{{ card.change > 0 ? '↗' : '↘' }} {{ Math.abs(card.change) }} {{ card.unit }}</span>
        </div>
        <div class="mt-2 grid grid-cols-[minmax(0,1fr)_95px] items-end gap-2">
          <div class="min-w-0">
            <div class="flex items-baseline gap-1.5"><strong class="app-value text-[29px] font-extrabold leading-tight">{{ card.value ?? '—' }}</strong><span class="text-sm text-[#69809b]">{{ card.unit }}</span></div>
            <p v-if="card.change != null" class="mt-2 text-xs font-medium" :class="card.change <= 0 ? 'text-[#08aa63]' : 'text-[#d39b2c]'">{{ t('home.sincePrevious') }} {{ card.change > 0 ? '+' : '' }}{{ card.change }} {{ card.unit }}</p>
            <p v-else class="mt-2 text-xs text-[#7b8ba2]">{{ t('home.latestValidRecord') }}</p>
          </div>
          <MetricSparkline :values="card.values" :color="card.color" />
        </div>
        <p class="mt-3 truncate text-[11px] text-[#8798ad]">{{ t('home.recordedAt') }}：{{ formatLastMeasuredAt(card.measuredAt) }}</p>
        <p v-if="card.icon === 'weight' && latestSingleMissing.weight" class="mt-2 text-xs text-muted">{{ t('makeup.singleMissing', { date: latestSingleMissing.weight }) }}<button v-if="store.canWrite.value" type="button" class="ml-2 font-medium text-primary hover:underline" @click="openMakeup('weight')">{{ t('makeup.singleAction') }}</button></p>
      </article>
    </section>

    <section class="app-card mb-4 p-5 sm:p-6">
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="app-section-heading"><span class="app-icon-tile"><AppIcon name="run" class="size-6" /></span><div><h2>{{ t('home.behavior.title') }}</h2><p>{{ t('home.behavior.description') }}</p></div></div>
        <div class="flex flex-wrap items-center gap-2">
          <button v-if="store.canWrite.value" class="app-btn app-btn--primary" :aria-label="`＋ ${t('common.sleep')}`" @click="openBehaviorDialog('sleep')"><AppIcon name="plus" class="size-4" />{{ t('common.sleep') }}</button>
          <button v-if="store.canWrite.value" class="app-btn app-btn--primary" :aria-label="`＋ ${t('common.training')}`" @click="openBehaviorDialog('training')"><AppIcon name="plus" class="size-4" />{{ t('common.training') }}</button>
          <NuxtLink :to="localePath('/behavior')" class="app-btn app-btn--outline">{{ t('home.behavior.open') }}<AppIcon name="arrowRight" class="size-4" /></NuxtLink>
        </div>
      </div>
      <div class="grid gap-3 sm:grid-cols-3">
        <article class="app-inner-card flex items-start gap-3 p-4"><span class="app-icon-tile app-icon-tile--blue"><AppIcon name="run" class="size-6" /></span><div class="min-w-0"><p class="text-sm font-semibold text-[#526b8b]">{{ t('home.behavior.todayTraining') }}</p><strong class="app-value mt-1 block text-2xl font-extrabold">{{ t('common.minutes', { count: todayTraining }) }}</strong><p class="mt-1 text-xs text-[#8a9ab0]">{{ t('home.behavior.todayTrainingHint') }}</p><p v-if="latestSingleMissing.training" class="mt-2 text-xs text-muted">{{ t('makeup.singleMissing', { date: latestSingleMissing.training }) }}<button v-if="store.canWrite.value" type="button" class="ml-2 font-medium text-primary hover:underline" @click="openMakeup('training')">{{ t('makeup.singleAction') }}</button></p></div></article>
        <article class="app-inner-card flex items-start gap-3 p-4"><span class="app-icon-tile app-icon-tile--purple"><AppIcon name="moon" class="size-6" /></span><div class="min-w-0"><p class="text-sm font-semibold text-[#526b8b]">{{ t('home.behavior.latestSleep') }}</p><strong class="app-value mt-1 block text-2xl font-extrabold">{{ latestSleep ? durationLabel(latestSleep.durationMinutes) : t('common.noRecords') }}</strong><p class="mt-1 text-xs text-[#8a9ab0]">{{ t('home.behavior.sleepGoal', { hours: settings.sleepGoalHours }) }}</p><p v-if="latestSingleMissing.sleep" class="mt-2 text-xs text-muted">{{ t('makeup.singleMissing', { date: latestSingleMissing.sleep }) }}<button v-if="store.canWrite.value" type="button" class="ml-2 font-medium text-primary hover:underline" @click="openMakeup('sleep')">{{ t('makeup.singleAction') }}</button></p></div></article>
        <article class="app-inner-card flex items-start gap-3 p-4"><span class="app-icon-tile"><AppIcon name="streak" class="size-6" /></span><div class="min-w-0"><p class="text-sm font-semibold text-[#526b8b]">{{ t('home.behavior.streak') }}</p><strong class="app-value mt-1 block text-2xl font-extrabold">{{ t('common.days', { count: recordingStreak }) }}</strong><p class="mt-1 text-xs text-[#8a9ab0]">{{ t('home.behavior.streakHint') }}</p><p v-if="latestMissingDay" class="mt-2 text-xs text-warning">{{ t('makeup.latestMissing', { date: latestMissingDay }) }}</p><button v-if="latestMissingDay && store.canWrite.value" type="button" class="mt-2 text-sm font-semibold text-primary hover:underline" @click="openMakeup('all')">{{ t('makeup.action') }}</button></div></article>
      </div>
    </section>

    <section class="grid gap-4 xl:h-[405px] xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,.75fr)]">
      <article data-testid="weight-trend-card" class="app-card h-full overflow-hidden p-5 sm:p-6">
        <div class="mb-5 flex items-start justify-between gap-3">
          <div class="app-section-heading"><span class="app-icon-tile"><AppIcon name="chart" class="size-6" /></span><div><h2>{{ t('home.insights.title') }}</h2><p>{{ t('home.insights.description') }}</p></div></div>
          <NuxtLink :to="localePath('/analysis')" class="shrink-0 text-sm font-semibold text-primary">{{ t('home.insights.open') }} →</NuxtLink>
        </div>
        <div data-testid="smart-insights" class="grid gap-3 md:grid-cols-3">
          <article v-for="insight in featuredInsights" :key="insight.code" data-testid="smart-insight-card" class="app-inner-card min-w-0 p-4">
            <div class="flex items-center justify-between gap-2"><span class="app-icon-tile" :class="insight.code === 'training_duration' ? 'app-icon-tile--orange' : insight.code === 'sleep_score' ? 'app-icon-tile--purple' : ''"><AppIcon :name="insight.icon" class="size-5" /></span><span class="text-xs font-semibold text-primary">{{ trendSymbol(insight.direction) }} {{ insight.trendLabel }}</span></div>
            <p class="mt-4 text-sm font-semibold text-[#526b8b]">{{ insight.title }}</p>
            <p class="mt-1 flex items-baseline gap-1"><strong class="app-value text-2xl font-extrabold">{{ insight.latest }}</strong><span class="text-xs text-muted">{{ insight.unit }}</span></p>
            <MetricSparkline :values="insight.values" :color="insight.color" :label="t('home.insights.sparklineLabel', { name: insight.title })" />
            <p class="mt-2 truncate text-xs text-muted" :title="insight.changeLabel">{{ insight.changeLabel }}</p>
          </article>
        </div>
        <p class="mt-4 line-clamp-2 text-xs leading-5 text-muted">{{ smartSummary }}</p>
      </article>

      <article data-testid="recent-records-card" class="app-card flex h-full min-h-0 flex-col overflow-hidden rounded-3xl p-5 sm:p-6">
        <div class="mb-2 shrink-0">
          <div>
            <h2 class="font-bold">{{ t('home.recent.title') }}</h2>
            <p class="mt-1 text-xs text-muted">{{ t('home.recent.description', { count: todayCount }) }}</p>
          </div>
        </div>
        <div data-testid="recent-records-viewport" class="relative min-h-0 flex-1 overflow-hidden">
          <UnifiedRecordList v-if="recentRecords.length" :items="recentRecords" compact />
          <div v-else class="grid min-h-64 place-items-center text-center text-sm text-muted">
            <div><p class="mb-2 text-3xl">⌁</p><p>{{ t('home.recent.empty') }}</p></div>
          </div>
          <div v-if="recentRecords.length" class="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-default to-transparent" />
        </div>
        <NuxtLink :to="localePath('/history')" class="mt-2 shrink-0 border-t border-default pt-3 text-center text-sm font-medium text-primary">{{ t('home.recent.open') }} →</NuxtLink>
      </article>
    </section>

    <section class="app-card mt-4 p-5 sm:p-6">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3"><div class="app-section-heading"><span class="app-icon-tile app-icon-tile--blue"><AppIcon name="chart" class="size-6" /></span><div><h2>{{ t('home.weightTrend.chartTitle') }}</h2><p>{{ t('home.weightTrend.description') }}</p></div></div><NuxtLink :to="localePath('/analysis')" class="text-sm font-semibold text-primary hover:underline">{{ t('home.weightTrend.viewFullAnalysis') }} →</NuxtLink></div>
      <div class="mb-2 flex flex-wrap gap-2"><label v-for="period in ([3, 7, 30, 90] as const)" :key="period" class="flex items-center gap-2 rounded-lg border border-default px-2.5 py-1.5 text-xs"><input v-model="visibleMovingAverages" type="checkbox" :value="period" class="size-3.5 accent-emerald-500">{{ t('common.dayAverage', { count: period }) }}</label></div>
      <ClientOnly><MetricChart :points="analytics?.points ?? []" :moving-averages="analytics?.movingAverages" :visible-moving-averages="visibleMovingAverages" :target-minimum="settings.desiredWeightMinimum" :target-maximum="settings.desiredWeightMaximum" metric-code="weight" :unit="analytics?.metric.unit ?? 'kg'" height="340px" /><template #fallback><div class="grid h-[340px] place-items-center text-sm text-muted">{{ t('common.loadingChart') }}</div></template></ClientOnly>
    </section>

    <MeasurementDialog v-if="store.canWrite.value" v-model:open="dialogOpen" />
    <BehaviorDialog v-if="store.canWrite.value" v-model:open="behaviorDialogOpen" :kind="behaviorDialogKind" />
    <ManagerDialog v-model:open="managerDialogOpen" :kind="managerDialogKind" />
    <MakeupDialog v-if="store.canWrite.value" v-model:open="makeupOpen" :date="makeupDate" :kind="makeupKind" />
  </div>
</template>
