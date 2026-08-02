<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  values: number[]
  color?: string
  label?: string
}>(), {
  color: '#10b981',
  label: '指标趋势折线',
})

const width = 220
const height = 64
const padding = 5
const coordinates = computed(() => {
  if (!props.values.length) return []
  const minimum = Math.min(...props.values)
  const maximum = Math.max(...props.values)
  const range = maximum - minimum
  return props.values.map((value, index) => ({
    x: props.values.length === 1 ? width / 2 : padding + index * ((width - padding * 2) / (props.values.length - 1)),
    y: range === 0 ? height / 2 : padding + (maximum - value) * ((height - padding * 2) / range),
  }))
})
const linePoints = computed(() => coordinates.value.map(point => `${point.x},${point.y}`).join(' '))
const areaPoints = computed(() => coordinates.value.length
  ? `${padding},${height - padding} ${linePoints.value} ${width - padding},${height - padding}`
  : '')
</script>

<template>
  <svg :aria-label="label" class="h-16 w-full" :viewBox="`0 0 ${width} ${height}`" role="img" preserveAspectRatio="none">
    <line x1="0" :y1="height / 2" :x2="width" :y2="height / 2" stroke="currentColor" stroke-opacity=".08" stroke-dasharray="4 4" />
    <polygon v-if="coordinates.length > 1" :points="areaPoints" :fill="color" fill-opacity=".1" />
    <polyline v-if="coordinates.length > 1" :points="linePoints" fill="none" :stroke="color" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
    <circle v-if="coordinates.length" :cx="coordinates.at(-1)?.x" :cy="coordinates.at(-1)?.y" r="3.5" :fill="color" />
  </svg>
</template>
