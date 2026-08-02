<script setup lang="ts">
import type { MovingAveragePeriod } from '../../shared/types/api'
import { buildMetricTrendInsight } from '../../shared/utils/analytics'
import dayjs from 'dayjs'

const dialogOpen = ref(false)
const start = dayjs().subtract(7, 'day').toISOString()
const store = useTrackFitData()
await store.ensureLoaded()
const records = computed(() => store.listMeasurements({ page: 1, pageSize: 8 }))
const analytics = computed(() => store.getAnalytics('weight', start))
const latestAnalytics = computed(() => new Map(
  ['weight', 'waist', 'body_fat'].map(code => [code, store.getAnalytics(code)]),
))
const weightMetricId = computed(() => store.metrics.value.find(metric => metric.code === 'weight')?.id)
const latestWeightRecord = computed(() => weightMetricId.value == null
  ? undefined
  : store.listMeasurements({ page: 1, pageSize: 1, metricId: weightMetricId.value }).items[0])
const todayRecords = computed(() => store.listMeasurements({ page: 1, pageSize: 1, start: dayjs().startOf('day').toISOString() }))
const settings = store.settings
const visibleMovingAverages = ref<MovingAveragePeriod[]>([3, 7, 30, 90])
const overviewTime = useState('overview-time', () => Date.now())

const todayCount = computed(() => todayRecords.value?.total ?? 0)
const cards = computed(() => [
  { label: '体重', value: latestAnalytics.value.get('weight')?.summary?.latest, unit: 'kg', change: latestAnalytics.value.get('weight')?.summary?.previousChange, measuredAt: latestAnalytics.value.get('weight')?.points.at(-1)?.measuredAt },
  { label: 'BMI', value: latestWeightRecord.value?.bmi, unit: '', change: null, measuredAt: latestWeightRecord.value?.measuredAt },
  { label: '腰围', value: latestAnalytics.value.get('waist')?.summary?.latest, unit: 'cm', change: null, measuredAt: latestAnalytics.value.get('waist')?.points.at(-1)?.measuredAt },
  { label: '体脂率', value: latestAnalytics.value.get('body_fat')?.summary?.latest, unit: '%', change: null, measuredAt: latestAnalytics.value.get('body_fat')?.points.at(-1)?.measuredAt },
])
const weightTargetStatus = computed(() => {
  const latest = latestAnalytics.value.get('weight')?.summary?.latest
  const minimum = settings.value.desiredWeightMinimum
  const maximum = settings.value.desiredWeightMaximum
  if (latest == null || minimum == null || maximum == null) return null
  if (latest < minimum) return { label: `低于目标下限 ${Number((minimum - latest).toFixed(2))} kg`, class: 'text-warning' }
  if (latest > maximum) return { label: `高于目标上限 ${Number((latest - maximum).toFixed(2))} kg`, class: 'text-warning' }
  return { label: '当前体重在目标区间内', class: 'text-primary' }
})
const smartInsights = computed(() => [
  { code: 'weight', color: '#10b981' },
  { code: 'waist', color: '#0ea5e9' },
  { code: 'body_fat', color: '#8b5cf6' },
].flatMap(({ code, color }) => {
  const metricAnalytics = store.getAnalytics(code, start)
  if (!metricAnalytics?.summary) return []
  const insight = buildMetricTrendInsight(
    metricAnalytics,
    settings.value.desiredWeightMinimum,
    settings.value.desiredWeightMaximum,
  )
  return insight ? [{
    code,
    color,
    name: metricAnalytics.metric.name,
    unit: metricAnalytics.metric.unit,
    latest: metricAnalytics.summary.latest,
    count: metricAnalytics.summary.count,
    values: metricAnalytics.points.map(point => point.value),
    ...insight,
  }] : []
}))
const smartSummary = computed(() => {
  if (!smartInsights.value.length) return '过去 7 天还没有可分析的指标记录，完成两次测量后会自动生成趋势评价'
  const trends = smartInsights.value.map(item => `${item.name}${item.trendLabel}`).join('，')
  const weight = smartInsights.value.find(item => item.code === 'weight')
  return `过去 7 天共分析 ${smartInsights.value.length} 项身体指标：${trends}。${weight?.evaluation ?? '建议保持相近的测量时间，持续积累可比数据'}`
})

function formatLastMeasuredAt(measuredAt?: string): string {
  if (!measuredAt) return '暂无有效记录'
  const elapsed = overviewTime.value - new Date(measuredAt).getTime()
  if (elapsed < 0 || elapsed > 7 * 86_400_000) return dayjs(measuredAt).format('YYYY-MM-DD HH:mm')
  if (elapsed < 3_600_000) return `${Math.max(1, Math.floor(elapsed / 60_000))} 分钟前`
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} 小时前`
  return `${Math.floor(elapsed / 86_400_000)} 天前`
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
    <PageHeader title="身体概览" description="每次测量都是一个独立数据点，忠实保留一天中的真实波动">
      <button class="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 sm:w-auto" @click="dialogOpen = true">
        ＋ 快速记录
      </button>
    </PageHeader>

    <NuxtLink v-if="settings?.heightCm == null" to="/settings" class="mb-6 flex items-center justify-between rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
      <span>请先设置身高，系统才能计算 BMI</span><span>去设置 →</span>
    </NuxtLink>

    <NuxtLink v-if="settings.desiredWeightMinimum == null || settings.desiredWeightMaximum == null" to="/settings" class="mb-6 flex items-center justify-between rounded-2xl border border-default bg-elevated px-4 py-3 text-sm text-muted">
      <span>设置个人体重上下限，可在图表中实时判断目标区间</span><span>去设置 →</span>
    </NuxtLink>

    <section class="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <article v-for="card in cards" :key="card.label" class="app-card rounded-2xl p-4 sm:p-5">
        <p class="text-xs font-medium text-muted">{{ card.label }}</p>
        <div class="mt-2 flex items-baseline gap-1.5">
          <strong class="text-2xl tracking-tight sm:text-3xl">{{ card.value ?? '—' }}</strong>
          <span class="text-xs text-muted">{{ card.unit }}</span>
        </div>
        <p v-if="card.change != null" class="mt-2 text-xs" :class="card.change <= 0 ? 'text-primary' : 'text-warning'">
          较上次 {{ card.change > 0 ? '+' : '' }}{{ card.change }} {{ card.unit }}
        </p>
        <p v-else class="mt-2 text-xs text-muted">最近一次有效记录</p>
        <p class="mt-1 text-xs text-muted">记录时间：{{ formatLastMeasuredAt(card.measuredAt) }}</p>
      </article>
    </section>

    <section class="app-card mb-6 overflow-hidden rounded-3xl">
      <div class="border-b border-default bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 sm:p-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex gap-3">
            <span class="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-bold text-white shadow-lg shadow-primary/20">✦</span>
            <div>
              <h2 class="font-bold">过去 7 天趋势分析</h2>
              <p class="mt-1 text-xs text-muted">根据真实测量记录、变化幅度和个人体重目标自动生成</p>
            </div>
          </div>
          <NuxtLink to="/analysis" class="text-sm font-medium text-primary">查看完整趋势 →</NuxtLink>
        </div>
        <p class="mt-4 max-w-4xl text-sm leading-6 text-highlighted">{{ smartSummary }}</p>
      </div>

      <div v-if="smartInsights.length" class="grid grid-cols-1 gap-4 p-4 sm:p-6">
        <article v-for="insight in smartInsights" :key="insight.code" class="rounded-2xl border border-default bg-default p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs text-muted">{{ insight.name }}</p>
              <p class="mt-1 flex items-baseline gap-1.5"><strong class="text-2xl">{{ insight.latest }}</strong><span class="text-xs text-muted">{{ insight.unit }}</span></p>
            </div>
            <span class="rounded-lg px-2.5 py-1 text-xs font-medium" :class="insightToneClass(insight.tone)">{{ trendSymbol(insight.direction) }} {{ insight.trendLabel }}</span>
          </div>
          <MetricSparkline :values="insight.values" :color="insight.color" :label="`${insight.name}过去 7 天趋势`" />
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-highlighted">{{ insight.changeLabel }}</span>
            <span class="text-muted">{{ insight.count }} 次记录</span>
          </div>
          <p class="mt-3 border-t border-default pt-3 text-xs leading-5 text-muted">{{ insight.evaluation }}</p>
        </article>
      </div>
      <div v-else class="grid min-h-48 place-items-center p-6 text-center">
        <div><p class="text-3xl text-primary">⌁</p><p class="mt-2 text-sm text-muted">记录身体指标后，这里会自动生成图文趋势分析</p><button class="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white" @click="dialogOpen = true">开始记录</button></div>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,.75fr)]">
      <article class="app-card rounded-3xl p-4 sm:p-6">
        <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 class="font-bold">最近 7 天体重趋势</h2>
            <p class="mt-1 text-xs text-muted">均线按每日均值平滑展示；底部和右侧滑块分别选择 X、Y 轴范围</p>
            <p v-if="weightTargetStatus" class="mt-1 text-xs font-medium" :class="weightTargetStatus.class">{{ weightTargetStatus.label }}</p>
          </div>
          <NuxtLink to="/analysis" class="text-sm font-medium text-primary">详细分析</NuxtLink>
        </div>
        <div class="mb-2 flex flex-wrap gap-2">
          <label v-for="period in ([3, 7, 30, 90] as const)" :key="period" class="flex items-center gap-2 rounded-lg border border-default px-2.5 py-1.5 text-xs">
            <input v-model="visibleMovingAverages" type="checkbox" :value="period" class="size-3.5 accent-emerald-500">{{ period }} 日均线
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
          <template #fallback><div class="grid h-[340px] place-items-center text-sm text-muted">正在加载图表…</div></template>
        </ClientOnly>
      </article>

      <article class="app-card rounded-3xl p-5 sm:p-6">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h2 class="font-bold">最近记录</h2>
            <p class="mt-1 text-xs text-muted">今天已记录 {{ todayCount }} 次</p>
          </div>
          <NuxtLink to="/records" class="text-sm font-medium text-primary">全部</NuxtLink>
        </div>
        <div v-if="records?.items.length" class="space-y-1">
          <div v-for="record in records.items.slice(0, 6)" :key="record.id" class="flex items-center justify-between border-b border-default py-3 last:border-0">
            <div>
              <p class="text-sm font-medium">{{ record.values.find(value => value.code === 'weight')?.value ?? '多指标记录' }} <span v-if="record.values.find(value => value.code === 'weight')" class="text-xs text-muted">kg</span></p>
              <p class="mt-0.5 text-xs text-muted">{{ dayjs(record.measuredAt).format('MM月DD日 HH:mm:ss') }}</p>
            </div>
            <span class="rounded-lg bg-elevated px-2 py-1 text-xs text-muted">{{ record.values.length }} 项</span>
          </div>
        </div>
        <div v-else class="grid min-h-64 place-items-center text-center text-sm text-muted">
          <div><p class="mb-2 text-3xl">⌁</p><p>还没有测量记录</p></div>
        </div>
      </article>
    </section>

    <MeasurementDialog v-model:open="dialogOpen" />
  </div>
</template>
