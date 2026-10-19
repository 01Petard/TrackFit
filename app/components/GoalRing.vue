<script setup lang="ts">
const props = withDefaults(defineProps<{
  percent: number
  label: string
  color?: string
  textColor?: string
}>(), { color: '#10b981' })
const progress = computed(() => Math.min(100, Math.max(0, Math.round(props.percent))))
</script>

<template>
  <div class="relative grid size-20 shrink-0 place-items-center" role="img" :aria-label="`${label} ${progress}%`">
    <svg viewBox="0 0 80 80" class="absolute inset-0 size-full -rotate-90" aria-hidden="true"><circle cx="40" cy="40" r="33" fill="none" :stroke="color" stroke-width="7" opacity="0.14" /><circle cx="40" cy="40" r="33" fill="none" :stroke="color" stroke-width="7" stroke-linecap="round" pathLength="100" :stroke-dasharray="`${progress} 100`" /></svg>
    <strong class="text-sm font-semibold tabular-nums" :style="{ color: textColor ?? color }">{{ progress }}%</strong>
  </div>
</template>
