<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: number
  max: number
  label: string
  step?: number
}>(), { step: 1 })
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const wheel = ref<HTMLElement>()
const rowHeight = 44
const values = computed(() => Array.from({ length: Math.floor(props.max / props.step) + 1 }, (_, index) => index * props.step))

onMounted(() => {
  if (wheel.value) wheel.value.scrollTop = props.modelValue / props.step * rowHeight
})

watch(() => props.modelValue, (value) => {
  // Do not interrupt touch momentum when the parent reflects a scroll selection.
  if (wheel.value && Math.round(wheel.value.scrollTop / rowHeight) * props.step !== value) {
    wheel.value.scrollTop = value / props.step * rowHeight
  }
})

function select(value: number) {
  const next = Math.max(0, Math.min(Math.floor(props.max / props.step), Math.round(value / props.step))) * props.step
  if (wheel.value) wheel.value.scrollTop = next / props.step * rowHeight
  if (next !== props.modelValue) emit('update:modelValue', next)
}

function onScroll() {
  if (!wheel.value) return
  const next = Math.max(0, Math.min(Math.floor(props.max / props.step), Math.round(wheel.value.scrollTop / rowHeight))) * props.step
  if (next !== props.modelValue) emit('update:modelValue', next)
}

function onKeydown(event: KeyboardEvent) {
  let next = props.modelValue
  switch (event.key) {
    case 'ArrowUp':
      next += props.step
      break
    case 'ArrowDown':
      next -= props.step
      break
    case 'PageUp':
      next += 5 * props.step
      break
    case 'PageDown':
      next -= 5 * props.step
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = props.max
      break
    default: return
  }
  event.preventDefault()
  select(next)
}
</script>

<template>
  <div class="min-w-0 flex-1">
    <p class="mb-2 text-center text-sm text-muted">{{ label }}</p>
    <div class="relative">
      <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-[var(--wheel-padding)] h-11 rounded-xl bg-primary/10" />
      <div
        ref="wheel"
        role="spinbutton"
        tabindex="0"
        :aria-label="label"
        :aria-valuemin="0"
        :aria-valuemax="max"
        :aria-valuenow="modelValue"
        :aria-valuetext="String(modelValue).padStart(2, '0')"
        data-vaul-no-drag
        class="time-wheel scrollbar-hidden relative h-[var(--wheel-height)] touch-pan-y snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-xl py-[var(--wheel-padding)] outline-none focus-visible:ring-2 focus-visible:ring-primary"
        @scroll="onScroll"
        @keydown="onKeydown"
      >
        <button
          v-for="value in values"
          :key="value"
          type="button"
          tabindex="-1"
          :aria-label="`${label} ${String(value).padStart(2, '0')}`"
          class="flex h-11 w-full shrink-0 snap-center items-center justify-center text-2xl tabular-nums select-none"
          :class="value === modelValue ? 'font-semibold text-highlighted' : 'text-muted'"
          @click="select(value)"
        >
          {{ String(value).padStart(2, '0') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.time-wheel {
  mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
}
</style>
