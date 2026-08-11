<script setup lang="ts">
import type { MovingAveragePeriod } from '../../shared/types/api'
import { buildMetricTrendInsight } from '../../shared/utils/analytics'
import dayjs from 'dayjs'

const dialogOpen = ref(false)
const behaviorDialogOpen = ref(false)
const behaviorDialogKind = ref<'training' | 'sleep'>('training')
const managerDialogOpen = ref(false)
const managerDialogKind = ref<'records' | 'metrics'>('records')
const start = dayjs().subtract(7, 'day').toISOString()
const store = useTrackFitData()
const { locale, t } = useI18n()
const localePath = useLocalePath()
const { formatDescriptor, metricName } = useTrackFitI18n()
await store.ensureLoaded()
const analytics = computed(() => store.getAnalytics('weight', start))
const latestAnalytics = computed(() => new Map(
  ['weight', 'waist', 'body_fat'].map(code => [code, store.getAnalytics(code)]),
))
const weightMetricId = computed(() => store.metrics.value.find(metric => metric.code === 'weight')?.id)
const latestWeightRecord = computed(() => weightMetricId.value == null
  ? undefined
  : store.listMeasurements({ page: 1, pageSize: 1, metricId: weightMetricId.value }).items[0])
const settings = store.settings
const visibleMovingAverages = ref<MovingAveragePeriod[]>([3, 7, 30, 90])
const overviewTime = useState('overview-time', () => Date.now())

function openManager(kind: 'records' | 'metrics') {
  managerDialogKind.value = kind
  managerDialogOpen.value = true
}

function openBehaviorDialog(kind: 'training' | 'sleep') {
  behaviorDialogKind.value = kind
  behaviorDialogOpen.value = true
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
const cards = computed(() => [
  { label: t('metrics.weight'), value: latestAnalytics.value.get('weight')?.summary?.latest, unit: 'kg', change: latestAnalytics.value.get('weight')?.summary?.previousChange, measuredAt: latestAnalytics.value.get('weight')?.points.at(-1)?.measuredAt },
  { label: 'BMI', value: latestWeightRecord.value?.bmi, unit: '', change: null, measuredAt: latestWeightRecord.value?.measuredAt },
  { label: t('metrics.waist'), value: latestAnalytics.value.get('waist')?.summary?.latest, unit: 'cm', change: null, measuredAt: latestAnalytics.value.get('waist')?.points.at(-1)?.measuredAt },
  { label: t('metrics.bodyFat'), value: latestAnalytics.value.get('body_fat')?.summary?.latest, unit: '%', change: null, measuredAt: latestAnalytics.value.get('body_fat')?.points.at(-1)?.measuredAt },
])
const weightTargetStatus = computed(() => {
  const latest = latestAnalytics.value.get('weight')?.summary?.latest
  const minimum = settings.value.desiredWeightMinimum
  const maximum = settings.value.desiredWeightMaximum
  if (latest == null || minimum == null || maximum == null) return null
  if (latest < minimum) return { label: t('home.target.below', { amount: Number((minimum - latest).toFixed(2)) }), class: 'text-warning' }
  if (latest > maximum) return { label: t('home.target.above', { amount: Number((latest - maximum).toFixed(2)) }), class: 'text-warning' }
  return { label: t('home.target.within'), class: 'text-primary' }
})
const insightColors = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6', '#6366f1', '#ec4899']
const fixedInsightColors: Record<string, string> = { weight: '#10b981', waist: '#0ea5e9', body_fat: '#8b5cf6' }
const smartInsights = computed(() => store.metrics.value.filter(metric => metric.enabled).flatMap((metric, index) => {
  const metricAnalytics = store.getAnalytics(metric.code, start)
  if (!metricAnalytics?.summary) return []
  const insight = buildMetricTrendInsight(
    metricAnalytics,
    settings.value.desiredWeightMinimum,
    settings.value.desiredWeightMaximum,
  )
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
const smartSummary = computed(() => {
  if (!dashboardInsights.value.length) return t('home.insights.emptySummary')
  const trends = dashboardInsights.value.map(item => `${item.name} ${item.trendLabel}`).join(locale.value === 'zh' ? '，' : ', ')
  const weight = dashboardInsights.value.find(item => item.code === 'weight')
  return t('home.insights.summary', { count: dashboardInsights.value.length, trends, evaluation: weight?.evaluation ?? t('home.insights.keepRecording') })
})

function formatLastMeasuredAt(measuredAt?: string): string {
  if (!measuredAt) return t('home.noValidRecord')
  const elapsed = overviewTime.value - new Date(measuredAt).getTime()
  if (elapsed < 0 || elapsed > 7 * 86_400_000) return new Intl.DateTimeFormat(locale.value === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(measuredAt))
  if (elapsed < 3_600_000) return t('home.minutesAgo', { count: Math.max(1, Math.floor(elapsed / 60_000)) })
  if (elapsed < 86_400_000) return t('home.hoursAgo', { count: Math.floor(elapsed / 3_600_000) })
  return t('home.daysAgo', { count: Math.floor(elapsed / 86_400_000) })
}

function durationLabel(minutes: number): string {
  return t('common.hoursMinutes', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
}

function insightToneClass(tone: 'positive' | 'warning' | 'neutral'): string {
  if (tone === 'positive') return 'bg-primary/10 text-primary'
  if (tone === 'warning') return 'bg-warning/10 text-warning'
  return 'bg-elevated text-muted'
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
      <div class="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
        <button v-if="store.canWrite.value" class="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20" @click="dialogOpen = true">＋ {{ t('home.quickRecord') }}</button>
        <button class="rounded-xl border border-default px-4 py-3 text-center text-sm font-medium hover:border-primary/40 hover:text-primary" @click="openManager('records')">{{ t('common.measurementRecords') }}</button>
        <button class="rounded-xl border border-default px-5 py-3 text-center text-sm font-medium hover:border-primary/40 hover:text-primary" @click="openManager('metrics')">{{ t('common.metricManagement') }}</button>
      </div>
    </PageHeader>

    <NuxtLink v-if="store.canWrite.value && settings?.heightCm == null" :to="localePath('/settings')" class="mb-6 flex items-center justify-between rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
      <span>{{ t('home.setHeightNotice') }}</span><span>{{ t('common.goToSettings') }} →</span>
    </NuxtLink>

    <NuxtLink v-if="store.canWrite.value && (settings.desiredWeightMinimum == null || settings.desiredWeightMaximum == null)" :to="localePath('/settings')" class="mb-6 flex items-center justify-between rounded-2xl border border-default bg-elevated px-4 py-3 text-sm text-muted">
      <span>{{ t('home.setWeightTargetNotice') }}</span><span>{{ t('common.goToSettings') }} →</span>
    </NuxtLink>

    <section class="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <article v-for="card in cards" :key="card.label" class="app-card rounded-2xl p-4 sm:p-5">
        <p class="text-xs font-medium text-muted">{{ card.label }}</p>
        <div class="mt-2 flex items-baseline gap-1.5">
          <strong class="text-2xl tracking-tight sm:text-3xl">{{ card.value ?? '—' }}</strong>
          <span class="text-xs text-muted">{{ card.unit }}</span>
        </div>
        <p v-if="card.change != null" class="mt-2 text-xs" :class="card.change <= 0 ? 'text-primary' : 'text-warning'">
          {{ t('home.sincePrevious') }} {{ card.change > 0 ? '+' : '' }}{{ card.change }} {{ card.unit }}
        </p>
        <p v-else class="mt-2 text-xs text-muted">{{ t('home.latestValidRecord') }}</p>
        <p class="mt-1 text-xs text-muted">{{ t('home.recordedAt') }}：{{ formatLastMeasuredAt(card.measuredAt) }}</p>
      </article>
    </section>

    <section class="mb-6">
      <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 class="font-bold">{{ t('home.behavior.title') }}</h2><p class="mt-1 text-xs text-muted">{{ t('home.behavior.description') }}</p></div>
        <div class="flex flex-wrap items-center gap-2">
          <button v-if="store.canWrite.value" class="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white" @click="openBehaviorDialog('sleep')">＋ {{ t('common.sleep') }}</button>
          <button v-if="store.canWrite.value" class="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white" @click="openBehaviorDialog('training')">＋ {{ t('common.training') }}</button>
          <NuxtLink :to="localePath('/behavior')" class="rounded-xl border border-primary px-4 py-3 text-sm font-medium text-primary">{{ t('home.behavior.open') }} →</NuxtLink>
        </div>
      </div>
      <div class="grid gap-3 sm:grid-cols-3">
        <article class="app-card rounded-2xl p-4"><p class="text-xs text-muted">{{ t('home.behavior.todayTraining') }}</p><strong class="mt-2 block text-xl">{{ t('common.minutes', { count: todayTraining }) }}</strong><p class="mt-1 text-xs text-muted">{{ t('home.behavior.todayTrainingHint') }}</p></article>
        <article class="app-card rounded-2xl p-4"><p class="text-xs text-muted">{{ t('home.behavior.latestSleep') }}</p><strong class="mt-2 block text-xl">{{ latestSleep ? durationLabel(latestSleep.durationMinutes) : t('common.noRecords') }}</strong><p class="mt-1 text-xs text-muted">{{ t('home.behavior.sleepGoal', { hours: settings.sleepGoalHours }) }}</p></article>
        <article class="app-card rounded-2xl p-4"><p class="text-xs text-muted">{{ t('home.behavior.streak') }}</p><strong class="mt-2 block text-xl">{{ t('common.days', { count: recordingStreak }) }}</strong><p class="mt-1 text-xs text-muted">{{ t('home.behavior.streakHint') }}</p></article>
      </div>
    </section>

    <section class="app-card mb-6 overflow-hidden rounded-3xl">
      <div class="border-b border-default bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 sm:p-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex gap-3">
            <span class="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-bold text-white shadow-lg shadow-primary/20">✦</span>
            <div>
              <h2 class="font-bold">{{ t('home.insights.title') }}</h2>
              <p class="mt-1 text-xs text-muted">{{ t('home.insights.description') }}</p>
            </div>
          </div>
          <NuxtLink :to="localePath('/analysis')" class="text-sm font-medium text-primary">{{ t('home.insights.open') }} →</NuxtLink>
        </div>
        <p class="mt-4 max-w-4xl text-sm leading-6 text-highlighted">{{ smartSummary }}</p>
      </div>

      <div v-if="dashboardInsights.length" data-testid="smart-insights" tabindex="0" :aria-label="t('home.insights.scrollLabel')" class="scrollbar-hidden grid grid-cols-1 gap-4 p-4 sm:p-6 lg:flex lg:snap-x lg:snap-mandatory lg:overflow-x-auto lg:overscroll-x-contain">
        <article v-for="insight in dashboardInsights" :key="insight.code" data-testid="smart-insight-card" class="rounded-2xl border border-default bg-default p-4 lg:w-[calc(33.333333%_-_0.666667rem)] lg:min-w-[calc(33.333333%_-_0.666667rem)] lg:shrink-0 lg:snap-start">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs text-muted">{{ insight.name }}</p>
              <p class="mt-1 flex items-baseline gap-1.5"><strong class="text-2xl">{{ insight.latest }}</strong><span class="text-xs text-muted">{{ insight.unit }}</span></p>
            </div>
            <span class="rounded-lg px-2.5 py-1 text-xs font-medium" :class="insightToneClass(insight.tone)">{{ trendSymbol(insight.direction) }} {{ insight.trendLabel }}</span>
          </div>
          <MetricSparkline :values="insight.values" :color="insight.color" :label="t('home.insights.sparklineLabel', { name: insight.name })" />
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-highlighted">{{ insight.changeLabel }}</span>
            <span class="text-muted">{{ t('common.recordCount', { count: insight.count }) }}</span>
          </div>
          <p class="mt-3 border-t border-default pt-3 text-xs leading-5 text-muted">{{ insight.evaluation }}</p>
        </article>
      </div>
      <div v-else class="grid min-h-48 place-items-center p-6 text-center">
        <div><p class="text-3xl text-primary">⌁</p><p class="mt-2 text-sm text-muted">{{ t('home.insights.empty') }}</p><button v-if="store.canWrite.value" class="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white" @click="dialogOpen = true">{{ t('home.insights.start') }}</button></div>
      </div>
    </section>

    <section class="grid gap-6 xl:h-[560px] xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,.75fr)]">
      <article data-testid="weight-trend-card" class="app-card h-full overflow-hidden rounded-3xl p-4 sm:p-6">
        <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 class="font-bold">{{ t('home.weightTrend.title') }}</h2>
            <p class="mt-1 text-xs text-muted">{{ t('home.weightTrend.description') }}</p>
            <p v-if="weightTargetStatus" class="mt-1 text-xs font-medium" :class="weightTargetStatus.class">{{ weightTargetStatus.label }}</p>
          </div>
          <NuxtLink :to="localePath('/analysis')" class="text-sm font-medium text-primary">{{ t('home.weightTrend.open') }} →</NuxtLink>
        </div>
        <div class="mb-2 flex flex-wrap gap-2">
          <label v-for="period in ([3, 7, 30, 90] as const)" :key="period" class="flex items-center gap-2 rounded-lg border border-default px-2.5 py-1.5 text-xs">
            <input v-model="visibleMovingAverages" type="checkbox" :value="period" class="size-3.5 accent-emerald-500">{{ t('common.dayAverage', { count: period }) }}
          </label>
        </div>
        <ClientOnly>
          <MetricChart
            :points="analytics?.points ?? []"
            :moving-averages="analytics?.movingAverages"
            :visible-moving-averages="visibleMovingAverages"
            :target-minimum="settings.desiredWeightMinimum"
            :target-maximum="settings.desiredWeightMaximum"
            metric-code="weight"
            :unit="analytics?.metric.unit ?? 'kg'"
            height="340px"
          />
          <template #fallback><div class="grid h-[340px] place-items-center text-sm text-muted">{{ t('common.loadingChart') }}</div></template>
        </ClientOnly>
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

    <MeasurementDialog v-if="store.canWrite.value" v-model:open="dialogOpen" />
    <BehaviorDialog v-if="store.canWrite.value" v-model:open="behaviorDialogOpen" :kind="behaviorDialogKind" />
    <ManagerDialog v-model:open="managerDialogOpen" :kind="managerDialogKind" />
  </div>
</template>
