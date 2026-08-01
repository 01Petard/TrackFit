<script setup lang="ts">
import type { AnalyticsDto } from '../../shared/types/api'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent])

const props = defineProps<{
  primary: AnalyticsDto
  secondary?: AnalyticsDto | null
  showMovingAverage: boolean
}>()

const option = computed(() => {
  const secondary = props.secondary
  const series = [
    {
      name: `${props.primary.metric.name} · 原始`,
      type: 'line',
      yAxisIndex: 0,
      symbolSize: 8,
      lineStyle: { width: 2, color: '#10b981' },
      itemStyle: { color: '#10b981' },
      data: props.primary.points.map(point => [point.measuredAt, point.value]),
    },
    ...(props.showMovingAverage ? [{
      name: `${props.primary.metric.name} · 7 条均线`,
      type: 'line',
      yAxisIndex: 0,
      showSymbol: false,
      lineStyle: { width: 2, type: 'dashed', color: '#f59e0b' },
      data: props.primary.points.filter(point => point.movingAverage != null).map(point => [point.measuredAt, point.movingAverage]),
    }] : []),
    ...(secondary ? [{
      name: secondary.metric.name,
      type: 'line',
      yAxisIndex: 1,
      symbolSize: 7,
      lineStyle: { width: 2, color: '#6366f1' },
      itemStyle: { color: '#6366f1' },
      data: secondary.points.map(point => [point.measuredAt, point.value]),
    }] : []),
  ]

  return {
    animationDuration: 450,
    grid: { left: 52, right: secondary ? 55 : 24, top: 64, bottom: 76 },
    tooltip: { trigger: 'axis' },
    legend: { type: 'scroll', top: 0, left: 'center' },
    xAxis: { type: 'time', axisLabel: { color: '#94a3b8', hideOverlap: true, margin: 12 } },
    yAxis: [
      { type: 'value', scale: true, name: props.primary.metric.unit, splitLine: { lineStyle: { color: 'rgba(148,163,184,.16)' } } },
      ...(secondary ? [{ type: 'value', scale: true, name: secondary.metric.unit, splitLine: { show: false } }] : []),
    ],
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 12 }],
    series,
  }
})
</script>

<template>
  <div v-if="primary.points.length" class="h-[420px] w-full"><VChart autoresize :option="option" /></div>
  <div v-else class="grid h-[420px] place-items-center text-sm text-muted">当前条件下没有数据</div>
</template>
