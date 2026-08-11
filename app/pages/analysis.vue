<script setup lang="ts">
import type { MovingAveragePeriod } from '../../shared/types/api'
import dayjs from 'dayjs'

const ranges = [
  { label: '24 小时', value: '24h' },
  { label: '7 天', value: '7d' },
  { label: '30 天', value: '30d' },
  { label: '90 天', value: '90d' },
  { label: '全部', value: 'all' },
]
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
const factorLabels = {
  trainingDuration: '训练时长',
  sleepDuration: '睡眠时长',
  sleepQuality: '睡眠质量',
} as const

const summaryCards = computed(() => {
  const summary = primary.value?.summary
  if (!summary) return []
  return [
    { label: '最新值', value: summary.latest },
    { label: '相比上次', value: summary.previousChange == null ? '—' : `${summary.previousChange > 0 ? '+' : ''}${summary.previousChange}` },
    { label: '区间变化', value: `${summary.totalChange > 0 ? '+' : ''}${summary.totalChange}` },
    { label: '区间平均', value: summary.average },
    { label: '最低 / 最高', value: `${summary.minimum} / ${summary.maximum}` },
    { label: '记录次数', value: summary.count },
  ]
})

function minutesLabel(minutes: number | null): string {
  if (minutes == null) return '—'
  return `${Math.floor(minutes / 60)} 小时 ${Math.round(minutes % 60)} 分钟`
}
</script>

<template>
  <div>
    <PageHeader title="趋势分析" description="原始数据保留每次测量，均线基于每日测量均值计算" />

    <section class="app-card mb-5 grid gap-4 rounded-2xl p-4 sm:grid-cols-2 xl:grid-cols-3">
      <label class="text-xs text-muted">时间范围<select v-model="range" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"><option v-for="item in ranges" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
      <label class="text-xs text-muted">主指标<select v-model="metricCode" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"><option v-for="metric in metrics.filter(item => item.enabled)" :key="metric.id" :value="metric.code">{{ metric.name }}</option></select></label>
      <label class="text-xs text-muted">对比指标<select v-model="compareCode" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"><option value="">不对比</option><option v-for="metric in metrics.filter(item => item.enabled && item.code !== metricCode)" :key="metric.id" :value="metric.code">{{ metric.name }}</option></select></label>
      <div class="sm:col-span-2 xl:col-span-3">
        <p class="mb-2 text-xs text-muted">均线显示</p>
        <div class="flex flex-wrap gap-2">
          <label v-for="period in ([3, 7, 30, 90] as const)" :key="period" class="flex items-center gap-2 rounded-xl border border-default px-3 py-2 text-sm"><input v-model="visibleMovingAverages" type="checkbox" :value="period" class="size-4 accent-emerald-500">{{ period }} 日均线</label>
        </div>
      </div>
    </section>

    <section class="app-card mb-5 rounded-3xl p-3 sm:p-6">
      <div v-if="status === 'pending'" class="grid h-[420px] place-items-center text-sm text-muted">正在计算…</div>
      <ClientOnly v-else-if="primary">
        <p class="mb-2 px-2 text-xs text-muted">拖动底部滑块选择 X 轴时间范围，拖动右侧滑块选择 Y 轴数值范围</p>
        <ComparisonChart
          :primary="primary"
          :secondary="compareCode ? secondary : null"
          :visible-moving-averages="visibleMovingAverages"
          :target-minimum="settings.desiredWeightMinimum"
          :target-maximum="settings.desiredWeightMaximum"
        />
        <template #fallback><div class="grid h-[420px] place-items-center text-sm text-muted">正在加载图表…</div></template>
      </ClientOnly>
    </section>

    <section v-if="summaryCards.length" class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <article v-for="card in summaryCards" :key="card.label" class="app-card rounded-2xl p-4">
        <p class="text-xs text-muted">{{ card.label }}</p>
        <strong class="mt-2 block text-xl">{{ card.value }} <span v-if="card.label !== '记录次数' && card.label !== '最低 / 最高'" class="text-xs font-normal text-muted">{{ primary?.metric.unit }}</span></strong>
      </article>
    </section>

    <section class="app-card mt-5 rounded-3xl p-4 sm:p-6">
      <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 class="font-bold">周期报告</h2><p class="mt-1 text-xs text-muted">按本地自然日实时统计，不保存重复结果</p></div><div class="flex rounded-xl bg-elevated p-1"><button v-for="item in ([{ value: 'week', label: '本周' }, { value: 'month', label: '本月' }] as const)" :key="item.value" class="rounded-lg px-4 py-2 text-sm" :class="reportPeriod === item.value ? 'bg-default font-medium text-primary shadow-sm' : 'text-muted'" @click="reportPeriod = item.value">{{ item.label }}</button></div></div>
      <div v-if="report" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-2xl bg-elevated p-4"><p class="text-xs text-muted">训练</p><strong class="mt-2 block text-xl">{{ report.training.totalMinutes }} 分钟</strong><p class="mt-1 text-xs text-muted">{{ report.training.count }} 次 · 上一周期 {{ report.training.previousTotalMinutes }} 分钟</p></article>
        <article class="rounded-2xl bg-elevated p-4"><p class="text-xs text-muted">平均睡眠</p><strong class="mt-2 block text-xl">{{ minutesLabel(report.sleep.averageMinutes) }}</strong><p class="mt-1 text-xs text-muted">达标 {{ report.sleep.goalDays }} 天 · 平均质量 {{ report.sleep.averageQuality == null ? '—' : `${report.sleep.averageQuality}%` }}</p></article>
        <article v-for="metric in report.bodyMetrics.slice(0, 2)" :key="metric.code" class="rounded-2xl bg-elevated p-4"><p class="text-xs text-muted">{{ metric.name }}日均</p><strong class="mt-2 block text-xl">{{ metric.average ?? '—' }} <span class="text-xs font-normal text-muted">{{ metric.unit }}</span></strong><p class="mt-1 text-xs text-muted">变化 {{ metric.change == null ? '—' : `${metric.change > 0 ? '+' : ''}${metric.change}` }} · 波动 {{ metric.volatility ?? '—' }}</p></article>
      </div>
    </section>

    <section class="app-card mt-5 rounded-3xl p-4 sm:p-6">
      <div class="mb-4"><h2 class="font-bold">行为相关性</h2><p class="mt-1 text-xs text-muted">至少需要 14 个有效重叠日；相关性不等于因果，不作为医疗诊断</p></div>
      <div v-if="correlations.length" class="grid gap-3 sm:grid-cols-2">
        <article v-for="item in correlations" :key="`${item.metricCode}-${item.factor}-${item.lagDays}`" class="flex items-center justify-between rounded-2xl border border-default p-4"><div><strong class="text-sm">{{ item.metricName }} × {{ factorLabels[item.factor] }}</strong><p class="mt-1 text-xs text-muted">{{ item.lagDays === 0 ? '当日' : `提前 ${item.lagDays} 天` }} · {{ item.sampleSize }} 个重叠日</p></div><span class="rounded-xl px-3 py-2 text-sm font-bold" :class="item.coefficient >= 0 ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'">{{ item.coefficient > 0 ? '+' : '' }}{{ item.coefficient }}</span></article>
      </div>
      <div v-else class="rounded-2xl bg-elevated p-5 text-sm text-muted">当前有效重叠数据不足。持续记录身体指标、训练和睡眠，达到 14 个重叠日后自动生成分析。</div>
    </section>
  </div>
</template>
