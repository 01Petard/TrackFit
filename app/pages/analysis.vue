<script setup lang="ts">
import type { AnalyticsDto, AppSettingsDto, MetricDefinitionDto } from '../../shared/types/api'
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
const showMovingAverage = ref(true)
const { data: metrics } = await useFetch<MetricDefinitionDto[]>('/api/metrics', { default: () => [] })
const { data: settings } = await useFetch<AppSettingsDto>('/api/settings')
if (settings.value?.defaultDateRange) range.value = settings.value.defaultDateRange

const start = computed(() => {
  const amount = { '24h': [24, 'hour'], '7d': [7, 'day'], '30d': [30, 'day'], '90d': [90, 'day'] }[range.value] as [number, dayjs.ManipulateType] | undefined
  return amount ? dayjs().subtract(amount[0], amount[1]).toISOString() : undefined
})
const primaryQuery = computed(() => ({ metric: metricCode.value, start: start.value }))
const { data: primary, status } = await useFetch<AnalyticsDto>('/api/analytics', { query: primaryQuery })
const secondary = ref<AnalyticsDto | null>(null)

watch([compareCode, start], async ([value]) => {
  if (value) secondary.value = await $fetch<AnalyticsDto>('/api/analytics', { query: { metric: value, start: start.value } })
  else secondary.value = null
}, { immediate: true })

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
</script>

<template>
  <div>
    <PageHeader title="趋势分析" description="不按自然日聚合，直接分析每一次真实测量记录" />

    <section class="app-card mb-5 grid gap-4 rounded-2xl p-4 sm:grid-cols-2 xl:grid-cols-4">
      <label class="text-xs text-muted">时间范围<select v-model="range" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"><option v-for="item in ranges" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
      <label class="text-xs text-muted">主指标<select v-model="metricCode" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"><option v-for="metric in metrics.filter(item => item.enabled)" :key="metric.id" :value="metric.code">{{ metric.name }}</option></select></label>
      <label class="text-xs text-muted">对比指标<select v-model="compareCode" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"><option value="">不对比</option><option v-for="metric in metrics.filter(item => item.enabled && item.code !== metricCode)" :key="metric.id" :value="metric.code">{{ metric.name }}</option></select></label>
      <label class="flex items-center gap-3 self-end rounded-xl border border-default px-3 py-2.5 text-sm"><input v-model="showMovingAverage" type="checkbox" class="size-4 accent-emerald-500">显示最近 7 条移动平均</label>
    </section>

    <section class="app-card mb-5 rounded-3xl p-3 sm:p-6">
      <div v-if="status === 'pending'" class="grid h-[420px] place-items-center text-sm text-muted">正在计算…</div>
      <ClientOnly v-else-if="primary">
        <ComparisonChart :primary="primary" :secondary="compareCode ? secondary : null" :show-moving-average="showMovingAverage" />
        <template #fallback><div class="grid h-[420px] place-items-center text-sm text-muted">正在加载图表…</div></template>
      </ClientOnly>
    </section>

    <section v-if="summaryCards.length" class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <article v-for="card in summaryCards" :key="card.label" class="app-card rounded-2xl p-4">
        <p class="text-xs text-muted">{{ card.label }}</p>
        <strong class="mt-2 block text-xl">{{ card.value }} <span v-if="card.label !== '记录次数' && card.label !== '最低 / 最高'" class="text-xs font-normal text-muted">{{ primary?.metric.unit }}</span></strong>
      </article>
    </section>
  </div>
</template>
