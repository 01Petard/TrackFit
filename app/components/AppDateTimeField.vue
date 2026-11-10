<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { parseDate } from '@internationalized/date'
import dayjs from 'dayjs'

const props = withDefaults(defineProps<{
  modelValue: string
  title: string
  description?: string
  prominent?: boolean
}>(), {
  description: '',
  prominent: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { locale, t } = useI18n()
const open = ref(false)
const choosingDate = ref(false)
const dateButton = ref<HTMLButtonElement>()
const draftDate = ref(dayjs().format('YYYY-MM-DD'))
const draftHour = ref(0)
const draftMinute = ref(0)
const draftSecond = ref('00')
const calendarLocale = computed(() => locale.value === 'zh' ? 'zh-CN' : 'en-US')
const calendarValue = computed(() => parseDate(draftDate.value))
const displayValue = computed(() => dayjs(props.modelValue).isValid() ? dayjs(props.modelValue).format('YYYY/M/D HH:mm') : t('date.select'))
const dateLabel = computed(() => new Intl.DateTimeFormat(calendarLocale.value, {
  year: 'numeric', month: 'short', day: 'numeric', weekday: 'short',
}).format(dayjs(draftDate.value).toDate()))

watch(open, (value) => {
  if (!value) return
  const date = dayjs(props.modelValue).isValid() ? dayjs(props.modelValue) : dayjs()
  draftDate.value = date.format('YYYY-MM-DD')
  draftHour.value = date.hour()
  draftMinute.value = date.minute()
  draftSecond.value = date.format('ss')
  choosingDate.value = false
})

async function selectDate(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || 'start' in value) return
  draftDate.value = (value as DateValue).toString()
  choosingDate.value = false
  await nextTick()
  dateButton.value?.focus()
}

function selectTimePart(hour: number, minute: number) {
  draftHour.value = hour
  draftMinute.value = minute
  draftSecond.value = '00'
}

function confirm() {
  const time = `${String(draftHour.value).padStart(2, '0')}:${String(draftMinute.value).padStart(2, '0')}:${draftSecond.value}`
  emit('update:modelValue', `${draftDate.value}T${time}`)
  open.value = false
}
</script>

<template>
  <AppPickerPanel v-model:open="open" :title="title" :description="description || t('date.wheelHint')" @confirm="confirm">
    <button
      type="button"
      :aria-label="`${title}：${displayValue}`"
      class="flex w-full items-center text-left text-sm text-highlighted outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30"
      :class="prominent ? 'group min-h-16 gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-3 shadow-sm hover:border-primary/50 hover:bg-primary/10' : 'gap-2.5 rounded-xl border border-default bg-default px-3 py-2.5 hover:border-primary/50'"
    >
      <span v-if="prominent" class="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-primary shadow-sm"><AppIcon name="clock" class="size-5" /></span>
      <AppIcon v-else name="clock" class="size-[18px] shrink-0 text-primary" />
      <span class="min-w-0 flex-1 truncate tabular-nums" :class="prominent ? 'text-base font-semibold' : ''">{{ displayValue }}</span>
      <span v-if="prominent" class="flex shrink-0 items-center gap-1 text-xs font-medium text-primary"><span class="hidden sm:inline">{{ t('common.edit') }}</span><AppIcon name="chevronRight" class="size-4" /></span>
    </button>

    <template #content>
      <button ref="dateButton" type="button" :aria-label="choosingDate ? t('date.selectTime') : `${t('date.changeDate')}：${dateLabel}`" :aria-expanded="choosingDate" class="mb-4 flex min-h-12 w-full items-center gap-2 rounded-xl bg-elevated px-3 py-3 text-sm text-highlighted outline-none hover:bg-accented focus-visible:ring-2 focus-visible:ring-primary" @click="choosingDate = !choosingDate">
        <AppIcon :name="choosingDate ? 'clock' : 'calendar'" class="size-5 shrink-0 text-primary" />
        <span class="flex-1 text-left">{{ dateLabel }}</span>
        <span class="shrink-0 font-medium text-primary">{{ choosingDate ? t('date.selectTime') : t('common.edit') }}</span>
      </button>
      <div v-if="choosingDate" class="flex justify-center">
        <UCalendar :model-value="calendarValue" :locale="calendarLocale" size="md" prevent-deselect initial-focus @update:model-value="selectDate" />
      </div>
      <div v-else class="flex items-end gap-3">
        <AppTimeWheel :model-value="draftHour" :max="23" :label="t('date.hour')" @update:model-value="selectTimePart($event, draftMinute)" />
        <span aria-hidden="true" class="flex h-[var(--wheel-height)] items-center text-2xl font-semibold text-muted">:</span>
        <AppTimeWheel :model-value="draftMinute" :max="59" :label="t('date.minute')" @update:model-value="selectTimePart(draftHour, $event)" />
      </div>
    </template>
  </AppPickerPanel>
</template>
