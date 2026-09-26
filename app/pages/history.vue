<script setup lang="ts">
import type { HistoryRecordKind } from '../../shared/utils/history'

const store = useTrackFitData()
const { t } = useI18n()
const localePath = useLocalePath()
await store.ensureLoaded()

const kind = ref<'all' | HistoryRecordKind>('all')
const start = ref('')
const end = ref('')
const query = computed(() => ({
  kind: kind.value === 'all' ? undefined : kind.value,
  start: start.value ? new Date(`${start.value}T00:00:00`).toISOString() : undefined,
  end: end.value ? new Date(`${end.value}T23:59:59.999`).toISOString() : undefined,
}))
const records = computed(() => store.listHistoryRecords(query.value))
</script>

<template>
  <div>
    <PageHeader :title="t('historyPage.title')" :description="t('historyPage.description')">
      <NuxtLink :to="localePath('/')" class="app-btn app-btn--secondary"><AppIcon name="arrowRight" class="size-4 rotate-180" />{{ t('historyPage.back') }}</NuxtLink>
    </PageHeader>

    <section class="app-card mb-5 grid gap-3 rounded-2xl p-4 sm:grid-cols-3 sm:p-5">
      <label class="text-xs text-muted">
        {{ t('historyPage.kind') }}
        <select v-model="kind" data-testid="history-kind-filter" class="app-select mt-1.5 w-full border border-default text-sm text-highlighted">
          <option value="all">{{ t('historyPage.all') }}</option>
          <option value="body">{{ t('historyPage.body') }}</option>
          <option value="training">{{ t('historyPage.training') }}</option>
          <option value="sleep">{{ t('historyPage.sleep') }}</option>
        </select>
      </label>
      <div data-testid="history-start-date" class="text-xs text-muted">
        <span>{{ t('common.startDate') }}</span>
        <div class="mt-1.5"><AppDateField v-model="start" clearable :placeholder="t('common.anyStartDate')" /></div>
      </div>
      <div data-testid="history-end-date" class="text-xs text-muted">
        <span>{{ t('common.endDate') }}</span>
        <div class="mt-1.5"><AppDateField v-model="end" clearable :placeholder="t('common.anyEndDate')" /></div>
      </div>
    </section>

    <section class="app-card rounded-2xl p-4 sm:p-6">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-3 border-b border-default pb-4">
        <div class="app-section-heading"><span class="app-icon-tile"><AppIcon name="chart" class="size-6" /></span><div><h2>{{ t('historyPage.timeline') }}</h2><p>{{ t('historyPage.timelineDescription', { count: records.length }) }}</p></div></div>
        <span class="rounded-lg bg-elevated px-3 py-1.5 text-xs text-muted">{{ t('historyPage.readOnly') }}</span>
      </div>
      <UnifiedRecordList v-if="records.length" :items="records" />
      <div v-else class="grid min-h-64 place-items-center text-center text-sm text-muted">
        <div><p class="mb-2 text-3xl">⌁</p><p>{{ t('historyPage.empty') }}</p></div>
      </div>
    </section>
  </div>
</template>
