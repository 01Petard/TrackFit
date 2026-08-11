<script setup lang="ts">
import type { HistoryRecordItem } from '../../shared/utils/history'
import type { LocalizedDescriptor } from '../../shared/utils/analytics'

defineProps<{
  items: HistoryRecordItem[]
  compact?: boolean
}>()

const { t } = useI18n()
const { formatDateTime, formatDescriptor } = useTrackFitI18n()
const kindLabels = computed(() => ({ body: t('history.body'), training: t('common.training'), sleep: t('common.sleep') }))
const kindClasses = {
  body: 'bg-primary/10 text-primary',
  training: 'bg-warning/10 text-warning',
  sleep: 'bg-indigo-500/10 text-indigo-500',
} as const

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
  <div data-testid="history-record-list" class="divide-y divide-default">
    <article
      v-for="item in items"
      :key="item.key"
      data-testid="history-record-item"
      :class="compact ? 'py-2.5' : 'py-4 sm:py-5'"
    >
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <strong class="text-sm">{{ renderCopy(item.title) }}</strong>
        <span class="rounded-md px-2 py-0.5 text-[11px] font-medium" :class="kindClasses[item.kind]">{{ kindLabels[item.kind] }}</span>
        <time class="text-xs text-muted">{{ formatDateTime(item.occurredAt) }}</time>
      </div>
      <div class="flex flex-wrap gap-1.5" :class="compact ? 'mt-1.5' : 'mt-3'">
        <span
          v-for="(detail, index) in item.details"
          :key="`${detail.key}-${index}`"
          class="rounded-lg bg-elevated font-medium text-highlighted"
          :class="compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'"
        >{{ renderCopy(detail) }}</span>
      </div>
      <p class="text-xs leading-5 text-muted" :class="compact ? 'mt-1 truncate' : 'mt-2'">{{ renderCopy(item.description) }}</p>
    </article>
  </div>
</template>
