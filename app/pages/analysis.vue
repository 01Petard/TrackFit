<script setup lang="ts">
import type { MovingAveragePeriod } from '../../shared/types/api'
import dayjs from 'dayjs'

const { t } = useI18n()
const { metricName } = useTrackFitI18n()
const ranges = computed(() => ['24h', '7d', '30d', '90d', 'all'].map(value => ({ label: t(`range.${value}`), value })))
const range = ref('30d')
const metricCode = ref('weight')
const compareCode = ref('')
const visibleMovingAverages = ref<MovingAveragePeriod[]>([3, 7, 30, 90])
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
const status = store.status
const settings = store.settings
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
    { label: t('analysis.latest'), value: summary.latest, showUnit: true },
    { label: t('analysis.sincePrevious'), value: summary.previousChange == null ? '—' : `${summary.previousChange > 0 ? '+' : ''}${summary.previousChange}`, showUnit: true },
    { label: t('analysis.rangeChange'), value: `${summary.totalChange > 0 ? '+' : ''}${summary.totalChange}`, showUnit: true },
    { label: t('analysis.rangeAverage'), value: summary.average, showUnit: true },
    { label: t('analysis.minimumMaximum'), value: `${summary.minimum} / ${summary.maximum}`, showUnit: false },
    { label: t('analysis.recordCount'), value: summary.count, showUnit: false },
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

    <section class="app-card mb-5 grid gap-4 rounded-2xl p-4 sm:grid-cols-2 xl:grid-cols-3">
      <label class="text-xs text-muted">{{ t('analysis.timeRange') }}<select v-model="range" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"><option v-for="item in ranges" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
      <label class="text-xs text-muted">{{ t('analysis.primaryMetric') }}<select v-model="metricCode" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"><option v-for="metric in metrics.filter(item => item.enabled)" :key="metric.id" :value="metric.code">{{ metricName(metric) }}</option></select></label>
      <label class="text-xs text-muted">{{ t('analysis.compareMetric') }}<select v-model="compareCode" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"><option value="">{{ t('analysis.noComparison') }}</option><option v-for="metric in metrics.filter(item => item.enabled && item.code !== metricCode)" :key="metric.id" :value="metric.code">{{ metricName(metric) }}</option></select></label>
      <div class="sm:col-span-2 xl:col-span-3">
        <p class="mb-2 text-xs text-muted">{{ t('analysis.averages') }}</p>
        <div class="flex flex-wrap gap-2">
          <label v-for="period in ([3, 7, 30, 90] as const)" :key="period" class="flex items-center gap-2 rounded-xl border border-default px-3 py-2 text-sm"><input v-model="visibleMovingAverages" type="checkbox" :value="period" class="size-4 accent-emerald-500">{{ t('common.dayAverage', { count: period }) }}</label>
        </div>
      </div>
    </section>

    <section class="app-card mb-5 rounded-3xl p-3 sm:p-6">
      <div v-if="status === 'pending'" class="grid h-[420px] place-items-center text-sm text-muted">{{ t('analysis.calculating') }}</div>
      <ClientOnly v-else-if="primary">
        <p class="mb-2 px-2 text-xs text-muted">{{ t('analysis.sliderHint') }}</p>
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
      <article v-for="card in summaryCards" :key="card.label" class="app-card rounded-2xl p-4">
        <p class="text-xs text-muted">{{ card.label }}</p>
        <strong class="mt-2 block text-xl">{{ card.value }} <span v-if="card.showUnit" class="text-xs font-normal text-muted">{{ primary?.metric.unit }}</span></strong>
      </article>
    </section>

    <section class="app-card mt-5 rounded-3xl p-4 sm:p-6">
      <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 class="font-bold">{{ t('analysis.periodReport') }}</h2><p class="mt-1 text-xs text-muted">{{ t('analysis.periodReportHint') }}</p></div><div class="flex rounded-xl bg-elevated p-1"><button v-for="item in reportPeriods" :key="item.value" class="rounded-lg px-4 py-2 text-sm" :class="reportPeriod === item.value ? 'bg-default font-medium text-primary shadow-sm' : 'text-muted'" @click="reportPeriod = item.value">{{ item.label }}</button></div></div>
      <div v-if="report" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-2xl bg-elevated p-4"><p class="text-xs text-muted">{{ t('common.training') }}</p><strong class="mt-2 block text-xl">{{ t('common.minutes', { count: report.training.totalMinutes }) }}</strong><p class="mt-1 text-xs text-muted">{{ t('analysis.trainingSummary', { count: report.training.count, minutes: report.training.previousTotalMinutes }) }}</p></article>
        <article class="rounded-2xl bg-elevated p-4"><p class="text-xs text-muted">{{ t('analysis.averageSleep') }}</p><strong class="mt-2 block text-xl">{{ minutesLabel(report.sleep.averageMinutes) }}</strong><p class="mt-1 text-xs text-muted">{{ t('analysis.sleepSummary', { days: report.sleep.goalDays, quality: report.sleep.averageQuality == null ? '—' : `${report.sleep.averageQuality}%` }) }}</p></article>
        <article v-for="metric in report.bodyMetrics.slice(0, 2)" :key="metric.code" class="rounded-2xl bg-elevated p-4"><p class="text-xs text-muted">{{ t('analysis.metricDailyAverage', { metric: metricName(metric) }) }}</p><strong class="mt-2 block text-xl">{{ metric.average ?? '—' }} <span class="text-xs font-normal text-muted">{{ metric.unit }}</span></strong><p class="mt-1 text-xs text-muted">{{ t('analysis.metricChange', { change: metric.change == null ? '—' : `${metric.change > 0 ? '+' : ''}${metric.change}`, volatility: metric.volatility ?? '—' }) }}</p></article>
      </div>
    </section>

    <section class="app-card mt-5 rounded-3xl p-4 sm:p-6">
      <div class="mb-4"><h2 class="font-bold">{{ t('analysis.correlations') }}</h2><p class="mt-1 text-xs text-muted">{{ t('analysis.correlationsHint') }}</p></div>
      <div v-if="correlations.length" class="grid gap-3 sm:grid-cols-2">
        <article v-for="item in correlations" :key="`${item.metricCode}-${item.factor}-${item.lagDays}`" class="flex items-center justify-between rounded-2xl border border-default p-4"><div><strong class="text-sm">{{ metricName({ code: item.metricCode, name: item.metricName }) }} × {{ factorLabels[item.factor] }}</strong><p class="mt-1 text-xs text-muted">{{ t(item.lagDays === 0 ? 'analysis.sameDay' : 'analysis.daysAhead', { count: item.lagDays }) }} · {{ t('analysis.overlapDays', { count: item.sampleSize }) }}</p></div><span class="rounded-xl px-3 py-2 text-sm font-bold" :class="item.coefficient >= 0 ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'">{{ item.coefficient > 0 ? '+' : '' }}{{ item.coefficient }}</span></article>
      </div>
      <div v-else class="rounded-2xl bg-elevated p-5 text-sm text-muted">{{ t('analysis.insufficientOverlap') }}</div>
    </section>
  </div>
</template>
