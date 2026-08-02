<script setup lang="ts">
import type { AnalyticsDto, MovingAveragePeriod } from '../../shared/types/api'
import { resolveYAxisBounds } from '../../shared/utils/analytics'
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
  visibleMovingAverages: MovingAveragePeriod[]
  targetMinimum?: number | null
  targetMaximum?: number | null
}>()

const colors: Record<MovingAveragePeriod, string> = {
  3: '#f59e0b',
  7: '#0ea5e9',
  30: '#8b5cf6',
  90: '#ec4899',
}

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
    ...props.visibleMovingAverages.map(period => ({
      name: `${props.primary.metric.name} · ${period} 日均线`,
      type: 'line',
      yAxisIndex: 0,
      showSymbol: false,
      smooth: 0.35,
      smoothMonotone: 'x',
      lineStyle: { width: 2, type: 'dashed', color: colors[period] },
      data: props.primary.movingAverages[period].map(point => [point.measuredAt, point.value]),
    })),
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
    grid: { left: 54, right: 78, top: 64, bottom: 76 },
    tooltip: { trigger: 'axis' },
    legend: { type: 'scroll', top: 0, left: 'center', right: 48 },
    xAxis: { type: 'time', axisLabel: { color: '#94a3b8', hideOverlap: true, margin: 12 } },
    yAxis: [
      {
        type: 'value',
        scale: true,
        ...resolveYAxisBounds(props.primary.metric.code, props.primary.points, props.targetMinimum, props.targetMaximum),
        name: props.primary.metric.unit,
        splitLine: { lineStyle: { color: 'rgba(148,163,184,.16)' } },
      },
      ...(secondary ? [{
        type: 'value',
        scale: true,
        ...resolveYAxisBounds(secondary.metric.code, secondary.points, props.targetMinimum, props.targetMaximum),
        name: secondary.metric.unit,
        splitLine: { show: false },
      }] : []),
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
      { type: 'slider', xAxisIndex: 0, filterMode: 'none', height: 18, bottom: 12 },
      { type: 'inside', yAxisIndex: secondary ? [0, 1] : 0, filterMode: 'none', zoomOnMouseWheel: 'shift' },
      { type: 'slider', yAxisIndex: secondary ? [0, 1] : 0, filterMode: 'none', orient: 'vertical', width: 18, right: 8 },
    ],
    series,
  }
})
</script>

<template>
  <div v-if="primary.points.length" class="h-[420px] w-full"><VChart autoresize :option="option" /></div>
  <div v-else class="grid h-[420px] place-items-center text-sm text-muted">当前条件下没有数据</div>
</template>
