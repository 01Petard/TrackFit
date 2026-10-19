<script setup lang="ts">
import type { BehaviorTimelineItemDto, MeasurementDto } from '../../shared/types/api'
import type { HistoryRecordItem, HistoryRecordKind } from '../../shared/utils/history'
import { getHistoryWindow } from '../../shared/utils/history'
import dayjs from 'dayjs'

const store = useTrackFitData()
const { t } = useI18n()
const { formatError } = useTrackFitI18n()
await store.ensureLoaded()
const kind = ref<'all' | HistoryRecordKind>('all')
const kinds = computed(() => [
  { value: 'all' as const, label: t('historyPage.all') },
  { value: 'body' as const, label: t('history.body') },
  { value: 'sleep' as const, label: t('common.sleep') },
  { value: 'training' as const, label: t('common.training') },
])
const start = ref('')
const end = ref('')
const page = ref(1)
const dialogOpen = ref(false)
const dialogKind = ref<'training' | 'sleep'>('training')
const editing = ref<BehaviorTimelineItemDto | null>(null)
const measurementOpen = ref(false)
const editingMeasurement = ref<MeasurementDto | null>(null)
const deletingKey = ref<string | null>(null)
const errorMessage = ref('')
const selectedDate = ref<string | null>(null)
const makeupDate = ref<string | null>(null)
const makeupOpen = ref(false)
const makeupKind = computed(() => kind.value === 'body' ? 'weight' as const : kind.value)
const query = computed(() => ({
  kind: kind.value === 'all' ? undefined : kind.value,
  start: start.value ? new Date(`${start.value}T00:00:00`).toISOString() : undefined,
  end: end.value ? new Date(`${end.value}T23:59:59.999`).toISOString() : undefined,
}))
const invalidRange = computed(() => !!start.value && !!end.value && start.value > end.value)
const records = computed(() => store.listHistoryRecords(query.value))
const anchor = computed(() => end.value && end.value < dayjs().format('YYYY-MM-DD') ? new Date(`${end.value}T12:00:00`) : new Date())
const recordWindow = computed(() => getHistoryWindow(records.value, page.value, anchor.value))
const totalPages = computed(() => recordWindow.value.totalPages)
const visibleRecords = computed(() => recordWindow.value.weeks.flatMap(week => week.days.flatMap(day => day.items)))
const selectedRecords = computed(() => records.value.filter(item => dayjs(item.occurredAt).format('YYYY-MM-DD') === selectedDate.value))

watch([kind, start, end], () => {
  page.value = 1
  selectedDate.value = null
})
watch(totalPages, (count) => {
  if (page.value > count) page.value = count
})
watch(page, () => {
  selectedDate.value = null
})

function openMakeup(date: string) {
  if (!store.canWrite.value || date > dayjs().format('YYYY-MM-DD')) return
  makeupDate.value = date
  selectedDate.value = null
  makeupOpen.value = true
}

function selectDate(date: string) {
  if (store.canWrite.value && date <= dayjs().format('YYYY-MM-DD') && !records.value.some(item => dayjs(item.occurredAt).format('YYYY-MM-DD') === date)) openMakeup(date)
  else selectedDate.value = date
}

function openCreate(recordKind: HistoryRecordKind) {
  if (recordKind === 'body') {
    editingMeasurement.value = null
    measurementOpen.value = true
  } else {
    editing.value = null
    dialogKind.value = recordKind
    dialogOpen.value = true
  }
}

function openEdit(item: HistoryRecordItem) {
  if (item.kind === 'body') {
    editingMeasurement.value = store.listMeasurements({ page: 1, pageSize: Number.MAX_SAFE_INTEGER }).items.find(record => record.id === item.id) ?? null
    if (editingMeasurement.value) measurementOpen.value = true
  } else {
    editing.value = store.listBehaviors().find(record => record.kind === item.kind && record.id === item.id) ?? null
    if (!editing.value) return
    dialogKind.value = item.kind
    dialogOpen.value = true
  }
}

async function remove(item: HistoryRecordItem) {
  const message = item.kind === 'body' ? t('records.confirmDelete') : t('behavior.confirmDelete', { kind: t(item.kind === 'training' ? 'common.training' : 'common.sleep') })
  if (!window.confirm(message)) return
  deletingKey.value = item.key
  errorMessage.value = ''
  try {
    if (item.kind === 'body') await store.deleteMeasurement(item.id)
    else if (item.kind === 'training') await store.deleteTraining(item.id)
    else await store.deleteSleep(item.id)
  } catch (error) {
    errorMessage.value = formatError(error)
  } finally {
    deletingKey.value = null
  }
}

function thisWeek() {
  start.value = ''
  end.value = ''
  page.value = 1
}
</script>

<template>
  <div>
    <PageHeader :title="t('historyPage.title')" :description="t('historyPage.description')">
      <div v-if="store.canWrite.value" class="grid grid-cols-3 gap-2 sm:flex">
        <button class="app-btn app-btn--secondary !px-3" :aria-label="`＋ ${t('history.body')}`" @click="openCreate('body')"><AppIcon name="plus" class="size-4" />{{ t('history.body') }}</button>
        <button class="app-btn app-btn--secondary !px-3" :aria-label="`＋ ${t('common.sleep')}`" @click="openCreate('sleep')"><AppIcon name="plus" class="size-4" />{{ t('common.sleep') }}</button>
        <button class="app-btn app-btn--primary !px-3" :aria-label="`＋ ${t('common.training')}`" @click="openCreate('training')"><AppIcon name="plus" class="size-4" />{{ t('common.training') }}</button>
      </div>
    </PageHeader>
    <RecordOverview />
    <section class="app-card rounded-3xl p-4 sm:p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div class="app-section-heading"><span class="app-icon-tile !size-9 !rounded-lg"><AppIcon name="calendar" class="size-5" /></span><div><h2>{{ t('historyPage.calendar') }}</h2><p>{{ t('historyPage.calendarDescription') }}</p></div></div>
        <div class="flex w-full flex-wrap items-center gap-2 xl:w-auto">
          <fieldset data-testid="history-kind-filter" class="w-full min-w-0 sm:w-auto sm:flex-1 xl:flex-none">
            <legend class="sr-only">{{ t('historyPage.kind') }}</legend>
            <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <span aria-hidden="true" class="shrink-0 text-xs text-muted">{{ t('historyPage.kind') }}</span>
              <div class="flex items-center gap-3">
                <label v-for="item in kinds" :key="item.value" class="flex min-h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs font-medium" :class="kind === item.value ? 'text-primary' : 'text-muted hover:text-highlighted'">
                  <input v-model="kind" type="radio" name="history-kind" :value="item.value" class="size-3.5 shrink-0 accent-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  {{ item.label }}
                </label>
              </div>
            </div>
          </fieldset>
          <div class="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1 xl:flex-none">
            <div class="flex min-w-0 flex-1 items-center justify-between rounded-xl border border-default">
              <button class="grid min-h-11 min-w-10 place-items-center rounded-l-xl text-muted enabled:hover:bg-elevated disabled:opacity-30" :aria-label="t('historyPage.olderWeeks')" :disabled="page >= totalPages" @click="page++"><AppIcon name="chevronRight" class="size-4 rotate-180" /></button>
              <span class="min-w-0 px-1 text-center text-xs font-medium tabular-nums">{{ recordWindow.start }} – {{ recordWindow.end }}</span>
              <button class="grid min-h-11 min-w-10 place-items-center rounded-r-xl text-muted enabled:hover:bg-elevated disabled:opacity-30" :aria-label="t('historyPage.newerWeeks')" :disabled="page <= 1" @click="page--"><AppIcon name="chevronRight" class="size-4" /></button>
            </div>
            <button class="app-btn app-btn--secondary !px-3 !text-xs" @click="thisWeek">{{ t('historyPage.thisWeek') }}</button>
          </div>
        </div>
      </div>
      <details class="mb-4 rounded-xl border border-default px-3 py-2.5">
        <summary class="cursor-pointer text-xs text-muted">{{ t('historyPage.dateFilter') }}<span v-if="start || end" class="ml-2 text-primary">{{ start || '…' }} – {{ end || '…' }}</span></summary>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <div data-testid="history-start-date" class="text-xs text-muted"><span>{{ t('common.startDate') }}</span><div class="mt-1.5"><AppDateField v-model="start" clearable :placeholder="t('common.anyStartDate')" /></div></div>
          <div data-testid="history-end-date" class="text-xs text-muted"><span>{{ t('common.endDate') }}</span><div class="mt-1.5"><AppDateField v-model="end" clearable :placeholder="t('common.anyEndDate')" /></div></div>
        </div>
      </details>
      <p v-if="errorMessage" role="alert" class="mb-4 text-sm text-error">{{ errorMessage }}</p>
      <p v-if="invalidRange" role="alert" class="mb-4 text-sm text-error">{{ t('historyPage.invalidRange') }}</p>
      <p v-if="!visibleRecords.length" class="mb-4 rounded-xl bg-elevated/40 px-3 py-2 text-xs text-muted">{{ t('historyPage.empty') }}</p>
      <HistoryCalendar :weeks="recordWindow.weeks" :selected-date="selectedDate" :can-write="store.canWrite.value" @select="selectDate" />
      <footer class="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4 text-xs text-muted">
        <span>{{ t('records.total', { count: visibleRecords.length }) }} · {{ t('historyPage.pageSize', { count: 4 }) }}<span v-if="!store.canWrite.value" class="ml-2">{{ t('historyPage.readOnly') }}</span></span>
        <nav class="flex items-center gap-2" :aria-label="t('historyPage.pagination')"><button class="app-btn app-btn--secondary !px-3 !text-xs" :disabled="page <= 1" @click="page--">{{ t('common.previousPage') }}</button><span data-testid="history-page" class="min-w-12 text-center tabular-nums" aria-live="polite">{{ recordWindow.page }} / {{ totalPages }}</span><button class="app-btn app-btn--secondary !px-3 !text-xs" :disabled="page >= totalPages" @click="page++">{{ t('common.nextPage') }}</button></nav>
      </footer>
    </section>

    <Teleport to="body">
      <div v-if="selectedDate" class="fixed inset-0 z-40 grid items-end bg-slate-950/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" @click.self="selectedDate = null" @keydown.esc="selectedDate = null">
        <section role="dialog" aria-modal="true" :aria-label="t('historyPage.dayDetails', { date: selectedDate })" class="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 shadow-xl sm:max-w-3xl sm:rounded-3xl sm:p-6">
          <header class="mb-3 flex flex-wrap items-center justify-between gap-3"><div class="app-section-heading"><span class="app-icon-tile"><AppIcon name="calendar" class="size-5" /></span><div><h2>{{ t('historyPage.dayDetails', { date: selectedDate }) }}</h2><p>{{ t('records.total', { count: selectedRecords.length }) }}</p></div></div><div class="flex items-center gap-2"><button v-if="store.canWrite.value && selectedDate <= dayjs().format('YYYY-MM-DD')" class="app-btn app-btn--secondary !px-3 !text-xs" @click="openMakeup(selectedDate)"><AppIcon name="plus" class="size-4" />{{ t('makeup.singleName') }}</button><button autofocus class="grid size-10 shrink-0 place-items-center rounded-full bg-elevated text-muted" :aria-label="t('historyPage.closeDetails')" @click="selectedDate = null"><AppIcon name="close" class="size-5" /></button></div></header>
          <p v-if="errorMessage" role="alert" class="mb-3 text-sm text-error">{{ errorMessage }}</p>
          <UnifiedRecordList :items="selectedRecords">
            <template #actions="{ item }"><div v-if="store.canWrite.value" class="flex shrink-0 gap-1 text-xs"><button class="min-h-10 rounded-lg px-2 text-primary hover:bg-primary/10 disabled:opacity-40" :disabled="deletingKey === item.key" @click="openEdit(item)">{{ t('common.edit') }}</button><button class="min-h-10 rounded-lg px-2 text-error hover:bg-error/10 disabled:opacity-40" :disabled="deletingKey === item.key" @click="remove(item)">{{ t('common.delete') }}</button></div></template>
          </UnifiedRecordList>
          <p v-if="!selectedRecords.length" class="py-10 text-center text-sm text-muted">{{ t('historyPage.noDayRecords') }}</p>
        </section>
      </div>
    </Teleport>
    <BehaviorDialog v-if="store.canWrite.value" v-model:open="dialogOpen" :kind="dialogKind" :item="editing" />
    <MeasurementDialog v-if="store.canWrite.value" v-model:open="measurementOpen" :measurement="editingMeasurement" />
    <MakeupDialog v-if="store.canWrite.value" v-model:open="makeupOpen" :date="makeupDate" :kind="makeupKind" calendar @saved="selectedDate = makeupDate" />
  </div>
</template>
