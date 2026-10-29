<script setup lang="ts">
import type { MovingAveragePeriod, MovingAveragePointDto } from '../../shared/types/api'
import type { BarSeriesOption, LineSeriesOption } from 'echarts/charts'
import { chartTimeAxis, toDailyChartPoints } from '../utils/chart-axis'
import { computed, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, BarChart, DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent])
const { t } = useI18n()
const { selected, onLegendClick, focusSeries, onMouseOver, onMouseOut, onClick, onBlankClick } = useChartLineFocus()
const rendered = ref(false)

const props = withDefaults(defineProps<{
  points: Array<{ measuredAt: string, value: number }>
  yAxisPoints?: Array<{ value: number }>
  movingAverages?: Record<MovingAveragePeriod, MovingAveragePointDto[]>
  visibleMovingAverages?: MovingAveragePeriod[]
  targetMinimum?: number | null
  targetMaximum?: number | null
  targetValue?: number | null
  metricCode?: string
  start?: string
  unit: string
  height?: string
  color?: string
  fixedLegend?: boolean
  chartType?: 'line' | 'bar'
}>(), {
  movingAverages: () => ({ 3: [], 7: [], 30: [], 90: [] }),
  visibleMovingAverages: () => [7],
  targetMinimum: null,
  targetMaximum: null,
  targetValue: null,
  metricCode: 'weight',
  height: '360px',
  color: '#10b981',
  fixedLegend: false,
  chartType: 'line',
})

const colors: Record<MovingAveragePeriod, string> = {
  3: '#f59e0b',
  7: '#0ea5e9',
  30: '#8a8172',
  90: '#ec4899',
}

const { xAxisBounds, yAxisBounds, xZoom, yZoom, onDataZoom } = useChartViewport(() => ({
  points: props.points,
  yAxisPoints: props.yAxisPoints,
  metricCode: props.metricCode,
  start: props.start,
  targetMinimum: props.targetMinimum,
  targetMaximum: props.targetMaximum,
  targetValue: props.targetValue,
  dayPadding: props.chartType === 'bar' ? 0.5 : 0,
}))

const option = computed(() => {
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
  const rawSeries: LineSeriesOption | BarSeriesOption = {
    name: t('chart.raw'),
    data: toDailyChartPoints(props.points),
    ...(props.chartType === 'bar'
      ? { type: 'bar', barMaxWidth: 28, itemStyle: { color: props.color, borderRadius: [4, 4, 0, 0] } }
      : { type: 'line', showSymbol: props.metricCode !== 'weight', symbolSize: 8, connectNulls: false, lineStyle: { width: props.metricCode === 'weight' ? 3 : 2, color: props.color }, itemStyle: { color: props.color, borderColor: '#fff', borderWidth: 2 }, areaStyle: { color: props.color, opacity: 0.06 } }),
    markLine: {
      silent: true,
      animation: false,
      symbol: ['none', 'none'],
      lineStyle: { color: '#d97706', type: 'dashed', width: 1.5 },
      label: {
        position: 'insideEndTop',
        color: '#b45309',
        backgroundColor: 'rgba(255,255,255,.94)',
        padding: [3, 6],
        borderRadius: 4,
        formatter: t('chart.target', { value: Number(props.targetValue?.toFixed(2) ?? 0), unit: props.unit }),
      },
      data: props.targetValue == null ? [] : [{ yAxis: props.targetValue }],
    },
  }
  return {
    animationDuration: 450,
    axisPointer: { triggerEmphasis: false },
    grid: { left: 48, right: 68, top: 58, bottom: 72 },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: unknown) => `${value} ${props.unit}`,
    },
    legend: {
      show: !props.fixedLegend,
      selectedMode: !props.fixedLegend,
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
    xAxis: { ...chartTimeAxis, ...xAxisBounds.value },
    yAxis: {
      type: 'value',
      scale: true,
      ...yAxisBounds.value,
      ...(props.chartType === 'bar' ? { min: 0 } : {}),
      name: props.unit,
      axisLabel: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,.16)' } },
    },
    dataZoom: [
      { id: 'x-inside', type: 'inside', xAxisIndex: 0, filterMode: 'none', ...xZoom.value },
      { id: 'x-slider', type: 'slider', xAxisIndex: 0, filterMode: 'none', height: 18, bottom: 12, ...xZoom.value },
      { id: 'y-inside', type: 'inside', yAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: 'shift', ...yZoom.value },
      { id: 'y-slider', type: 'slider', yAxisIndex: 0, filterMode: 'none', orient: 'vertical', width: 18, right: 8, ...yZoom.value },
    ],
    series: focusSeries([rawSeries, ...averageSeries]),
  }
})
watch(option, () => {
  rendered.value = false
})
</script>

<template>
  <div v-if="points.length" data-testid="metric-chart" class="relative w-full" :style="{ height }" :aria-busy="!rendered">
    <div v-if="fixedLegend" class="absolute inset-x-0 top-0 z-10 flex gap-2 overflow-x-auto px-2 sm:justify-center" role="group" :aria-label="t('chart.lineFocus')">
      <button v-for="item in [{ name: t('chart.raw'), color }, ...visibleMovingAverages.map(period => ({ name: t(`common.movingAverage.${period}`), color: colors[period] }))]" :key="item.name" type="button" class="flex shrink-0 items-center gap-2 rounded-lg px-2 py-1 text-xs transition-colors focus-visible:outline-2" :class="selected === item.name ? 'bg-elevated font-semibold text-highlighted ring-1 ring-default' : 'text-muted hover:bg-elevated'" :title="t('chart.lineFocus')" :aria-pressed="selected === item.name" @click="onLegendClick(item.name)">
        <span class="w-6 border-t-2" :style="{ borderColor: item.color, borderStyle: item.name === t('chart.raw') ? 'solid' : 'dashed' }" aria-hidden="true" />{{ item.name }}
      </button>
    </div>
    <VChart autoresize :option="option" @finished="rendered = true" @datazoom="onDataZoom" @mouseover="onMouseOver" @mouseout="onMouseOut" @globalout="onMouseOut" @click="onClick" @zr:click="onBlankClick" />
  </div>
  <div v-else class="grid h-72 place-items-center rounded-2xl border border-dashed border-default text-sm text-muted">
    {{ t('chart.noData') }}
  </div>
</template>
