<script setup lang="ts">
import type { AnalyticsDto, AppSettingsDto, MeasurementPageDto } from '../../shared/types/api'
import dayjs from 'dayjs'

const dialogOpen = ref(false)
const start = dayjs().subtract(7, 'day').toISOString()
const { data: records, refresh: refreshRecords } = await useFetch<MeasurementPageDto>('/api/measurements', {
  query: { page: 1, pageSize: 8 },
})
const { data: analytics, refresh: refreshAnalytics } = await useFetch<AnalyticsDto>('/api/analytics', {
  query: { metric: 'weight', start },
})
const { data: todayRecords, refresh: refreshToday } = await useFetch<MeasurementPageDto>('/api/measurements', {
  query: { page: 1, pageSize: 1, start: dayjs().startOf('day').toISOString() },
})
const { data: settings } = await useFetch<AppSettingsDto>('/api/settings')

const latest = computed(() => records.value?.items[0])
const latestValues = computed(() => new Map(latest.value?.values.map(value => [value.code, value]) ?? []))
const todayCount = computed(() => todayRecords.value?.total ?? 0)
const cards = computed(() => [
  { label: '体重', value: latestValues.value.get('weight')?.value, unit: 'kg', change: analytics.value?.summary?.previousChange },
  { label: 'BMI', value: latest.value?.bmi, unit: '', change: null },
  { label: '腰围', value: latestValues.value.get('waist')?.value, unit: 'cm', change: null },
  { label: '体脂率', value: latestValues.value.get('body_fat')?.value, unit: '%', change: null },
])

async function refreshAll() {
  await Promise.all([refreshRecords(), refreshAnalytics(), refreshToday()])
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
      </article>
    </section>

    <section class="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,.75fr)]">
      <article class="app-card rounded-3xl p-4 sm:p-6">
        <div class="mb-3 flex items-start justify-between">
          <div>
            <h2 class="font-bold">最近 7 天体重趋势</h2>
            <p class="mt-1 text-xs text-muted">显示全部原始记录，虚线为最近 7 条移动平均</p>
          </div>
          <NuxtLink to="/analysis" class="text-sm font-medium text-primary">详细分析</NuxtLink>
        </div>
        <ClientOnly>
          <MetricChart :points="analytics?.points ?? []" :unit="analytics?.metric.unit ?? 'kg'" height="340px" />
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

    <MeasurementDialog v-model:open="dialogOpen" @saved="refreshAll" />
  </div>
</template>
