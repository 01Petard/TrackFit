<script setup lang="ts">
import type { BehaviorTimelineItemDto } from '../../shared/types/api'
import dayjs from 'dayjs'

const store = useTrackFitData()
await store.ensureLoaded()
const start = ref('')
const end = ref('')
const dialogOpen = ref(false)
const dialogKind = ref<'training' | 'sleep'>('training')
const editing = ref<BehaviorTimelineItemDto | null>(null)
const query = computed(() => ({
  start: start.value ? new Date(`${start.value}T00:00:00`).toISOString() : undefined,
  end: end.value ? new Date(`${end.value}T23:59:59`).toISOString() : undefined,
}))
const timeline = computed(() => store.listBehaviors(query.value))
const weekReport = computed(() => store.getPeriodReport('week'))
const latestSleep = computed(() => store.listBehaviors().find(item => item.kind === 'sleep')?.sleep)
const trainingTypeLabels = { strength: '力量训练', cardio: '有氧', mobility: '拉伸与灵活性', other: '其他' } as const
const completenessHints = computed(() => {
  const all = store.listBehaviors()
  const hints: string[] = []
  const latestMeasurement = store.data.value?.sessions.reduce<string | undefined>((latest, item) => !latest || item.measuredAt > latest ? item.measuredAt : latest, undefined)
  const latestTraining = all.find(item => item.kind === 'training')?.occurredAt
  const latestSleepTime = all.find(item => item.kind === 'sleep')?.occurredAt
  if (!latestMeasurement || dayjs().diff(dayjs(latestMeasurement), 'day') >= 7) hints.push('身体指标已超过 7 天未记录')
  if (!latestTraining || dayjs().diff(dayjs(latestTraining), 'day') >= 7) hints.push('最近 7 天没有训练记录')
  if (!latestSleepTime || dayjs().diff(dayjs(latestSleepTime), 'day') >= 2) hints.push('最近两天缺少睡眠记录')
  const weight = store.getAnalytics('weight')?.points ?? []
  const latestWeight = weight.at(-1)?.value
  const previousWeight = weight.at(-2)?.value
  if (latestWeight != null && previousWeight != null && Math.abs(latestWeight - previousWeight) >= Math.max(2, previousWeight * 0.03)) {
    hints.push(`体重较上次波动 ${Math.abs(latestWeight - previousWeight).toFixed(2)} kg，建议核对测量条件`)
  }
  return hints
})
const heatmapDays = computed(() => {
  const counts = new Map<string, number>()
  for (const item of store.data.value?.sessions ?? []) {
    const key = dayjs(item.measuredAt).format('YYYY-MM-DD')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  for (const item of store.listBehaviors()) {
    const key = dayjs(item.occurredAt).format('YYYY-MM-DD')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from({ length: 28 }, (_, index) => {
    const date = dayjs().subtract(27 - index, 'day')
    return { key: date.format('YYYY-MM-DD'), label: date.format('MM-DD'), count: counts.get(date.format('YYYY-MM-DD')) ?? 0 }
  })
})

function openCreate(kind: 'training' | 'sleep') {
  editing.value = null
  dialogKind.value = kind
  dialogOpen.value = true
}

function openEdit(item: BehaviorTimelineItemDto) {
  editing.value = item
  dialogKind.value = item.kind
  dialogOpen.value = true
}

async function remove(item: BehaviorTimelineItemDto) {
  if (!window.confirm(`确认删除这条${item.kind === 'training' ? '训练' : '睡眠'}记录？`)) return
  if (item.kind === 'training') await store.deleteTraining(item.id)
  else await store.deleteSleep(item.id)
}

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours} 小时${rest ? ` ${rest} 分钟` : ''}` : `${rest} 分钟`
}
</script>

<template>
  <div>
    <PageHeader title="行为记录" description="记录训练和睡眠，用数据解释身体指标变化">
      <div v-if="store.canWrite.value" class="grid grid-cols-2 gap-2 sm:flex"><button class="rounded-xl border border-primary px-4 py-3 text-sm font-semibold text-primary" @click="openCreate('sleep')">＋ 睡眠</button><button class="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white" @click="openCreate('training')">＋ 训练</button></div>
    </PageHeader>

    <section class="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <article class="app-card rounded-2xl p-4"><p class="text-xs text-muted">本周训练</p><strong class="mt-2 block text-2xl">{{ weekReport?.training.count ?? 0 }} <span class="text-xs font-normal text-muted">次</span></strong></article>
      <article class="app-card rounded-2xl p-4"><p class="text-xs text-muted">本周时长</p><strong class="mt-2 block text-2xl">{{ weekReport?.training.totalMinutes ?? 0 }} <span class="text-xs font-normal text-muted">/ {{ store.settings.value.weeklyTrainingGoalMinutes }} 分钟</span></strong></article>
      <article class="app-card rounded-2xl p-4"><p class="text-xs text-muted">最近睡眠</p><strong class="mt-2 block text-2xl">{{ latestSleep ? durationLabel(latestSleep.durationMinutes) : '—' }}</strong></article>
      <article class="app-card rounded-2xl p-4"><p class="text-xs text-muted">本周睡眠达标</p><strong class="mt-2 block text-2xl">{{ weekReport?.sleep.goalDays ?? 0 }} <span class="text-xs font-normal text-muted">天</span></strong></article>
    </section>

    <section class="app-card mb-5 rounded-2xl p-4">
      <div class="mb-3 flex items-center justify-between"><div><h2 class="text-sm font-bold">近 28 天记录热力</h2><p class="mt-1 text-xs text-muted">汇总身体测量、训练和睡眠，颜色越深表示记录越多</p></div><span class="text-xs text-muted">0–3+</span></div>
      <div class="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1 sm:grid-cols-[repeat(28,minmax(0,1fr))]">
        <div v-for="day in heatmapDays" :key="day.key" class="aspect-square rounded-sm" :class="day.count === 0 ? 'bg-elevated' : day.count === 1 ? 'bg-primary/30' : day.count === 2 ? 'bg-primary/60' : 'bg-primary'" :title="`${day.label}：${day.count} 条记录`" />
      </div>
    </section>

    <section class="mb-5 rounded-2xl border px-4 py-3 text-sm" :class="completenessHints.length ? 'border-warning/30 bg-warning/10 text-warning' : 'border-primary/20 bg-primary/5 text-primary'">
      <strong>{{ completenessHints.length ? '数据完整度提示' : '记录状态良好' }}</strong>
      <ul v-if="completenessHints.length" class="mt-2 list-disc space-y-1 pl-5 text-xs"><li v-for="hint in completenessHints" :key="hint">{{ hint }}</li></ul>
      <p v-else class="mt-1 text-xs">近期身体指标、训练和睡眠数据均有记录</p>
    </section>

    <section class="app-card mb-5 grid gap-3 rounded-2xl p-4 sm:grid-cols-2">
      <div class="text-xs text-muted"><span>开始日期</span><div class="mt-1.5"><AppDateField v-model="start" clearable placeholder="不限开始日期" /></div></div>
      <div class="text-xs text-muted"><span>结束日期</span><div class="mt-1.5"><AppDateField v-model="end" clearable placeholder="不限结束日期" /></div></div>
    </section>

    <section class="app-card overflow-hidden rounded-3xl">
      <div v-if="!timeline.length" class="grid min-h-72 place-items-center text-center text-sm text-muted"><div><p class="text-3xl">◌</p><p class="mt-2">当前范围还没有行为记录</p></div></div>
      <div v-else class="hidden overflow-x-auto md:block">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-default bg-elevated/60 text-xs text-muted"><tr><th class="px-5 py-4 font-medium">时间</th><th class="px-5 py-4 font-medium">类型</th><th class="px-5 py-4 font-medium">内容</th><th class="px-5 py-4 font-medium">备注</th><th v-if="store.canWrite.value" class="px-5 py-4 text-right font-medium">操作</th></tr></thead><tbody>
            <tr v-for="item in timeline" :key="`${item.kind}-${item.id}`" class="border-b border-default last:border-0"><td class="whitespace-nowrap px-5 py-4">{{ dayjs(item.occurredAt).format('YYYY-MM-DD HH:mm') }}</td><td class="px-5 py-4"><span class="rounded-lg bg-elevated px-2.5 py-1 text-xs">{{ item.kind === 'training' ? '训练' : '睡眠' }}</span></td><td class="px-5 py-4">{{ item.training ? `${trainingTypeLabels[item.training.type]} · ${item.training.durationMinutes} 分钟 · 强度 ${item.training.intensity}/10` : `${durationLabel(item.sleep!.durationMinutes)} · 质量 ${item.sleep!.quality}%` }}</td><td class="max-w-56 truncate px-5 py-4 text-muted">{{ item.training?.note || item.sleep?.note || '—' }}</td><td v-if="store.canWrite.value" class="whitespace-nowrap px-5 py-4 text-right"><button class="mr-3 text-primary" @click="openEdit(item)">编辑</button><button class="text-error" @click="remove(item)">删除</button></td></tr>
          </tbody>
        </table>
      </div>
      <div v-if="timeline.length" class="divide-y divide-default md:hidden">
        <article v-for="item in timeline" :key="`${item.kind}-${item.id}`" class="p-4"><div class="flex items-start justify-between gap-3"><div><span class="text-xs font-medium text-primary">{{ item.kind === 'training' ? '训练' : '睡眠' }}</span><strong class="mt-1 block">{{ item.training ? trainingTypeLabels[item.training.type] : durationLabel(item.sleep!.durationMinutes) }}</strong><p class="mt-1 text-xs text-muted">{{ dayjs(item.occurredAt).format('MM月DD日 HH:mm') }}</p></div><div v-if="store.canWrite.value" class="flex gap-3 text-sm"><button class="text-primary" @click="openEdit(item)">编辑</button><button class="text-error" @click="remove(item)">删除</button></div></div><p class="mt-3 text-xs text-muted">{{ item.training ? `${item.training.durationMinutes} 分钟 · 强度 ${item.training.intensity}/10` : `质量 ${item.sleep!.quality}%` }}<span v-if="item.training?.note || item.sleep?.note"> · {{ item.training?.note || item.sleep?.note }}</span></p></article>
      </div>
    </section>

    <BehaviorDialog v-if="store.canWrite.value" v-model:open="dialogOpen" :kind="dialogKind" :item="editing" />
  </div>
</template>
