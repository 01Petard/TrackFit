<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import dayjs from 'dayjs'
import { UDrawer, UPopover } from '#components'

const props = withDefaults(defineProps<{
  modelValue: string
  mode?: 'date' | 'datetime'
  placeholder?: string
  clearable?: boolean
  prominent?: boolean
}>(), {
  mode: 'date',
  placeholder: '',
  clearable: false,
  prominent: false,
})

const { locale, t } = useI18n()
const calendarLocale = computed(() => locale.value === 'zh' ? 'zh-CN' : 'en-US')

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const mobile = ref(false)
const overlayProps = computed(() => mobile.value
  ? {
      title: t(props.mode === 'datetime' ? 'date.selectDateTime' : 'date.select'),
      handleOnly: true,
      ui: { overlay: 'z-[70] bg-slate-950/30', content: 'z-[71] rounded-t-3xl max-h-[calc(100dvh-1rem)]' },
    }
  : {
      content: { align: 'start' as const, sideOffset: 8, collisionPadding: 12 },
      ui: { content: 'z-[70] max-h-[calc(100vh-2rem)] overflow-y-auto' },
    })
onMounted(() => {
  const query = window.matchMedia('(max-width: 639px)')
  mobile.value = query.matches
  const onChange = (event: MediaQueryListEvent) => {
    mobile.value = event.matches
  }
  query.addEventListener('change', onChange)
  onBeforeUnmount(() => query.removeEventListener('change', onChange))
})
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
  if (!props.modelValue) return props.placeholder || t('date.select')
  return new Intl.DateTimeFormat(calendarLocale.value, props.mode === 'datetime'
    ? { year: 'numeric', month: locale.value === 'zh' ? 'numeric' : 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }
    : { year: 'numeric', month: locale.value === 'zh' ? 'numeric' : 'short', day: 'numeric' }).format(new Date(props.modelValue))
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
  <component :is="mobile ? UDrawer : UPopover" v-model:open="open" v-bind="overlayProps">
    <div class="relative">
      <button type="button" class="flex w-full items-center text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30" :class="[modelValue ? 'text-highlighted' : 'text-muted', clearable && modelValue ? 'pr-10' : '', prominent ? 'group min-h-16 gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-3 shadow-sm hover:border-primary/50 hover:bg-primary/10' : 'gap-2.5 rounded-xl border border-default bg-default px-3 py-2.5 hover:border-primary/50']">
        <span v-if="prominent" class="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-primary shadow-sm"><AppIcon :name="mode === 'datetime' ? 'clock' : 'calendar'" class="size-5" /></span>
        <AppIcon v-else name="calendar" class="size-[18px] shrink-0 text-primary" />
        <span class="min-w-0 flex-1 truncate" :class="prominent ? 'text-base font-semibold tabular-nums' : ''">{{ displayValue }}</span>
        <span v-if="prominent" class="flex shrink-0 items-center gap-1 text-xs font-medium text-primary"><span class="hidden sm:inline">{{ t('common.edit') }}</span><AppIcon name="chevronRight" class="size-4" /></span>
      </button>
      <button v-if="clearable && modelValue" type="button" :aria-label="t('date.clear')" class="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-highlighted" @click.stop="emit('update:modelValue', '')">
        <AppIcon name="close" class="size-4" />
      </button>
    </div>

    <template #content>
      <div class="max-h-[calc(100dvh-2rem)] overflow-y-auto p-2" data-vaul-no-drag>
        <div v-if="mode === 'datetime'" class="px-2 pb-2">
          <p class="text-sm font-semibold text-highlighted">{{ t('date.selectDateTime') }}</p>
          <p class="mt-0.5 text-xs text-muted">{{ t('date.dateTimeHint') }}</p>
        </div>
        <UCalendar :model-value="calendarValue" :locale="calendarLocale" size="md" @update:model-value="selectDate" />
        <div v-if="mode === 'datetime'" class="mt-2 border-t border-default px-2 pt-3">
          <label class="block text-xs text-muted">
            {{ t('date.specificTime') }}
            <span class="mt-1.5 flex items-center gap-2">
              <AppIcon name="clock" class="size-[18px] shrink-0 text-primary" />
              <input :value="timeValue" type="time" step="1" class="min-w-0 flex-1 rounded-lg border border-default bg-default px-3 py-2 text-sm text-highlighted outline-none focus:border-primary" @input="updateTime">
            </span>
          </label>
          <div class="sticky bottom-0 z-10 mt-3 grid grid-cols-2 gap-2 bg-default py-1">
            <button type="button" class="rounded-lg bg-elevated px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10" @click="selectNow">{{ t('date.setNow') }}</button>
            <button type="button" class="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white" @click="open = false">{{ t('common.done') }}</button>
          </div>
        </div>
        <button v-else type="button" class="mt-2 w-full rounded-lg bg-elevated px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10" @click="selectToday">{{ t('date.today') }}</button>
      </div>
    </template>
  </component>
</template>
