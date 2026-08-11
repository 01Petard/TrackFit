<script setup lang="ts">
import type { MeasurementDto } from '../../shared/types/api'

const page = ref(1)
const pageSize = 20
const start = ref('')
const end = ref('')
const metricId = ref<number | undefined>()
const dialogOpen = ref(false)
const editing = ref<MeasurementDto | null>(null)
const deletingId = ref<number | null>(null)

const store = useTrackFitData()
const { t } = useI18n()
const { formatDateTime, metricName } = useTrackFitI18n()
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
  if (!window.confirm(t('records.confirmDelete'))) return
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
    <PageHeader :title="t('records.title')" :description="t('records.description')">
      <button v-if="store.canWrite.value" class="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white sm:w-auto" @click="createRecord">＋ {{ t('records.add') }}</button>
    </PageHeader>

    <section class="app-card mb-5 grid gap-3 rounded-2xl p-4 sm:grid-cols-3">
      <div class="text-xs text-muted"><span>{{ t('common.startDate') }}</span><div class="mt-1.5"><AppDateField v-model="start" clearable :placeholder="t('common.anyStartDate')" /></div></div>
      <div class="text-xs text-muted"><span>{{ t('common.endDate') }}</span><div class="mt-1.5"><AppDateField v-model="end" clearable :placeholder="t('common.anyEndDate')" /></div></div>
      <label class="text-xs text-muted">{{ t('records.includesMetric') }}<select v-model="metricId" class="mt-1.5 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-sm text-highlighted"><option :value="undefined">{{ t('records.allMetrics') }}</option><option v-for="metric in metrics" :key="metric.id" :value="metric.id">{{ metricName(metric) }}</option></select></label>
    </section>

    <section class="app-card overflow-hidden rounded-3xl">
      <div v-if="status === 'pending'" class="grid min-h-64 place-items-center text-sm text-muted">{{ t('common.loading') }}</div>
      <div v-else-if="!data?.items.length" class="grid min-h-72 place-items-center text-center text-sm text-muted"><div><p class="mb-2 text-3xl">◎</p><p>{{ t('records.empty') }}</p></div></div>

      <div v-else class="hidden overflow-x-auto md:block">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-default bg-elevated/60 text-xs text-muted"><tr><th class="px-5 py-4 font-medium">{{ t('records.measuredAt') }}</th><th class="px-5 py-4 font-medium">{{ t('records.bodyMetrics') }}</th><th class="px-5 py-4 font-medium">{{ t('records.derived') }}</th><th class="px-5 py-4 font-medium">{{ t('common.note') }}</th><th v-if="store.canWrite.value" class="px-5 py-4 text-right font-medium">{{ t('common.actions') }}</th></tr></thead>
          <tbody>
            <tr v-for="record in data.items" :key="record.id" class="border-b border-default last:border-0 hover:bg-elevated/30">
              <td class="whitespace-nowrap px-5 py-4"><strong>{{ formatDateTime(record.measuredAt) }}</strong></td>
              <td class="px-5 py-4"><div class="flex max-w-xl flex-wrap gap-1.5"><span v-for="value in record.values" :key="value.metricId" class="rounded-lg bg-elevated px-2.5 py-1 text-xs">{{ metricName(value) }} {{ value.value }} {{ value.unit }}</span></div></td>
              <td class="whitespace-nowrap px-5 py-4 text-xs text-muted"><span v-if="record.bmi">BMI {{ record.bmi }}</span><span v-if="record.waistHipRatio" class="ml-2">{{ t('records.waistHipRatio') }} {{ record.waistHipRatio }}</span><span v-if="!record.bmi && !record.waistHipRatio">—</span></td>
              <td class="max-w-48 truncate px-5 py-4 text-muted">{{ record.note || '—' }}</td>
              <td v-if="store.canWrite.value" class="whitespace-nowrap px-5 py-4 text-right"><button class="mr-3 text-primary" @click="editRecord(record)">{{ t('common.edit') }}</button><button class="text-error disabled:opacity-40" :disabled="deletingId === record.id" @click="deleteRecord(record.id)">{{ t('common.delete') }}</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="data?.items.length" class="divide-y divide-default md:hidden">
        <article v-for="record in data.items" :key="record.id" class="p-4">
          <div class="mb-3 flex items-start justify-between"><div><strong>{{ formatDateTime(record.measuredAt) }}</strong></div><div v-if="store.canWrite.value" class="flex gap-3 text-sm"><button class="text-primary" @click="editRecord(record)">{{ t('common.edit') }}</button><button class="text-error" @click="deleteRecord(record.id)">{{ t('common.delete') }}</button></div></div>
          <div class="flex flex-wrap gap-2"><span v-for="value in record.values" :key="value.metricId" class="rounded-lg bg-elevated px-2.5 py-1.5 text-xs">{{ metricName(value) }} <b>{{ value.value }}</b> {{ value.unit }}</span></div>
          <p v-if="record.note" class="mt-3 text-xs leading-5 text-muted">{{ record.note }}</p>
        </article>
      </div>

      <footer v-if="data?.total" class="flex items-center justify-between border-t border-default px-4 py-3 text-sm text-muted">
        <span>{{ t('records.total', { count: data.total }) }}</span><div class="flex items-center gap-2"><button class="rounded-lg border border-default px-3 py-1.5 disabled:opacity-40" :disabled="page <= 1" @click="page--">{{ t('common.previousPage') }}</button><span>{{ page }} / {{ totalPages }}</span><button class="rounded-lg border border-default px-3 py-1.5 disabled:opacity-40" :disabled="page >= totalPages" @click="page++">{{ t('common.nextPage') }}</button></div>
      </footer>
    </section>

    <MeasurementDialog v-if="store.canWrite.value" v-model:open="dialogOpen" :measurement="editing" />
  </div>
</template>
