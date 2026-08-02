<script setup lang="ts">
import type { MovingAveragePeriod, MovingAveragePointDto } from '../../shared/types/api'
import { resolveYAxisBounds } from '../../shared/utils/analytics'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent])

const props = withDefaults(defineProps<{
  points: Array<{ measuredAt: string, value: number }>
  movingAverages?: Record<MovingAveragePeriod, MovingAveragePointDto[]>
  visibleMovingAverages?: MovingAveragePeriod[]
  targetMinimum?: number | null
  targetMaximum?: number | null
  metricCode?: string
  unit: string
  height?: string
}>(), {
  movingAverages: () => ({ 3: [], 7: [], 30: [], 90: [] }),
  visibleMovingAverages: () => [7],
  targetMinimum: null,
  targetMaximum: null,
  metricCode: 'weight',
  height: '360px',
})

const colors: Record<MovingAveragePeriod, string> = {
  3: '#f59e0b',
  7: '#0ea5e9',
  30: '#8b5cf6',
  90: '#ec4899',
}

const option = computed(() => {
  const yAxisBounds = resolveYAxisBounds(props.metricCode, props.points, props.targetMinimum, props.targetMaximum)
  const averageSeries = props.visibleMovingAverages.map(period => ({
    name: `${period} 日均线`,
    type: 'line',
    showSymbol: false,
    connectNulls: false,
    smooth: 0.35,
    smoothMonotone: 'x',
    lineStyle: { width: 2, type: 'dashed', color: colors[period] },
    data: props.movingAverages[period].map(point => [point.measuredAt, point.value]),
  }))
  return {
    animationDuration: 450,
    grid: { left: 48, right: 68, top: 58, bottom: 72 },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: unknown) => `${value} ${props.unit}`,
    },
    legend: {
      type: 'scroll',
      top: 0,
      left: 'center',
      right: 42,
      data: ['原始记录', ...props.visibleMovingAverages.map(period => `${period} 日均线`)],
    },
    xAxis: {
      type: 'time',
      axisLabel: { color: '#94a3b8', hideOverlap: true, margin: 12 },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    },
    yAxis: {
      type: 'value',
      scale: true,
      ...yAxisBounds,
      name: props.unit,
      axisLabel: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,.16)' } },
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
      { type: 'slider', xAxisIndex: 0, filterMode: 'none', height: 18, bottom: 12 },
      { type: 'inside', yAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: 'shift' },
      { type: 'slider', yAxisIndex: 0, filterMode: 'none', orient: 'vertical', width: 18, right: 8 },
    ],
    series: [
      {
        name: '原始记录',
        type: 'line',
        showSymbol: true,
        symbolSize: 8,
        connectNulls: false,
        lineStyle: { width: 2, color: '#10b981' },
        itemStyle: { color: '#10b981', borderColor: '#ecfdf5', borderWidth: 2 },
        areaStyle: { color: 'rgba(16,185,129,.08)' },
        data: props.points.map(point => [point.measuredAt, point.value]),
      },
      ...averageSeries,
    ],
  }
})
</script>

<template>
  <div v-if="points.length" class="w-full" :style="{ height }">
    <VChart autoresize :option="option" />
  </div>
  <div v-else class="grid h-72 place-items-center rounded-2xl border border-dashed border-default text-sm text-muted">
    暂无可分析的数据
  </div>
</template>
