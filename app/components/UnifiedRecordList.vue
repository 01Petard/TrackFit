<script setup lang="ts">
import type { HistoryRecordItem } from '../../shared/utils/history'
import type { LocalizedDescriptor } from '../../shared/utils/analytics'
import dayjs from 'dayjs'

const props = defineProps<{
  items: HistoryRecordItem[]
  compact?: boolean
}>()

const { t } = useI18n()
const { formatDateTime, formatDescriptor } = useTrackFitI18n()
const kindLabels = computed(() => ({ body: t('history.body'), training: t('common.training'), sleep: t('common.sleep') }))
const kindClasses = {
  body: 'bg-primary/10 text-primary',
  training: 'bg-primary/10 text-primary',
  sleep: 'bg-indigo-500/10 text-indigo-500',
} as const
const kindIcons = { body: 'weight', training: 'dumbbell', sleep: 'moon' } as const
const groups = computed(() => {
  const grouped = new Map<string, HistoryRecordItem[]>()
  for (const item of props.items) {
    const key = dayjs(item.occurredAt).format('YYYY-MM-DD')
    grouped.set(key, [...(grouped.get(key) ?? []), item])
  }
  return [...grouped.entries()].map(([key, items]) => {
    const date = dayjs(key)
    const label = new Intl.DateTimeFormat(locale.value === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(date.toDate())
    const relative = date.isSame(dayjs(), 'day') ? t('date.today') : date.isSame(dayjs().subtract(1, 'day'), 'day') ? t('historyPage.yesterday') : ''
    return { key, label, relative, items }
  })
})
const { locale } = useI18n()

function durationLabel(minutes: number): string {
  return t('common.hoursMinutes', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
}

function renderCopy(copy: LocalizedDescriptor | { text: string }): string {
  if ('text' in copy) return copy.text
  if (copy.key === 'history.sleepDuration') return t(copy.key, { duration: durationLabel(Number(copy.values?.minutes ?? 0)) })
  if (copy.key === 'history.sleepWindow') return t(copy.key, {
    bedtime: formatDateTime(String(copy.values?.fellAsleepAt)),
    wakeTime: formatDateTime(String(copy.values?.wokeUpAt)),
  })
  return formatDescriptor(copy)
}
</script>

<template>
  <div data-testid="history-record-list">
    <template v-if="compact">
      <div class="divide-y divide-default">
        <article v-for="item in items" :key="item.key" data-testid="history-record-item" class="flex items-center gap-3 py-3">
          <span class="app-icon-tile !size-9 !rounded-xl" :class="item.kind === 'sleep' ? 'app-icon-tile--purple' : ''"><AppIcon :name="kindIcons[item.kind]" class="size-4" /></span>
          <div class="min-w-0 flex-1"><div class="flex items-center gap-2"><strong class="truncate text-sm">{{ renderCopy(item.title) }}</strong><span class="rounded-md px-2 py-0.5 text-[11px] font-medium" :class="kindClasses[item.kind]">{{ kindLabels[item.kind] }}</span></div><p class="mt-1 truncate text-xs text-muted">{{ renderCopy(item.description) }}</p></div>
          <time class="shrink-0 text-[11px] text-muted">{{ formatDateTime(item.occurredAt) }}</time>
        </article>
      </div>
    </template>
    <template v-else>
      <section v-for="group in groups" :key="group.key" class="py-4 first:pt-3">
        <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-highlighted"><span class="size-2 rounded-full bg-primary" />{{ group.label }}<span v-if="group.relative" class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{{ group.relative }}</span></h3>
        <div class="space-y-2">
          <article v-for="item in group.items" :key="item.key" data-testid="history-record-item" class="grid grid-cols-[46px_12px_minmax(0,1fr)] gap-2 sm:grid-cols-[62px_12px_minmax(0,1fr)] sm:gap-3">
            <time class="pt-5 text-right text-xs tabular-nums text-muted">{{ dayjs(item.occurredAt).format('HH:mm') }}</time>
            <div class="relative flex justify-center"><span class="absolute bottom-[-10px] top-0 w-px bg-primary/20" /><span class="relative mt-[24px] size-2.5 rounded-full bg-primary ring-4 ring-white" :class="item.kind === 'sleep' ? '!bg-violet-500' : ''" /></div>
            <div class="flex min-w-0 flex-col gap-2 rounded-xl border border-default bg-white px-3 py-3 transition hover:bg-elevated/50 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
              <span class="app-icon-tile !size-10 !rounded-xl" :class="item.kind === 'sleep' ? 'app-icon-tile--purple' : ''"><AppIcon :name="kindIcons[item.kind]" class="size-5" /></span>
              <div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-x-2 gap-y-1"><strong class="text-sm">{{ renderCopy(item.title) }}</strong><span class="rounded-lg px-2 py-0.5 text-[11px] font-medium" :class="kindClasses[item.kind]">{{ kindLabels[item.kind] }}</span></div><p class="mt-1 truncate text-xs text-muted">{{ renderCopy(item.description) }}</p></div>
              <div class="flex flex-wrap gap-1 sm:max-w-[40%] sm:justify-end"><span v-for="(detail, index) in item.details" :key="`${detail.key}-${index}`" class="rounded-lg bg-elevated px-2 py-1 text-[11px] font-medium text-highlighted">{{ renderCopy(detail) }}</span></div>
            </div>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>
