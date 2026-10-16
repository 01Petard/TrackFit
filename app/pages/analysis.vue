<script setup lang="ts">
import type { CorrelationDto, MovingAveragePeriod } from '../../shared/types/api'
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
const chartPrimary = computed(() => store.getAnalytics(metricCode.value))
const chartSecondary = computed(() => compareCode.value ? store.getAnalytics(compareCode.value) : null)
const metricItems = computed(() => metrics.value.filter(item => item.enabled).map(item => ({ label: metricName(item), value: item.code })))
const comparisonItems = computed(() => [{ label: t('analysis.noComparison'), value: '__none__' }, ...metricItems.value.filter(item => item.value !== metricCode.value)])
const comparisonSelection = computed({
  get: () => compareCode.value || '__none__',
  set: (value: string) => { compareCode.value = value === '__none__' ? '' : value },
})
watch(metricCode, (value) => {
  if (compareCode.value === value) compareCode.value = ''
})
const weightForecast = computed(() => analyzeWeightForecast(store.getAnalytics('weight')))
const fluctuationScale = computed(() => {
  const fluctuation = weightForecast.value.fluctuation
  if (!fluctuation) return {}
  const padding = Math.max(fluctuation.previous * 0.005, Math.abs(fluctuation.latest - fluctuation.previous) * 0.15)
  const minimum = Math.min(fluctuation.lower, fluctuation.latest) - padding
  const maximum = Math.max(fluctuation.upper, fluctuation.latest) + padding
  const position = (value: number) => `${(value - minimum) / (maximum - minimum) * 100}%`
  return {
    '--range-start': position(fluctuation.lower),
    '--range-width': `${(fluctuation.upper - fluctuation.lower) / (maximum - minimum) * 100}%`,
    '--baseline': position(fluctuation.previous),
    '--marker': position(fluctuation.latest),
  }
})
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
const correlations = computed(() => store.getBehaviorCorrelations().filter(item => item.metricCode === 'weight'))
const correlationComparison = computed(() => store.getWeightCorrelationComparison())
const correlationDesktop = ref(false)
onMounted(() => {
  const query = window.matchMedia('(min-width: 1024px)')
  const update = () => {
    correlationDesktop.value = query.matches
  }
  update()
  query.addEventListener('change', update)
  onBeforeUnmount(() => query.removeEventListener('change', update))
})
const correlationPopoverPosition = computed(() => ({
  side: correlationDesktop.value ? 'right' : 'bottom',
  align: correlationDesktop.value ? 'center' : 'start',
  collisionPadding: 12,
} as const))
const correlationLags = [0, 1, 3, 7] as const
const correlationFactors: CorrelationDto['factor'][] = ['sleepDuration', 'sleepQuality', 'trainingDuration']
const correlationRows = computed(() => correlationFactors.map((factor) => {
  const results = correlations.value.filter(item => item.factor === factor)
  const cells = correlationLags.map(lagDays => ({ lagDays, result: results.find(item => item.lagDays === lagDays) }))
  let best: CorrelationDto | undefined
  for (const { result } of cells) {
    if (!result) continue
    if (!best || result.coefficient < best.coefficient) best = result
  }
  return {
    factor,
    comparison: correlationComparison.value?.results.find(item => item.factor === factor && item.lagDays === (best?.lagDays ?? 0)),
    cells: cells.map(cell => ({ ...cell, isBest: !!cell.result && cell.result === best })),
  }
}))
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
    { label: t('analysis.minimumMaximum'), icon: 'target' as const, value: { minimum: summary.minimum, maximum: summary.maximum }, showUnit: true },
    { label: t('analysis.recordCount'), icon: 'file' as const, value: summary.count, showUnit: true, unit: t('analysis.recordUnit') },
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
      <AppSelect v-model="range" :label="t('analysis.timeRange')" :items="ranges" />
      <AppSelect v-model="metricCode" :label="t('analysis.primaryMetric')" :items="metricItems" />
      <AppSelect v-model="comparisonSelection" :label="t('analysis.compareMetric')" :items="comparisonItems" />
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
      <ClientOnly v-else-if="chartPrimary">
        <ComparisonChart
          :primary="chartPrimary"
          :secondary="chartSecondary"
          :start="start"
          :visible-moving-averages="visibleMovingAverages"
          :target-minimum="settings.desiredWeightMinimum"
          :target-maximum="settings.desiredWeightMaximum"
        />
        <template #fallback><div class="grid h-[420px] place-items-center text-sm text-muted">{{ t('common.loadingChart') }}</div></template>
      </ClientOnly>
    </section>

    <section v-if="summaryCards.length" class="analysis-summary app-card grid grid-cols-2 overflow-hidden sm:grid-cols-3 xl:grid-cols-6">
      <article v-for="(card, index) in summaryCards" :key="card.label" class="analysis-stat min-w-0 px-4 py-4 sm:px-5">
        <div class="flex min-h-8 items-center gap-2.5">
          <span class="analysis-stat-icon app-icon-tile" :class="index === 0 ? '' : index === 3 ? 'app-icon-tile--purple' : 'app-icon-tile--blue'"><AppIcon :name="card.icon" class="size-4" /></span>
          <p class="text-xs font-medium text-muted">{{ card.label }}</p>
        </div>
        <div class="mt-3 flex min-h-11 flex-col justify-center">
          <dl v-if="typeof card.value === 'object'" class="grid gap-1">
            <div v-for="(value, key) in card.value" :key="key" class="flex items-baseline justify-between gap-2">
              <dt class="text-xs font-medium text-muted">{{ t(`analysis.${key}`) }}</dt>
              <dd class="app-value inline-flex flex-wrap items-baseline justify-end gap-x-1 text-base font-semibold leading-5">
                <span>{{ value }}</span>
                <span class="text-xs font-normal text-muted">{{ primary?.metric.unit }}</span>
              </dd>
            </div>
          </dl>
          <strong v-else class="app-value flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[22px] leading-none sm:text-2xl">
            <span>{{ card.value }}</span>
            <span v-if="card.showUnit" class="text-xs font-normal text-muted">{{ card.unit ?? primary?.metric.unit }}</span>
          </strong>
        </div>
      </article>
    </section>

    <section class="app-card mt-5 rounded-3xl p-4 sm:p-6">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3"><div class="app-section-heading"><span class="app-icon-tile app-icon-tile--blue"><AppIcon name="chart" class="size-6" /></span><div><h2>{{ t('analysis.weightForecast') }}</h2><p>{{ t('analysis.weightForecastHint') }}</p></div></div><p v-if="weightTargetStatus" class="text-xs font-medium" :class="weightTargetStatus.class">{{ weightTargetStatus.label }}</p></div>
      <p v-if="hasWeightProjection && weightForecast.forecastDate" class="mb-4 text-sm text-muted">{{ t('analysis.forecastDate', { date: dayjs(weightForecast.forecastDate).format('YYYY-MM-DD') }) }}</p>
      <p v-else class="mb-4 text-sm text-muted">{{ t(weightForecast.stale ? 'analysis.forecastStale' : 'analysis.forecastInsufficient') }}</p>
      <div class="weight-projections grid gap-2 md:grid-cols-3 md:gap-3">
        <article v-for="projection in weightProjections" :key="projection.period" class="weight-projection app-inner-card" :class="`weight-projection--${projection.period}`">
          <h3 class="weight-projection-heading flex min-w-0 items-center gap-2 text-xs font-medium">
            <span class="weight-projection-line shrink-0" aria-hidden="true" />
            {{ t(`common.movingAverage.${projection.period}`) }}
          </h3>
          <strong class="weight-projection-value app-value flex items-baseline gap-1 text-xl font-semibold">
            {{ projection.value == null ? '—' : projection.value.toFixed(2) }}
            <span v-if="projection.value != null" class="text-xs font-normal text-muted">kg</span>
          </strong>
          <span v-if="projection.direction" class="weight-projection-direction inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium" :title="t(`analysis.forecastDirection.${projection.direction}`)">
            <AppIcon name="arrowRight" class="size-3.5 shrink-0" :class="projection.direction === 'down' ? 'rotate-45' : projection.direction === 'up' ? '-rotate-45' : ''" />
            {{ t(`analysis.forecastDirectionShort.${projection.direction}`) }}
          </span>
          <span v-else class="text-right text-xs text-muted" :title="t('analysis.forecastNoData')">{{ t('analysis.forecastNoDataShort') }}</span>
        </article>
      </div>
      <p class="mt-4 text-xs text-muted">{{ t('analysis.forecastMethod') }}</p>

      <div class="weight-insights mt-4 grid gap-3 md:grid-cols-2">
        <article class="weight-insight app-inner-card min-w-0 px-4 py-3">
          <h3 class="flex min-h-6 items-center text-sm font-semibold">{{ t('analysis.recentWeightChange') }}</h3>
          <template v-if="weightForecast.recentChange">
            <div class="my-3 flex items-center gap-2 text-blue-700">
              <AppIcon name="arrowRight" class="size-5 shrink-0" :class="weightForecast.recentChange.changePercent < 0 ? 'rotate-45' : weightForecast.recentChange.changePercent > 0 ? '-rotate-45' : ''" />
              <strong class="text-2xl font-semibold tracking-tight tabular-nums">{{ `${weightForecast.recentChange.changePercent > 0 ? '+' : ''}${weightForecast.recentChange.changePercent.toFixed(2)}%` }}</strong>
            </div>
            <dl class="weight-comparison flex items-center gap-4">
              <div>
                <dt>{{ t('analysis.firstOfSeven') }}</dt>
                <dd>{{ weightForecast.recentChange.first.toFixed(2) }} <span>kg</span></dd>
              </div>
              <div class="weight-comparison-connector" aria-hidden="true"><AppIcon name="arrowRight" class="size-5" /></div>
              <div>
                <dt>{{ t('analysis.latest') }}</dt>
                <dd>{{ weightForecast.recentChange.latest.toFixed(2) }} <span>kg</span></dd>
              </div>
            </dl>
          </template>
          <p v-else class="mt-4 text-sm text-muted">{{ t('analysis.recentWeightChangeInsufficient') }}</p>
        </article>

        <article class="weight-insight app-inner-card min-w-0 px-4 py-3" :class="{ 'weight-insight--warning': weightForecast.fluctuation?.status === 'warning' }">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold">{{ t('analysis.weightFluctuation') }}</h3>
            <span v-if="weightForecast.fluctuation" class="weight-fluctuation-status rounded-full px-2.5 py-1 text-xs font-medium" :class="`weight-fluctuation--${weightForecast.fluctuation.status}`" :title="t(`analysis.fluctuationStatus.${weightForecast.fluctuation.status}`)">{{ t(`analysis.fluctuationLabel.${weightForecast.fluctuation.status}`) }}</span>
          </div>
          <template v-if="weightForecast.fluctuation">
            <div class="my-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <strong class="weight-fluctuation-value text-2xl font-semibold tracking-tight tabular-nums" :class="`weight-fluctuation--${weightForecast.fluctuation.status}`">{{ `${weightForecast.fluctuation.changePercent > 0 ? '+' : ''}${weightForecast.fluctuation.changePercent.toFixed(2)}%` }}</strong>
              <span class="text-xs text-muted">{{ t('analysis.previousWeight', { value: weightForecast.fluctuation.previous.toFixed(2) }) }}</span>
            </div>
            <div class="flex items-baseline justify-between gap-2 text-xs">
              <span class="text-muted">{{ t('analysis.latest') }}</span>
              <span class="font-semibold text-highlighted tabular-nums">{{ weightForecast.fluctuation.latest.toFixed(2) }} <span class="font-normal text-muted">kg</span></span>
            </div>
            <div class="weight-range my-2.5" :class="`weight-fluctuation--${weightForecast.fluctuation.status}`" :style="fluctuationScale" role="img" :aria-label="t(`analysis.fluctuationDetail.${weightForecast.fluctuation.status}`, { latest: weightForecast.fluctuation.latest, previous: weightForecast.fluctuation.previous, change: `${weightForecast.fluctuation.changePercent > 0 ? '+' : ''}${weightForecast.fluctuation.changePercent}`, lower: weightForecast.fluctuation.lower.toFixed(2), upper: weightForecast.fluctuation.upper.toFixed(2) })">
              <span class="weight-range-band" />
              <span class="weight-range-baseline" />
              <span class="weight-range-marker" />
            </div>
            <div class="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted">
              <span>{{ t('analysis.fluctuationReference') }}</span>
              <span class="tabular-nums">{{ weightForecast.fluctuation.lower.toFixed(2) }}–{{ weightForecast.fluctuation.upper.toFixed(2) }} kg</span>
            </div>
          </template>
          <p v-else class="mt-4 text-sm text-muted">{{ t('analysis.fluctuationInsufficient') }}</p>
        </article>
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
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div class="app-section-heading min-w-0 flex-1 basis-48">
          <span class="app-icon-tile app-icon-tile--blue"><AppIcon name="link" class="size-6" /></span>
          <div>
            <div class="flex items-center gap-1">
              <h2>{{ t('analysis.correlations') }}</h2>
              <UPopover mode="hover" enable-touch arrow :content="correlationPopoverPosition" :ui="{ content: 'w-80 lg:w-96 max-w-[calc(100vw-1.5rem)] max-h-[min(calc(100dvh-2rem),var(--reka-hover-card-content-available-height))] overflow-y-auto p-4' }">
                <button type="button" :aria-label="t('analysis.correlationsHelpTitle')" class="flex size-8 shrink-0 items-center justify-center rounded-full text-muted opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><AppIcon name="info" class="size-4" /></button>
                <template #content>
                  <div class="space-y-2 text-sm leading-relaxed text-muted">
                    <strong class="block text-highlighted">{{ t('analysis.correlationsHelpTitle') }}</strong>
                    <p>{{ t('analysis.correlationsCoefficientHelp') }}</p>
                    <p>{{ t('analysis.correlationsGoalHelp') }}</p>
                    <p>{{ t('analysis.correlationPositiveWarning') }}</p>
                    <p>{{ t('analysis.correlationsTimingHelp') }}</p>
                    <p>{{ t('analysis.correlationsCaution') }}</p>
                  </div>
                </template>
              </UPopover>
            </div>
            <p>{{ t('analysis.correlationsHint') }}</p>
          </div>
        </div>
      </div>
      <div v-if="correlations.length" class="overflow-x-auto [contain:paint]">
        <table class="w-full min-w-[28rem] table-fixed border-collapse text-center">
          <caption class="sr-only">{{ t('analysis.correlations') }} · {{ t('analysis.correlationsHint') }}</caption>
          <thead>
            <tr class="border-b border-default text-xs text-muted sm:text-sm">
              <th scope="col" class="sticky left-0 z-10 w-44 bg-default pb-3 pr-3 text-left font-medium sm:w-64 sm:pr-5"><div class="flex items-center justify-between gap-2"><span>{{ t('analysis.correlationFactor') }}</span><span class="text-xs">{{ t('analysis.correlationRecentStrength') }}</span></div></th>
              <th v-for="lag in correlationLags" :key="lag" scope="col" class="pb-3 font-medium">{{ t(lag === 0 ? 'analysis.correlationSameDay' : 'analysis.correlationDaysBefore', { count: lag }) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in correlationRows" :key="row.factor" class="border-b border-default last:border-b-0">
              <th scope="row" class="sticky left-0 z-10 bg-default py-4 pr-3 text-left text-xs font-semibold text-highlighted sm:pr-5 sm:text-sm">
                <div class="flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <div class="flex items-center gap-1">
                      <span>{{ factorLabels[row.factor] }}</span>
                      <UPopover mode="hover" enable-touch arrow :content="correlationPopoverPosition" :ui="{ content: 'w-80 lg:w-[36rem] max-w-[calc(100vw-1.5rem)] max-h-[min(calc(100dvh-2rem),var(--reka-hover-card-content-available-height))] overflow-y-auto p-4' }">
                        <button type="button" :aria-label="t('analysis.correlationFactorHelp', { factor: factorLabels[row.factor] })" class="flex size-8 shrink-0 items-center justify-center rounded-full text-muted opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><AppIcon name="info" class="size-4" /></button>
                        <template #content>
                          <div class="space-y-2 text-sm font-normal leading-relaxed text-muted">
                            <strong class="block text-highlighted">{{ t('analysis.correlationFactorHelp', { factor: factorLabels[row.factor] }) }}</strong>
                            <p>{{ t(`analysis.correlationFactorDescription.${row.factor}`) }}</p>
                            <p>{{ t('analysis.correlationSamplesHelp') }}</p>
                            <template v-if="row.comparison && correlationComparison">
                              <div class="space-y-2 border-t border-default pt-2 tabular-nums">
                                <p class="font-medium text-highlighted">{{ t('analysis.correlationComparisonLag', { lag: t(row.comparison.lagDays === 0 ? 'analysis.correlationSameDay' : 'analysis.correlationDaysBefore', { count: row.comparison.lagDays }) }) }}</p>
                                <div class="grid grid-cols-2 gap-3">
                                  <div
                                    v-for="period in [
                                      { label: 'analysis.correlationRecentPeriod', start: correlationComparison.recentStart, end: correlationComparison.recentEnd, result: row.comparison.recent },
                                      { label: 'analysis.correlationPreviousPeriod', start: correlationComparison.previousStart, end: correlationComparison.previousEnd, result: row.comparison.previous },
                                    ]"
                                    :key="period.label"
                                    class="min-w-0 space-y-1"
                                  >
                                    <p class="font-medium text-highlighted">{{ t(period.label) }}</p>
                                    <p class="text-xs"><time :datetime="period.start" :aria-label="period.start">{{ dayjs(period.start).format('MM/DD') }}</time> – <time :datetime="period.end" :aria-label="period.end">{{ dayjs(period.end).format('MM/DD') }}</time></p>
                                    <template v-if="period.result">
                                      <p class="text-base font-semibold text-highlighted">{{ period.result.coefficient.toFixed(3) }}</p>
                                      <p class="text-xs">{{ t('analysis.correlationSamples', { count: period.result.sampleSize }) }}</p>
                                    </template>
                                    <p v-else>{{ t('analysis.correlationComparisonUnavailable') }}</p>
                                  </div>
                                </div>
                              </div>
                              <p v-if="row.comparison.directionChanged" class="font-medium text-highlighted">{{ t('analysis.correlationDirectionChanged') }}</p>
                            </template>
                            <details class="border-y border-default py-2 font-normal">
                              <summary class="cursor-pointer py-1 font-medium text-highlighted">{{ t('analysis.correlationFormulaTitle') }}</summary>
                              <div class="mt-2 grid gap-3 lg:grid-cols-2 lg:gap-4">
                                <div class="min-w-0 space-y-2">
                                  <p>{{ t('analysis.correlationFormulaMethod') }}</p>
                                  <div class="overflow-x-auto py-2 text-base text-highlighted">
                                    <math display="block" :aria-label="t('analysis.correlationFormulaAccessible')">
                                      <mi>r</mi><mo>=</mo>
                                      <mfrac>
                                        <mrow>
                                          <mo>∑</mo>
                                          <mo>(</mo><mi>x</mi><mo>−</mo><mover><mi>x</mi><mo>¯</mo></mover><mo>)</mo>
                                          <mo>(</mo><mi>y</mi><mo>−</mo><mover><mi>y</mi><mo>¯</mo></mover><mo>)</mo>
                                        </mrow>
                                        <msqrt>
                                          <mrow>
                                            <mo>∑</mo><msup><mrow><mo>(</mo><mi>x</mi><mo>−</mo><mover><mi>x</mi><mo>¯</mo></mover><mo>)</mo></mrow><mn>2</mn></msup>
                                            <mo>×</mo>
                                            <mo>∑</mo><msup><mrow><mo>(</mo><mi>y</mi><mo>−</mo><mover><mi>y</mi><mo>¯</mo></mover><mo>)</mo></mrow><mn>2</mn></msup>
                                          </mrow>
                                        </msqrt>
                                      </mfrac>
                                    </math>
                                  </div>
                                  <p>{{ t('analysis.correlationFormulaVariables', { factor: factorLabels[row.factor] }) }}</p>
                                  <p>{{ t('analysis.correlationFormulaMeaning') }}</p>
                                </div>
                                <div class="min-w-0 space-y-2">
                                  <p>{{ t('analysis.correlationPairingHelp', { factor: factorLabels[row.factor] }) }}</p>
                                  <p>{{ t(`analysis.correlationAggregation.${row.factor}`) }}</p>
                                  <p>{{ t('analysis.correlationCalculationRules') }}</p>
                                  <p v-if="row.comparison">{{ t('analysis.correlationStrengthHelp') }}</p>
                                  <a href="https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/correlat.htm" target="_blank" rel="noopener noreferrer" class="inline-block py-1 text-primary underline underline-offset-4">{{ t('analysis.correlationFormulaSource') }}</a>
                                </div>
                              </div>
                            </details>
                            <p>{{ t('analysis.correlationsCaution') }}</p>
                          </div>
                        </template>
                      </UPopover>
                    </div>
                    <p class="mt-1 text-xs font-normal leading-relaxed text-muted">{{ t('analysis.correlationPreference') }}</p>
                  </div>
                  <span class="max-w-20 shrink-0 text-right text-xs font-medium leading-relaxed" :class="row.comparison?.strengthChange === 'stronger' ? 'text-blue-700' : 'text-muted'">{{ t(`analysis.correlationStrength.${row.comparison?.strengthChange ?? 'insufficient'}`) }}</span>
                </div>
              </th>
              <td v-for="cell in row.cells" :key="cell.lagDays" class="px-0.5 py-3 sm:px-2">
                <div v-if="cell.result" class="w-full rounded-xl px-0 py-3 tabular-nums sm:px-1" :class="cell.result.coefficient > 0 ? 'bg-yellow-50 text-yellow-800' : cell.isBest ? 'bg-blue-50 text-primary-700' : 'text-highlighted'">
                  <strong class="block whitespace-nowrap text-xs font-semibold min-[360px]:text-sm sm:text-xl">{{ cell.result.coefficient > 0 ? '+' : '' }}{{ cell.result.coefficient.toFixed(3) }}</strong>
                  <span class="mt-1 block text-xs" :class="cell.result.coefficient > 0 ? 'text-yellow-800' : 'text-muted'">{{ t('analysis.correlationSamples', { count: cell.result.sampleSize }) }}</span>
                  <span v-if="cell.result.coefficient > 0" class="sr-only">{{ t('analysis.correlationPositiveWarning') }}</span>
                  <span v-if="cell.isBest" class="sr-only">{{ t('analysis.correlationBest') }}</span>
                </div>
                <span v-else class="text-sm text-muted" :aria-label="t('analysis.correlationNoData')">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="rounded-2xl bg-elevated p-5 text-sm text-muted">{{ t('analysis.insufficientOverlap') }}</div>
    </section>
  </div>
</template>

<style scoped>
.analysis-summary {
  gap: 1px;
  background: var(--app-border);
}

.analysis-stat {
  background: var(--app-surface);
}

.analysis-stat:first-child p,
.analysis-stat:first-child .app-value,
.analysis-stat:first-child .app-value span {
  color: #079f5b;
}

.analysis-stat-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
}

.weight-projection {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  background: var(--projection-surface);
  border-color: var(--projection-border);
}

.weight-projection--7 {
  --projection-color: #0369a1;
  --projection-line: #0ea5e9;
  --projection-surface: #f5fbff;
  --projection-border: #daedf8;
  --projection-badge: #e3f2fc;
}

.weight-projection--30 {
  --projection-color: #6d28d9;
  --projection-line: #8b5cf6;
  --projection-surface: #faf7ff;
  --projection-border: #eae1fa;
  --projection-badge: #efe7fc;
}

.weight-projection--90 {
  --projection-color: #be185d;
  --projection-line: #ec4899;
  --projection-surface: #fff7fb;
  --projection-border: #f6dfeb;
  --projection-badge: #fce7f1;
}

.weight-projection-heading, .weight-projection-direction {
  color: var(--projection-color);
}

.weight-projection-line {
  width: 12px;
  border-top: 2px dashed var(--projection-line);
}

.weight-projection-value { white-space: nowrap; }
.weight-projection-direction { background: var(--projection-badge); white-space: nowrap; }
.weight-insight { background: #f9fbfd; }
.weight-insight--warning { border-color: #f0ccd2; background: #fff9fa; }

@media (min-width: 768px) {
  .weight-projection { grid-template-columns: minmax(0, 1fr) auto; gap: 12px; padding: 14px 16px; }
  .weight-projection-heading { grid-column: 1 / -1; }
  .weight-projection-value { font-size: 24px; }
}

.weight-comparison dt {
  margin-bottom: 4px;
  color: var(--app-muted);
  font-size: 12px;
}

.weight-comparison dd {
  color: var(--app-ink);
  font-size: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.weight-comparison dd span {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 400;
}

.weight-comparison-connector {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  max-width: 80px;
  padding-top: 20px;
  color: #9baac0;
}

.weight-fluctuation--stable { --fluctuation-color: #087d50; --fluctuation-background: #eaf8f0; }
.weight-fluctuation--normal { --fluctuation-color: #946100; --fluctuation-background: #fff6df; }
.weight-fluctuation--warning { --fluctuation-color: #c03546; --fluctuation-background: #fff0f1; }
.weight-fluctuation-value, .weight-fluctuation-status { color: var(--fluctuation-color); }
.weight-fluctuation-status { background: var(--fluctuation-background); }

.weight-range {
  position: relative;
  height: 6px;
  border-radius: 4px;
  background: #edf1f5;
}

.weight-range-band {
  position: absolute;
  inset-block: 0;
  left: var(--range-start);
  width: var(--range-width);
  border-radius: inherit;
  background: #b8e4cf;
}

.weight-range-baseline {
  position: absolute;
  top: -3px;
  left: var(--baseline);
  width: 1px;
  height: 12px;
  background: #648174;
}

.weight-range-marker {
  position: absolute;
  top: 50%;
  left: var(--marker);
  width: 12px;
  height: 12px;
  border: 3px solid white;
  border-radius: 50%;
  background: var(--fluctuation-color);
  box-shadow: 0 1px 4px rgb(20 40 70 / .25);
  transform: translate(-50%, -50%);
}
</style>
