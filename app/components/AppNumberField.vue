<script setup lang="ts" generic="T extends number | string | null | undefined">
const props = withDefaults(defineProps<{
  modelValue: T
  modelModifiers?: { number?: boolean }
  label: string
  hideLabel?: boolean
  min?: number
  max?: number
  step?: number | 'any'
  required?: boolean
  disabled?: boolean
  placeholder?: string
  suggestions?: number[]
  recent?: number
  inputClass?: string
  durationUnit?: 'hours' | 'minutes'
  unit?: string
}>(), { step: 1, suggestions: () => [], placeholder: '' })
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
const { t } = useI18n()
const inputId = useId()
const open = ref(false)
const draftHour = ref(0)
const draftMinute = ref(0)
const durationChanged = ref(false)
const minutesPerUnit = computed(() => props.durationUnit === 'hours' ? 60 : 1)
const minuteStep = computed(() => props.step === 'any' ? 1 : Math.min(60, Math.max(1, Math.round(props.step * minutesPerUnit.value))))
const maxMinutes = computed(() => Math.round((props.max ?? 24 * 60 / minutesPerUnit.value) * minutesPerUnit.value))
const maxHour = computed(() => Math.floor(maxMinutes.value / 60))
const maxMinute = computed(() => Math.min(59, maxMinutes.value - draftHour.value * 60))
const durationValue = computed(() => durationChanged.value
  ? Number(((draftHour.value * 60 + draftMinute.value) / minutesPerUnit.value).toFixed(2))
  : props.modelValue === '' || props.modelValue == null ? null : Number(props.modelValue))
const durationInvalid = computed(() => durationValue.value == null || !Number.isFinite(durationValue.value)
  || (props.min != null && durationValue.value < props.min) || (props.max != null && durationValue.value > props.max))
const candidates = computed(() => {
  const values = props.recent == null ? props.suggestions : [props.recent, ...props.suggestions]
  return [...new Set(values)].filter((value) => {
    if (!Number.isFinite(value) || (props.min != null && value < props.min) || (props.max != null && value > props.max)) return false
    if (props.step === 'any') return true
    const steps = (value - (props.min ?? 0)) / props.step
    return Math.abs(steps - Math.round(steps)) < 0.000001
  }).slice(0, 5)
})

function updateValue(value: string | number) {
  // Match native v-model.number; an empty optional field must remain empty, not zero.
  const next = props.modelModifiers?.number && value !== '' ? Number(value) : String(value)
  emit('update:modelValue', next as T)
}

watch(open, (value) => {
  if (!value) return
  const current = Number(props.modelValue)
  const minutes = Math.max(0, Math.min(maxMinutes.value, Math.round((Number.isFinite(current) ? current : 0) * minutesPerUnit.value)))
  draftHour.value = Math.floor(minutes / 60)
  draftMinute.value = Math.floor(minutes % 60 / minuteStep.value) * minuteStep.value
  durationChanged.value = false
})

function updateHour(value: number) {
  draftHour.value = value
  draftMinute.value = Math.min(draftMinute.value, Math.floor(maxMinute.value / minuteStep.value) * minuteStep.value)
  durationChanged.value = true
}

function confirmDuration() {
  if (durationInvalid.value || durationValue.value == null) return
  updateValue(durationValue.value)
  open.value = false
}
</script>

<template>
  <div class="min-w-0">
    <label :for="inputId" :class="hideLabel ? 'sr-only' : 'mb-2 block text-sm'">{{ label }}</label>
    <div class="flex items-center gap-2">
      <div class="relative min-w-0 flex-1">
        <input
          :id="inputId"
          :value="modelValue"
          type="number"
          :inputmode="step === 1 ? 'numeric' : 'decimal'"
          :min="min"
          :max="max"
          :step="step"
          :required="required"
          :disabled="disabled"
          :placeholder="placeholder"
          class="min-h-12 min-w-0 w-full rounded-xl border border-default bg-default px-3 py-2.5 text-base text-highlighted tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 sm:text-sm"
          :class="[inputClass, unit ? 'pr-12' : '']"
          @input="updateValue(($event.target as HTMLInputElement).value)"
        >
        <span v-if="unit" class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{{ unit }}</span>
      </div>
      <AppPickerPanel v-if="durationUnit" v-model:open="open" :title="label" :description="t('date.wheelHint')" :confirm-disabled="durationInvalid" @confirm="confirmDuration">
        <button type="button" :disabled="disabled" :aria-label="t('numberInput.chooseDuration', { label })" class="grid size-12 shrink-0 place-items-center rounded-xl border border-default text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60">
          <AppIcon name="clock" class="size-5" />
        </button>
        <template #content>
          <div class="flex items-end gap-3">
            <AppTimeWheel :model-value="draftHour" :max="maxHour" :label="t('date.hour')" @update:model-value="updateHour" />
            <span aria-hidden="true" class="flex h-[var(--wheel-height)] items-center text-2xl font-semibold text-muted">:</span>
            <AppTimeWheel :model-value="draftMinute" :max="maxMinute" :step="minuteStep" :label="t('date.minute')" @update:model-value="draftMinute = $event; durationChanged = true" />
          </div>
          <p class="mt-3 text-center text-sm text-muted">{{ t('numberInput.manualHint') }}</p>
        </template>
      </AppPickerPanel>
    </div>
    <div v-if="candidates.length && !disabled" role="group" :aria-label="t('numberInput.suggestions', { label })" class="mt-2 flex flex-wrap gap-1.5">
      <button
        v-for="value in candidates"
        :key="value"
        type="button"
        :aria-pressed="modelValue !== '' && modelValue != null && Number(modelValue) === value"
        class="min-h-11 min-w-11 flex-1 rounded-lg px-2 py-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :class="modelValue !== '' && modelValue != null && Number(modelValue) === value ? 'bg-primary/15 font-semibold text-highlighted' : 'bg-elevated text-muted hover:bg-primary/10 hover:text-highlighted'"
        @click="updateValue(value)"
      >
        <span v-if="value === recent" class="mr-1 text-xs">{{ t('numberInput.recent') }}</span>{{ value }}
      </button>
    </div>
  </div>
</template>
