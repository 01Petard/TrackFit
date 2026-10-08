<script setup lang="ts">
import type { MovingAveragePeriod, MovingAveragePointDto } from '../../shared/types/api'
import type { LineSeriesOption } from 'echarts/charts'
import { resolveYAxisBounds } from '../../shared/utils/analytics'
import { chartTimeAxis, toDailyChartPoints } from '../utils/chart-axis'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent])
const { t } = useI18n()
const { focusSeries, onMouseOver, onMouseOut, onClick, onBlankClick } = useChartLineFocus()

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
  const averageSeries: LineSeriesOption[] = props.visibleMovingAverages.map(period => ({
    name: t(`common.movingAverage.${period}`),
    type: 'line',
    showSymbol: false,
    connectNulls: false,
    smooth: 0.35,
    smoothMonotone: 'x',
    lineStyle: { width: 2, type: 'dashed', color: colors[period] },
    itemStyle: { color: colors[period] },
    data: toDailyChartPoints(props.movingAverages[period]),
  }))
  return {
    animationDuration: 450,
    axisPointer: { triggerEmphasis: false },
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
      itemWidth: 24,
      itemHeight: 12,
      itemGap: 16,
      lineStyle: { type: 'solid', width: 2 },
      textStyle: { fontSize: 12, lineHeight: 18 },
      data: [t('chart.raw'), ...props.visibleMovingAverages.map(period => t(`common.movingAverage.${period}`))],
    },
    xAxis: chartTimeAxis,
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
    series: focusSeries([
      {
        name: t('chart.raw'),
        type: 'line',
        showSymbol: true,
        symbolSize: 8,
        connectNulls: false,
        lineStyle: { width: 2, color: '#10b981' },
        itemStyle: { color: '#10b981', borderColor: '#ecfdf5', borderWidth: 2 },
        areaStyle: { color: 'rgba(16,185,129,.08)' },
        data: toDailyChartPoints(props.points),
      },
      ...averageSeries,
    ]),
  }
})
</script>

<template>
  <div v-if="points.length" class="w-full" :style="{ height }">
    <VChart autoresize :option="option" @mouseover="onMouseOver" @mouseout="onMouseOut" @globalout="onMouseOut" @click="onClick" @zr:click="onBlankClick" />
  </div>
  <div v-else class="grid h-72 place-items-center rounded-2xl border border-dashed border-default text-sm text-muted">
    {{ t('chart.noData') }}
  </div>
</template>
