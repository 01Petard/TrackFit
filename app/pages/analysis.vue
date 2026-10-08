<script setup lang="ts">
import type { MovingAveragePeriod } from '../../shared/types/api'
import { analyzeWeightForecast } from '../../shared/utils/weight-forecast'
import dayjs from 'dayjs'

const { t } = useI18n()
const { metricName } = useTrackFitI18n()
const ranges = computed(() => ['24h', '7d', '30d', '90d', 'all'].map(value => ({ label: t(`range.${value}`), value })))
const range = ref('30d')
const metricCode = ref('weight')
const compareCode = ref('')
const visibleMovingAverages = ref<MovingAveragePeriod[]>([7, 30, 90])
const store = useTrackFitData()
await store.ensureLoaded()
const metrics = store.metrics
range.value = store.settings.value.defaultDateRange

const start = computed(() => {
  const amount = { '24h': [24, 'hour'], '7d': [7, 'day'], '30d': [30, 'day'], '90d': [90, 'day'] }[range.value] as [number, dayjs.ManipulateType] | undefined
  return amount ? dayjs().subtract(amount[0], amount[1]).toISOString() : undefined
})
const primary = computed(() => store.getAnalytics(metricCode.value, start.value))
const secondary = computed(() => compareCode.value ? store.getAnalytics(compareCode.value, start.value) : null)
const weightForecast = computed(() => analyzeWeightForecast(store.getAnalytics('weight')))
const weightProjections = computed(() => weightForecast.value.projections.filter(item => item.period !== 3))
const hasWeightProjection = computed(() => weightProjections.value.some(item => item.value != null))
const status = store.status
const settings = store.settings
const weightTargetStatus = computed(() => {
  const latest = store.getAnalytics('weight')?.summary?.latest
  const minimum = settings.value.desiredWeightMinimum
  const maximum = settings.value.desiredWeightMaximum
  if (latest == null || minimum == null || maximum == null) return null
  if (latest < minimum) return { label: t('analysis.target.below', { amount: Number((minimum - latest).toFixed(2)) }), class: 'text-warning' }
  if (latest > maximum) return { label: t('analysis.target.above', { amount: Number((latest - maximum).toFixed(2)) }), class: 'text-warning' }
  return { label: t('analysis.target.within'), class: 'text-primary' }
})
const reportPeriod = ref<'week' | 'month'>('week')
const report = computed(() => store.getPeriodReport(reportPeriod.value))
const correlations = computed(() => store.getBehaviorCorrelations().slice(0, 8))
const factorLabels = computed(() => ({
  trainingDuration: t('analysis.trainingDuration'),
  sleepDuration: t('analysis.sleepDuration'),
  sleepQuality: t('analysis.sleepQuality'),
}))
const reportPeriods = computed(() => ([{ value: 'week' as const, label: t('analysis.thisWeek') }, { value: 'month' as const, label: t('analysis.thisMonth') }]))

const summaryCards = computed(() => {
  const summary = primary.value?.summary
  if (!summary) return []
  return [
    { label: t('analysis.latest'), icon: 'weight' as const, value: summary.latest, showUnit: true },
    { label: t('analysis.sincePrevious'), icon: 'chart' as const, value: summary.previousChange == null ? '—' : `${summary.previousChange > 0 ? '+' : ''}${summary.previousChange}`, showUnit: true },
    { label: t('analysis.rangeChange'), icon: 'arrowRight' as const, value: `${summary.totalChange > 0 ? '+' : ''}${summary.totalChange}`, showUnit: true },
    { label: t('analysis.rangeAverage'), icon: 'barChart' as const, value: summary.average, showUnit: true },
    { label: t('analysis.minimumMaximum'), icon: 'target' as const, value: `${summary.minimum} / ${summary.maximum}`, showUnit: false },
    { label: t('analysis.recordCount'), icon: 'file' as const, value: summary.count, showUnit: false },
  ]
})

function minutesLabel(minutes: number | null): string {
  if (minutes == null) return '—'
  return t('common.hoursMinutes', { hours: Math.floor(minutes / 60), minutes: Math.round(minutes % 60) })
}
</script>

<template>
  <div>
    <PageHeader :title="t('analysis.title')" :description="t('analysis.description')" />

    <section class="app-card mb-5 grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
      <label class="text-xs font-medium text-muted">{{ t('analysis.timeRange') }}<select v-model="range" class="app-select mt-1.5 w-full border border-default text-sm text-highlighted"><option v-for="item in ranges" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
      <label class="text-xs font-medium text-muted">{{ t('analysis.primaryMetric') }}<select v-model="metricCode" class="app-select mt-1.5 w-full border border-default text-sm text-highlighted"><option v-for="metric in metrics.filter(item => item.enabled)" :key="metric.id" :value="metric.code">{{ metricName(metric) }}</option></select></label>
      <label class="text-xs font-medium text-muted">{{ t('analysis.compareMetric') }}<select v-model="compareCode" class="app-select mt-1.5 w-full border border-default text-sm text-highlighted"><option value="">{{ t('analysis.noComparison') }}</option><option v-for="metric in metrics.filter(item => item.enabled && item.code !== metricCode)" :key="metric.id" :value="metric.code">{{ metricName(metric) }}</option></select></label>
      <div class="border-t border-default pt-4 sm:col-span-2 xl:col-span-3">
        <p class="mb-2 text-xs text-muted">{{ t('analysis.averages') }}</p>
        <div class="flex flex-wrap gap-2">
          <label v-for="period in ([7, 30, 90] as const)" :key="period" class="flex min-h-10 items-center gap-2 rounded-full border border-default bg-white px-4 py-2 text-sm font-medium hover:bg-primary/10"><input v-model="visibleMovingAverages" type="checkbox" :value="period" class="size-4 accent-emerald-600">{{ t(`common.movingAverage.${period}`) }}</label>
        </div>
        <p class="mt-2 text-xs text-muted">{{ t('analysis.interpolationHint') }}</p>
      </div>
    </section>

    <section class="app-card mb-5 p-3 sm:p-6">
      <div class="app-section-heading mb-3 px-2"><span class="app-icon-tile"><AppIcon name="chart" class="size-6" /></span><div><h2>{{ primary ? `${metricName(primary.metric)} · ${t('analysis.title')}` : t('analysis.primaryMetric') }}</h2><p>{{ t('analysis.sliderHint') }}</p></div></div>
      <div v-if="status === 'pending'" class="grid h-[420px] place-items-center text-sm text-muted">{{ t('analysis.calculating') }}</div>
      <ClientOnly v-else-if="primary">
        <ComparisonChart
          :primary="primary"
          :secondary="compareCode ? secondary : null"
          :visible-moving-averages="visibleMovingAverages"
          :target-minimum="settings.desiredWeightMinimum"
          :target-maximum="settings.desiredWeightMaximum"
        />
        <template #fallback><div class="grid h-[420px] place-items-center text-sm text-muted">{{ t('common.loadingChart') }}</div></template>
      </ClientOnly>
    </section>

    <section v-if="summaryCards.length" class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <article v-for="card in summaryCards" :key="card.label" class="app-card p-4">
        <span class="app-icon-tile app-icon-tile--blue"><AppIcon :name="card.icon" class="size-5" /></span>
        <p class="mt-3 text-xs text-muted">{{ card.label }}</p>
        <strong class="app-value mt-1 block text-xl">{{ card.value }} <span v-if="card.showUnit" class="text-xs font-normal text-muted">{{ primary?.metric.unit }}</span></strong>
      </article>
    </section>

    <section class="app-card mt-5 rounded-3xl p-4 sm:p-6">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3"><div class="app-section-heading"><span class="app-icon-tile app-icon-tile--blue"><AppIcon name="chart" class="size-6" /></span><div><h2>{{ t('analysis.weightForecast') }}</h2><p>{{ t('analysis.weightForecastHint') }}</p></div></div><p v-if="weightTargetStatus" class="text-xs font-medium" :class="weightTargetStatus.class">{{ weightTargetStatus.label }}</p></div>
      <p v-if="hasWeightProjection && weightForecast.forecastDate" class="mb-4 text-sm text-muted">{{ t('analysis.forecastDate', { date: dayjs(weightForecast.forecastDate).format('YYYY-MM-DD') }) }}</p>
      <p v-else class="mb-4 text-sm text-muted">{{ t(weightForecast.stale ? 'analysis.forecastStale' : 'analysis.forecastInsufficient') }}</p>
      <div class="grid gap-3 sm:grid-cols-3">
        <article v-for="projection in weightProjections" :key="projection.period" class="app-inner-card p-4">
          <p class="text-sm font-medium text-muted">{{ t(`common.movingAverage.${projection.period}`) }}</p>
          <strong class="app-value mt-2 block text-xl">{{ projection.value == null ? '—' : projection.value.toFixed(2) }} <span v-if="projection.value != null" class="text-xs font-normal text-muted">kg</span></strong>
          <p class="mt-1 text-xs text-muted">{{ t(projection.direction ? `analysis.forecastDirection.${projection.direction}` : 'analysis.forecastNoData') }}</p>
        </article>
      </div>
      <p class="mt-4 text-xs text-muted">{{ t('analysis.forecastMethod') }}</p>

      <div class="mt-5 rounded-2xl border border-default bg-elevated/40 p-4">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="font-semibold">{{ t('analysis.recentWeightChange') }}</h3>
          <span v-if="weightForecast.recentChange" class="rounded-full bg-elevated px-2.5 py-1 text-xs font-semibold text-highlighted tabular-nums">{{ `${weightForecast.recentChange.changePercent > 0 ? '+' : ''}${weightForecast.recentChange.changePercent.toFixed(2)}%` }}</span>
        </div>
        <p v-if="weightForecast.recentChange" class="mt-2 text-sm text-muted">{{ t('analysis.recentWeightChangeDetail', { first: weightForecast.recentChange.first, latest: weightForecast.recentChange.latest }) }}</p>
        <p v-else class="mt-2 text-sm text-muted">{{ t('analysis.recentWeightChangeInsufficient') }}</p>
      </div>

      <div class="mt-5 rounded-2xl border p-4" :class="weightForecast.fluctuation?.status === 'warning' ? 'border-error/30 bg-error/5' : 'border-default bg-elevated/40'">
        <div class="flex flex-wrap items-center gap-2"><h3 class="font-semibold">{{ t('analysis.weightFluctuation') }}</h3><span v-if="weightForecast.fluctuation" class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="weightForecast.fluctuation.status === 'warning' ? 'bg-error/10 text-error' : weightForecast.fluctuation.status === 'normal' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'">{{ t(`analysis.fluctuationStatus.${weightForecast.fluctuation.status}`) }}</span></div>
        <p v-if="weightForecast.fluctuation" class="mt-2 text-sm" :class="weightForecast.fluctuation.status === 'warning' ? 'text-error' : 'text-muted'">{{ t(`analysis.fluctuationDetail.${weightForecast.fluctuation.status}`, { latest: weightForecast.fluctuation.latest, previous: weightForecast.fluctuation.previous, change: `${weightForecast.fluctuation.changePercent > 0 ? '+' : ''}${weightForecast.fluctuation.changePercent}`, lower: weightForecast.fluctuation.lower.toFixed(2), upper: weightForecast.fluctuation.upper.toFixed(2) }) }}</p>
        <p v-else class="mt-2 text-sm text-muted">{{ t('analysis.fluctuationInsufficient') }}</p>
      </div>
    </section>

    <section class="app-card mt-5 rounded-3xl p-4 sm:p-6">
      <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div class="app-section-heading"><span class="app-icon-tile app-icon-tile--purple"><AppIcon name="sparkles" class="size-6" /></span><div><h2>{{ t('analysis.periodReport') }}</h2><p>{{ t('analysis.periodReportHint') }}</p></div></div><div class="flex rounded-xl bg-elevated p-1"><button v-for="item in reportPeriods" :key="item.value" class="rounded-lg px-4 py-2 text-sm" :class="reportPeriod === item.value ? 'bg-default font-medium text-primary shadow-sm' : 'text-muted'" @click="reportPeriod = item.value">{{ item.label }}</button></div></div>
      <div v-if="report" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article class="app-inner-card p-4"><span class="app-icon-tile app-icon-tile--orange"><AppIcon name="dumbbell" class="size-5" /></span><p class="mt-3 text-xs text-muted">{{ t('common.training') }}</p><strong class="app-value mt-2 block text-xl">{{ t('common.minutes', { count: report.training.totalMinutes }) }}</strong><p class="mt-1 text-xs text-muted">{{ t('analysis.trainingSummary', { count: report.training.count, minutes: report.training.previousTotalMinutes }) }}</p></article>
        <article class="app-inner-card p-4"><span class="app-icon-tile app-icon-tile--purple"><AppIcon name="moon" class="size-5" /></span><p class="mt-3 text-xs text-muted">{{ t('analysis.averageSleep') }}</p><strong class="app-value mt-2 block text-xl">{{ minutesLabel(report.sleep.averageMinutes) }}</strong><p class="mt-1 text-xs text-muted">{{ t('analysis.sleepSummary', { days: report.sleep.goalDays, quality: report.sleep.averageQuality == null ? '—' : `${report.sleep.averageQuality}%` }) }}</p></article>
        <article v-for="metric in report.bodyMetrics.slice(0, 2)" :key="metric.code" class="app-inner-card p-4"><span class="app-icon-tile"><AppIcon :name="metric.code === 'weight' ? 'weight' : 'barChart'" class="size-5" /></span><p class="mt-3 text-xs text-muted">{{ t('analysis.metricDailyAverage', { metric: metricName(metric) }) }}</p><strong class="app-value mt-2 block text-xl">{{ metric.average ?? '—' }} <span class="text-xs font-normal text-muted">{{ metric.unit }}</span></strong><p class="mt-1 text-xs text-muted">{{ t('analysis.metricChange', { change: metric.change == null ? '—' : `${metric.change > 0 ? '+' : ''}${metric.change}`, volatility: metric.volatility ?? '—' }) }}</p></article>
      </div>
    </section>

    <section class="app-card mt-5 rounded-3xl p-4 sm:p-6">
      <div class="app-section-heading mb-4">
        <span class="app-icon-tile app-icon-tile--blue"><AppIcon name="link" class="size-6" /></span>
        <div class="flex items-center gap-1">
          <h2>{{ t('analysis.correlations') }}</h2>
          <UPopover mode="hover" enable-touch arrow :content="{ align: 'start', collisionPadding: 12 }" :ui="{ content: 'w-80 max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto p-4' }">
            <button type="button" :aria-label="t('analysis.correlationsHelpTitle')" class="flex size-8 shrink-0 items-center justify-center rounded-full text-muted opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><AppIcon name="info" class="size-4" /></button>
            <template #content>
              <div class="space-y-2 text-sm leading-relaxed text-muted">
                <strong class="block text-highlighted">{{ t('analysis.correlationsHelpTitle') }}</strong>
                <p>{{ t('analysis.correlationsDescription') }}</p>
                <p>{{ t('analysis.correlationsCoefficientHelp') }}</p>
                <p>{{ t('analysis.correlationsTimingHelp') }}</p>
              </div>
            </template>
          </UPopover>
        </div>
      </div>
      <div v-if="correlations.length" class="grid gap-3 sm:grid-cols-2">
        <article v-for="item in correlations" :key="`${item.metricCode}-${item.factor}-${item.lagDays}`" class="flex items-center justify-between gap-4 rounded-2xl border border-default p-4">
          <div class="min-w-0">
            <div class="flex items-center gap-1">
              <strong class="text-sm">{{ metricName({ code: item.metricCode, name: item.metricName }) }} × {{ factorLabels[item.factor] }}</strong>
              <UPopover mode="hover" enable-touch arrow :content="{ align: 'start', collisionPadding: 12 }" :ui="{ content: 'w-72 max-w-[calc(100vw-1.5rem)] p-4' }">
                <button type="button" :aria-label="t('analysis.correlationResultHelp', { metric: metricName({ code: item.metricCode, name: item.metricName }), factor: factorLabels[item.factor] })" class="flex size-8 shrink-0 items-center justify-center rounded-full text-muted opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><AppIcon name="info" class="size-4" /></button>
                <template #content>
                  <p class="text-sm leading-relaxed text-highlighted">{{ t(item.coefficient === 0 ? 'analysis.correlationNoPattern' : `analysis.correlationPattern.${item.factor}.${item.coefficient > 0 ? 'up' : 'down'}`, { metric: metricName({ code: item.metricCode, name: item.metricName }) }) }}</p>
                  <p class="mt-2 text-xs leading-relaxed text-muted">{{ t('analysis.correlationsCaution') }}</p>
                </template>
              </UPopover>
            </div>
            <p class="mt-1 text-xs text-muted">{{ t(item.lagDays === 0 ? 'analysis.sameDay' : 'analysis.daysAhead', { count: item.lagDays }) }} · {{ t('analysis.overlapDays', { count: item.sampleSize }) }}</p>
          </div>
          <span class="shrink-0 rounded-xl px-3 py-2 text-sm font-bold" :class="item.coefficient >= 0 ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'">{{ item.coefficient > 0 ? '+' : '' }}{{ item.coefficient }}</span>
        </article>
      </div>
      <div v-else class="rounded-2xl bg-elevated p-5 text-sm text-muted">{{ t('analysis.insufficientOverlap') }}</div>
    </section>
  </div>
</template>
