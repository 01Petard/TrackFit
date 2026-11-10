<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import { UDrawer, UPopover } from '#components'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  clearable?: boolean
  max?: string
}>(), {
  placeholder: '',
  clearable: false,
  max: '',
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
      title: t('date.select'),
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
const maxValue = computed<DateValue | undefined>(() => {
  if (!props.max) return undefined
  try {
    return parseDate(props.max)
  } catch {
    return undefined
  }
})
const todaySelectable = computed(() => maxValue.value == null || today(getLocalTimeZone()).compare(maxValue.value) <= 0)
const calendarValue = computed<DateValue>(() => {
  const value = props.modelValue.slice(0, 10)
  try {
    return value ? parseDate(value) : today(getLocalTimeZone())
  } catch {
    return today(getLocalTimeZone())
  }
})
const displayValue = computed(() => {
  if (!props.modelValue) return props.placeholder || t('date.select')
  return new Intl.DateTimeFormat(calendarLocale.value, { year: 'numeric', month: locale.value === 'zh' ? 'numeric' : 'short', day: 'numeric' }).format(new Date(props.modelValue))
})

function selectDate(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || 'start' in value) return
  emit('update:modelValue', (value as DateValue).toString())
  open.value = false
}

function selectToday() {
  selectDate(today(getLocalTimeZone()))
}
</script>

<template>
  <component :is="mobile ? UDrawer : UPopover" v-model:open="open" v-bind="overlayProps">
    <div class="relative">
      <button type="button" class="flex w-full items-center gap-2.5 rounded-xl border border-default bg-default px-3 py-2.5 text-left text-sm outline-none transition hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30" :class="[modelValue ? 'text-highlighted' : 'text-muted', clearable && modelValue ? 'pr-10' : '']">
        <AppIcon name="calendar" class="size-[18px] shrink-0 text-primary" />
        <span class="min-w-0 flex-1 truncate">{{ displayValue }}</span>
      </button>
      <button v-if="clearable && modelValue" type="button" :aria-label="t('date.clear')" class="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-highlighted" @click.stop="emit('update:modelValue', '')">
        <AppIcon name="close" class="size-4" />
      </button>
    </div>

    <template #content>
      <div class="max-h-[calc(100dvh-2rem)] overflow-y-auto p-2">
        <UCalendar :model-value="calendarValue" :max-value="maxValue" :locale="calendarLocale" size="md" @update:model-value="selectDate" />
        <button v-if="todaySelectable" type="button" class="mt-2 w-full rounded-lg bg-elevated px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10" @click="selectToday">{{ t('date.today') }}</button>
      </div>
    </template>
  </component>
</template>
