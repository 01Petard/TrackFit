<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { parseDate } from '@internationalized/date'
import dayjs from 'dayjs'
import { UDrawer, UPopover } from '#components'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { locale, t } = useI18n()
const open = ref(false)
const mobile = ref(false)
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
const overlayProps = computed(() => mobile.value
  ? {
      title: t('behaviorDialog.bedtime'),
      description: t('date.wheelHint'),
      handleOnly: true,
      ui: { overlay: 'z-[70] bg-slate-950/30', content: 'z-[71] rounded-t-3xl max-h-[calc(100dvh-1rem)]' },
    }
  : {
      content: { 'align': 'start' as const, 'sideOffset': 8, 'collisionPadding': 12, 'aria-label': t('behaviorDialog.bedtime') },
      ui: { content: 'z-[70] w-[340px] max-w-[calc(100vw-1.5rem)] rounded-2xl overflow-hidden' },
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

function confirm() {
  const time = `${String(draftHour.value).padStart(2, '0')}:${String(draftMinute.value).padStart(2, '0')}:${draftSecond.value}`
  emit('update:modelValue', `${draftDate.value}T${time}`)
  open.value = false
}
</script>

<template>
  <component :is="mobile ? UDrawer : UPopover" v-model:open="open" v-bind="overlayProps">
    <button type="button" :aria-label="`${t('behaviorDialog.bedtime')}：${displayValue}`" class="flex min-h-12 w-full items-center gap-2.5 rounded-xl border border-default bg-default px-3 py-3 text-left text-sm text-highlighted outline-none transition hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary">
      <AppIcon name="clock" class="size-5 shrink-0 text-primary" />
      <span class="min-w-0 flex-1 truncate tabular-nums">{{ displayValue }}</span>
      <span class="shrink-0 text-xs text-muted">{{ t('common.edit') }}</span>
    </button>

    <template #content>
      <div class="bedtime-panel flex max-h-[calc(100dvh-3rem)] min-h-0 flex-col sm:max-h-[min(520px,var(--reka-popover-content-available-height))]" data-vaul-no-drag>
        <header class="shrink-0 px-5 pt-5 pb-3">
          <h3 class="text-lg font-semibold text-highlighted">{{ t('behaviorDialog.bedtime') }}</h3>
          <p class="bedtime-hint mt-1 text-sm text-muted">{{ t('date.wheelHint') }}</p>
        </header>
        <div class="min-h-0 overflow-y-auto overscroll-contain px-5 pb-3">
          <button ref="dateButton" type="button" :aria-label="choosingDate ? t('date.selectTime') : `${t('date.changeDate')}：${dateLabel}`" :aria-expanded="choosingDate" class="mb-4 flex min-h-12 w-full items-center gap-2 rounded-xl bg-elevated px-3 py-3 text-sm text-highlighted outline-none hover:bg-accented focus-visible:ring-2 focus-visible:ring-primary" @click="choosingDate = !choosingDate">
            <AppIcon :name="choosingDate ? 'clock' : 'calendar'" class="size-5 shrink-0 text-primary" />
            <span class="flex-1 text-left">{{ dateLabel }}</span>
            <span class="shrink-0 font-medium text-primary">{{ choosingDate ? t('date.selectTime') : t('common.edit') }}</span>
          </button>
          <div v-if="choosingDate" class="flex justify-center">
            <UCalendar :model-value="calendarValue" :locale="calendarLocale" size="md" prevent-deselect initial-focus @update:model-value="selectDate" />
          </div>
          <div v-else class="flex items-end gap-3">
            <AppTimeWheel :model-value="draftHour" :max="23" :label="t('date.hour')" @update:model-value="draftHour = $event; draftSecond = '00'" />
            <span aria-hidden="true" class="flex h-[var(--wheel-height)] items-center text-2xl font-semibold text-muted">:</span>
            <AppTimeWheel :model-value="draftMinute" :max="59" :label="t('date.minute')" @update:model-value="draftMinute = $event; draftSecond = '00'" />
          </div>
        </div>
        <footer class="grid shrink-0 grid-cols-2 gap-3 border-t border-default bg-default px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" class="min-h-12 rounded-xl border border-default px-4 py-3 font-medium outline-none hover:bg-elevated focus-visible:ring-2 focus-visible:ring-primary" @click="open = false">{{ t('common.cancel') }}</button>
          <button type="button" class="min-h-12 rounded-xl bg-primary px-4 py-3 font-semibold text-white outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" @click="confirm">{{ t('date.confirm') }}</button>
        </footer>
      </div>
    </template>
  </component>
</template>

<style scoped>
.bedtime-panel {
  --wheel-padding: 88px;
  --wheel-height: 220px;
}

@media (min-width: 640px) and (max-height: 800px) {
  .bedtime-panel {
    --wheel-padding: 44px;
    --wheel-height: 132px;
  }

  .bedtime-hint {
    display: none;
  }
}
</style>
