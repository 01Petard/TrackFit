<script setup lang="ts">
import type { MeasurementDto } from '../../shared/types/api'
import dayjs from 'dayjs'

const page = ref(1)
const pageSize = 20
const start = ref('')
const end = ref('')
const metricId = ref<number | undefined>()
const dialogOpen = ref(false)
const editing = ref<MeasurementDto | null>(null)
const deletingId = ref<number | null>(null)

const store = useTrackFitData()
await store.ensureLoaded()
const query = computed(() => ({
  page: page.value,
  pageSize,
  start: start.value ? new Date(`${start.value}T00:00:00`).toISOString() : undefined,
  end: end.value ? new Date(`${end.value}T23:59:59`).toISOString() : undefined,
  metricId: metricId.value,
}))
const data = computed(() => store.listMeasurements(query.value))
const metrics = store.metrics
const status = store.status
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / pageSize)))

watch([start, end, metricId], () => {
  page.value = 1
})

function createRecord() {
  editing.value = null
  dialogOpen.value = true
}

function editRecord(record: MeasurementDto) {
  editing.value = record
  dialogOpen.value = true
}

async function deleteRecord(id: number) {
  if (!window.confirm('确认删除这条测量记录？删除后无法恢复。')) return
  deletingId.value = id
  try {
    await store.deleteMeasurement(id)
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div>
    <PageHeader title="测量记录" description="每条记录精确到秒，同一天可以保存任意多次">
      <button class="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white sm:w-auto" @click="createRecord">＋ 新增记录</button>
    </PageHeader>

    <section class="app-card mb-5 grid gap-3 rounded-2xl p-4 sm:grid-cols-3">
      <div class="text-xs text-muted"><span>开始日期</span><div class="mt-1.5"><AppDateField v-model="start" clearable placeholder="不限开始日期" /></div></div>
      <div class="text-xs text-muted"><span>结束日期</span><div class="mt-1.5"><AppDateField v-model="end" clearable placeholder="不限结束日期" /></div></div>
      <label class="text-xs text-muted">包含指标<select v-model="metricId" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"><option :value="undefined">全部指标</option><option v-for="metric in metrics" :key="metric.id" :value="metric.id">{{ metric.name }}</option></select></label>
    </section>

    <section class="app-card overflow-hidden rounded-3xl">
      <div v-if="status === 'pending'" class="grid min-h-64 place-items-center text-sm text-muted">正在加载…</div>
      <div v-else-if="!data?.items.length" class="grid min-h-72 place-items-center text-center text-sm text-muted"><div><p class="mb-2 text-3xl">◎</p><p>当前筛选范围没有记录</p></div></div>

      <div v-else class="hidden overflow-x-auto md:block">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-default bg-elevated/60 text-xs text-muted"><tr><th class="px-5 py-4 font-medium">测量时间</th><th class="px-5 py-4 font-medium">身体指标</th><th class="px-5 py-4 font-medium">衍生值</th><th class="px-5 py-4 font-medium">备注</th><th class="px-5 py-4 text-right font-medium">操作</th></tr></thead>
          <tbody>
            <tr v-for="record in data.items" :key="record.id" class="border-b border-default last:border-0 hover:bg-elevated/30">
              <td class="whitespace-nowrap px-5 py-4"><strong>{{ dayjs(record.measuredAt).format('YYYY-MM-DD') }}</strong><br><span class="text-xs text-muted">{{ dayjs(record.measuredAt).format('HH:mm:ss') }}</span></td>
              <td class="px-5 py-4"><div class="flex max-w-xl flex-wrap gap-1.5"><span v-for="value in record.values" :key="value.metricId" class="rounded-lg bg-elevated px-2.5 py-1 text-xs">{{ value.name }} {{ value.value }} {{ value.unit }}</span></div></td>
              <td class="whitespace-nowrap px-5 py-4 text-xs text-muted"><span v-if="record.bmi">BMI {{ record.bmi }}</span><span v-if="record.waistHipRatio" class="ml-2">腰臀比 {{ record.waistHipRatio }}</span><span v-if="!record.bmi && !record.waistHipRatio">—</span></td>
              <td class="max-w-48 truncate px-5 py-4 text-muted">{{ record.note || '—' }}</td>
              <td class="whitespace-nowrap px-5 py-4 text-right"><button class="mr-3 text-primary" @click="editRecord(record)">编辑</button><button class="text-error disabled:opacity-40" :disabled="deletingId === record.id" @click="deleteRecord(record.id)">删除</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="data?.items.length" class="divide-y divide-default md:hidden">
        <article v-for="record in data.items" :key="record.id" class="p-4">
          <div class="mb-3 flex items-start justify-between"><div><strong>{{ dayjs(record.measuredAt).format('MM月DD日') }}</strong><p class="text-xs text-muted">{{ dayjs(record.measuredAt).format('HH:mm:ss') }}</p></div><div class="flex gap-3 text-sm"><button class="text-primary" @click="editRecord(record)">编辑</button><button class="text-error" @click="deleteRecord(record.id)">删除</button></div></div>
          <div class="flex flex-wrap gap-2"><span v-for="value in record.values" :key="value.metricId" class="rounded-lg bg-elevated px-2.5 py-1.5 text-xs">{{ value.name }} <b>{{ value.value }}</b> {{ value.unit }}</span></div>
          <p v-if="record.note" class="mt-3 text-xs leading-5 text-muted">{{ record.note }}</p>
        </article>
      </div>

      <footer v-if="data?.total" class="flex items-center justify-between border-t border-default px-4 py-3 text-sm text-muted">
        <span>共 {{ data.total }} 条</span><div class="flex items-center gap-2"><button class="rounded-lg border border-default px-3 py-1.5 disabled:opacity-40" :disabled="page <= 1" @click="page--">上一页</button><span>{{ page }} / {{ totalPages }}</span><button class="rounded-lg border border-default px-3 py-1.5 disabled:opacity-40" :disabled="page >= totalPages" @click="page++">下一页</button></div>
      </footer>
    </section>

    <MeasurementDialog v-model:open="dialogOpen" :measurement="editing" />
  </div>
</template>
