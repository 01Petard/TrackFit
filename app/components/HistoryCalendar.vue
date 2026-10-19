<script setup lang="ts">
import type { HistoryWeek } from '../../shared/utils/history'
import type { LocalizedDescriptor } from '../../shared/utils/analytics'
import { summarizeHistoryDay } from '../../shared/utils/history'
import dayjs from 'dayjs'

const props = defineProps<{
  weeks: HistoryWeek[]
  selectedDate?: string | null
  canWrite?: boolean
}>()
defineEmits<{
  select: [date: string]
}>()

const { t, locale } = useI18n()
const { formatDescriptor, formatDateTime } = useTrackFitI18n()
const kinds = computed(() => ({
  body: { label: t('history.body'), icon: 'weight' as const, color: 'text-primary' },
  training: { label: t('common.training'), icon: 'dumbbell' as const, color: 'text-orange-700' },
  sleep: { label: t('common.sleep'), icon: 'moon' as const, color: 'text-violet-600' },
}))
const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' }))
const weekdayFormatter = computed(() => new Intl.DateTimeFormat(locale.value === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short' }))
const calendarWeeks = computed(() => props.weeks.map(week => ({
  ...week,
  days: week.days.map(day => ({ ...day, canMakeup: props.canWrite && day.date <= dayjs().format('YYYY-MM-DD'), groups: summarizeHistoryDay(day.items) })),
})))

function renderCopy(copy: LocalizedDescriptor | { text: string }): string {
  if ('text' in copy) return copy.text
  if (copy.key === 'history.sleepDuration') {
    const minutes = Number(copy.values?.minutes ?? 0)
    return t(copy.key, { duration: t('common.hoursMinutes', { hours: Math.floor(minutes / 60), minutes: minutes % 60 }) })
  }
  if (copy.key === 'history.sleepWindow') return t(copy.key, {
    bedtime: formatDateTime(String(copy.values?.fellAsleepAt)),
    wakeTime: formatDateTime(String(copy.values?.wokeUpAt)),
  })
  return formatDescriptor(copy)
}
</script>

<template>
  <div data-testid="history-calendar" class="space-y-6">
    <section v-for="week in calendarWeeks" :key="week.key" data-testid="history-week" :aria-label="`${week.key} – ${week.days[6]!.date}`">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold tabular-nums text-highlighted">{{ dayjs(week.key).format('YYYY') }}<span class="mx-2 font-normal text-muted">/</span>{{ dateFormatter.format(dayjs(week.key).toDate()) }} – {{ dateFormatter.format(dayjs(week.days[6]!.date).toDate()) }}</h3>
        <span class="text-xs text-muted">{{ t('records.total', { count: week.days.reduce((sum, day) => sum + day.items.length, 0) }) }}</span>
      </div>
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-7 lg:gap-2">
        <button v-for="day in week.days" :key="day.date" type="button" data-testid="history-day" :data-date="day.date" :aria-label="`${day.date} · ${!day.items.length && day.canMakeup ? t('historyPage.addRecords') : t('records.total', { count: day.items.length })}`" class="history-day app-inner-card flex min-w-0 flex-col p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary enabled:hover:border-primary/50 enabled:hover:bg-primary/5" :class="{ 'history-day--empty': !day.items.length, 'history-day--today': day.date === dayjs().format('YYYY-MM-DD') || day.date === selectedDate }" @click="$emit('select', day.date)">
          <span class="mb-3 flex items-center justify-between gap-2 border-b border-default pb-3">
            <time :datetime="day.date" class="flex items-baseline gap-2 text-highlighted"><strong class="text-xl font-semibold tabular-nums">{{ dayjs(day.date).format('DD') }}</strong><span class="text-xs text-muted">{{ weekdayFormatter.format(dayjs(day.date).toDate()) }}</span></time>
            <span v-if="day.date === dayjs().format('YYYY-MM-DD')" class="rounded-md bg-primary/10 px-1.5 py-1 text-[10px] font-medium text-primary">{{ t('date.today') }}</span>
          </span>
          <span v-if="day.items.length" class="flex-1 divide-y divide-default">
            <span v-for="group in day.groups" :key="group.kind" data-testid="history-record-item" :data-record-kind="group.kind" :data-record-key="group.records.map(record => record.key).join(',')" class="block min-w-0 py-3 first:pt-0 last:pb-0">
              <span class="flex items-center justify-between gap-2">
                <span class="inline-flex items-center gap-1.5 text-xs font-semibold" :class="kinds[group.kind].color"><AppIcon :name="kinds[group.kind].icon" class="size-3.5 shrink-0" />{{ kinds[group.kind].label }}</span>
                <span v-if="group.records.length > 1" class="text-[10px] tabular-nums text-muted">{{ t('records.total', { count: group.records.length }) }}</span>
              </span>
              <span class="mt-1.5 block space-y-2 pl-5">
                <span v-for="summary in group.summaries" :key="summary.key" class="block text-xs leading-relaxed text-highlighted">
                  <span v-if="summary.title" class="block break-words">{{ renderCopy(summary.title) }}</span>
                  <span class="block break-words tabular-nums">{{ renderCopy(summary.detail) }}</span>
                </span>
              </span>
            </span>
          </span>
          <span v-else class="my-auto flex flex-col items-center gap-2 py-8 text-center text-xs" :class="day.canMakeup ? 'text-primary' : 'text-muted'"><span class="grid size-9 place-items-center rounded-full" :class="day.canMakeup ? 'bg-primary/10 text-primary' : 'bg-blue-50 text-blue-400'"><AppIcon :name="day.canMakeup ? 'plus' : 'calendar'" class="size-4" /></span>{{ t(day.canMakeup ? 'historyPage.addRecords' : 'historyPage.noDayRecords') }}</span>
          <span v-if="day.items.length" class="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary">{{ t('historyPage.viewDetails') }}<AppIcon name="arrowRight" class="size-3.5" /></span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.history-day { min-height: 230px; }
.history-day--empty { background: #f7fafc; }
.history-day--today { border-color: #8fd7b4; background: #f6fdf9; }
</style>
