<script setup lang="ts">
import dayjs from 'dayjs'

const props = withDefaults(defineProps<{
  modelValue: string
  title: string
  description?: string
}>(), { description: '' })

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()
const open = ref(false)
const draftHour = ref(0)
const draftMinute = ref(0)
const displayValue = computed(() => {
  const parsed = dayjs(`2000-01-01T${props.modelValue}`)
  return parsed.isValid() ? parsed.format('HH:mm') : t('date.selectTime')
})

watch(open, (value) => {
  if (!value) return
  const parsed = dayjs(`2000-01-01T${props.modelValue}`)
  const time = parsed.isValid() ? parsed : dayjs()
  draftHour.value = time.hour()
  draftMinute.value = time.minute()
})

function confirm() {
  emit('update:modelValue', `${String(draftHour.value).padStart(2, '0')}:${String(draftMinute.value).padStart(2, '0')}`)
  open.value = false
}
</script>

<template>
  <AppPickerPanel v-model:open="open" :title="title" :description="description || t('date.wheelHint')" @confirm="confirm">
    <button
      type="button"
      :aria-label="`${title}：${displayValue}`"
      class="flex w-full items-center gap-2.5 rounded-xl border border-default bg-default px-3 py-2.5 text-left text-sm text-highlighted outline-none transition hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <AppIcon name="clock" class="size-[18px] shrink-0 text-primary" />
      <span class="min-w-0 flex-1 truncate tabular-nums">{{ displayValue }}</span>
    </button>

    <template #content>
      <div class="flex items-end gap-3">
        <AppTimeWheel :model-value="draftHour" :max="23" :label="t('date.hour')" @update:model-value="draftHour = $event" />
        <span aria-hidden="true" class="flex h-[var(--wheel-height)] items-center text-2xl font-semibold text-muted">:</span>
        <AppTimeWheel :model-value="draftMinute" :max="59" :label="t('date.minute')" @update:model-value="draftMinute = $event" />
      </div>
    </template>
  </AppPickerPanel>
</template>
