<script setup lang="ts">
import type { AnalyticsDto, MovingAveragePeriod } from '../../shared/types/api'
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

const props = defineProps<{
  primary: AnalyticsDto
  secondary?: AnalyticsDto | null
  visibleMovingAverages: MovingAveragePeriod[]
  targetMinimum?: number | null
  targetMaximum?: number | null
  start?: string
}>()
const { t } = useI18n()
const { metricName } = useTrackFitI18n()
const { focusSeries, onMouseOver, onMouseOut, onClick, onBlankClick } = useChartLineFocus()

const colors: Record<MovingAveragePeriod, string> = {
  3: '#f59e0b',
  7: '#0ea5e9',
  30: '#8b5cf6',
  90: '#ec4899',
}

const { xAxisBounds, yAxisBounds, xZoom, yZoom, onDataZoom } = useChartViewport(() => ({
  points: props.primary.points,
  timePoints: props.secondary ? [...props.primary.points, ...props.secondary.points] : props.primary.points,
  metricCode: props.primary.metric.code,
  start: props.start,
  targetMinimum: props.targetMinimum,
  targetMaximum: props.targetMaximum,
}))

const option = computed(() => {
  const secondary = props.secondary
  const series: LineSeriesOption[] = [
    {
      name: `${metricName(props.primary.metric)} · ${t('chart.rawShort')}`,
      type: 'line',
      yAxisIndex: 0,
      symbolSize: 8,
      lineStyle: { width: 2, color: '#10b981' },
      itemStyle: { color: '#10b981' },
      data: toDailyChartPoints(props.primary.points),
    },
    ...props.visibleMovingAverages.map((period): LineSeriesOption => ({
      name: `${metricName(props.primary.metric)} · ${t(`common.movingAverage.${period}`)}`,
      type: 'line',
      yAxisIndex: 0,
      showSymbol: false,
      smooth: 0.35,
      smoothMonotone: 'x',
      lineStyle: { width: 2, type: 'dashed', color: colors[period] },
      itemStyle: { color: colors[period] },
      data: toDailyChartPoints(props.primary.movingAverages[period]),
    })),
    ...(secondary ? [{
      name: metricName(secondary.metric),
      type: 'line' as const,
      yAxisIndex: 1,
      symbolSize: 7,
      lineStyle: { width: 2, color: '#6366f1' },
      itemStyle: { color: '#6366f1' },
      data: toDailyChartPoints(secondary.points),
    }] : []),
  ]

  return {
    animationDuration: 450,
    grid: { left: 54, right: 78, top: 64, bottom: 76 },
    tooltip: { trigger: 'axis' },
    axisPointer: { triggerEmphasis: false },
    legend: {
      type: 'scroll',
      top: 0,
      left: 'center',
      right: 48,
      itemWidth: 24,
      itemHeight: 12,
      itemGap: 16,
      lineStyle: { type: 'solid', width: 2 },
      textStyle: { fontSize: 12, lineHeight: 18 },
    },
    xAxis: { ...chartTimeAxis, ...xAxisBounds.value },
    yAxis: [
      {
        type: 'value',
        scale: true,
        ...yAxisBounds.value,
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
      { id: 'x-inside', type: 'inside', xAxisIndex: 0, filterMode: 'none', ...xZoom.value },
      { id: 'x-slider', type: 'slider', xAxisIndex: 0, filterMode: 'none', height: 18, bottom: 12, ...xZoom.value },
      { id: 'y-inside', type: 'inside', yAxisIndex: secondary ? [0, 1] : 0, filterMode: 'none', zoomOnMouseWheel: 'shift', ...yZoom.value },
      { id: 'y-slider', type: 'slider', yAxisIndex: secondary ? [0, 1] : 0, filterMode: 'none', orient: 'vertical', width: 18, right: 8, ...yZoom.value },
    ],
    series: focusSeries(series),
  }
})
</script>

<template>
  <div v-if="primary.points.length || secondary?.points.length || visibleMovingAverages.some(period => primary.movingAverages[period].length)" class="h-[420px] w-full"><VChart autoresize :option="option" @datazoom="onDataZoom" @mouseover="onMouseOver" @mouseout="onMouseOut" @globalout="onMouseOut" @click="onClick" @zr:click="onBlankClick" /></div>
  <div v-else class="grid h-[420px] place-items-center text-sm text-muted">{{ t('chart.noMatchingData') }}</div>
</template>
