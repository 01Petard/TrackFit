<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import dayjs from 'dayjs'

const props = withDefaults(defineProps<{
  modelValue: string
  mode?: 'date' | 'datetime'
  placeholder?: string
  clearable?: boolean
}>(), {
  mode: 'date',
  placeholder: '选择日期',
  clearable: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const calendarValue = computed<DateValue>(() => {
  const value = props.modelValue.slice(0, 10)
  try {
    return value ? parseDate(value) : today(getLocalTimeZone())
  } catch {
    return today(getLocalTimeZone())
  }
})
const timeValue = computed(() => props.modelValue.includes('T') ? props.modelValue.split('T')[1]?.slice(0, 8) ?? '00:00:00' : dayjs().format('HH:mm:ss'))
const displayValue = computed(() => {
  if (!props.modelValue) return props.placeholder
  return props.mode === 'datetime'
    ? dayjs(props.modelValue).format('YYYY年M月D日 HH:mm:ss')
    : dayjs(props.modelValue).format('YYYY年M月D日')
})

function selectDate(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || 'start' in value) return
  const date = (value as DateValue).toString()
  if (props.mode === 'date') {
    emit('update:modelValue', date)
    open.value = false
    return
  }
  emit('update:modelValue', `${date}T${timeValue.value}`)
}

function selectToday() {
  selectDate(today(getLocalTimeZone()))
}

function selectNow() {
  emit('update:modelValue', dayjs().format('YYYY-MM-DDTHH:mm:ss'))
  open.value = false
}

function updateTime(event: Event) {
  const value = (event.target as HTMLInputElement).value
  const date = props.modelValue.slice(0, 10) || today(getLocalTimeZone()).toString()
  emit('update:modelValue', `${date}T${value.length === 5 ? `${value}:00` : value}`)
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'start', sideOffset: 8 }" :ui="{ content: 'z-[70] max-h-[calc(100vh-2rem)] overflow-y-auto' }">
    <div class="relative">
      <button type="button" class="flex w-full items-center gap-2.5 rounded-xl border border-default bg-default px-3 py-2.5 text-left text-sm outline-none transition hover:border-primary/50 focus:border-primary" :class="[modelValue ? 'text-highlighted' : 'text-muted', clearable && modelValue ? 'pr-10' : '']">
        <AppIcon name="calendar" class="size-[18px] shrink-0 text-primary" />
        <span class="min-w-0 flex-1 truncate">{{ displayValue }}</span>
      </button>
      <button v-if="clearable && modelValue" type="button" aria-label="清除日期" class="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-highlighted" @click.stop="emit('update:modelValue', '')">
        <AppIcon name="close" class="size-4" />
      </button>
    </div>

    <template #content>
      <div class="p-2">
        <div v-if="mode === 'datetime'" class="px-2 pb-2">
          <p class="text-sm font-semibold text-highlighted">选择测量日期与时间</p>
          <p class="mt-0.5 text-xs text-muted">日期和时间均可修改</p>
        </div>
        <UCalendar :model-value="calendarValue" locale="zh-CN" size="md" @update:model-value="selectDate" />
        <div v-if="mode === 'datetime'" class="mt-2 border-t border-default px-2 pt-3">
          <label class="block text-xs text-muted">
            具体时间
            <span class="mt-1.5 flex items-center gap-2">
              <AppIcon name="clock" class="size-[18px] shrink-0 text-primary" />
              <input :value="timeValue" type="time" step="1" class="min-w-0 flex-1 rounded-lg border border-default bg-default px-3 py-2 text-sm text-highlighted outline-none focus:border-primary" @input="updateTime">
            </span>
          </label>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <button type="button" class="rounded-lg bg-elevated px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10" @click="selectNow">设为现在</button>
            <button type="button" class="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white" @click="open = false">完成</button>
          </div>
        </div>
        <button v-else type="button" class="mt-2 w-full rounded-lg bg-elevated px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10" @click="selectToday">今天</button>
      </div>
    </template>
  </UPopover>
</template>
