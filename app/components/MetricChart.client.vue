<script setup lang="ts">
import type { AnalyticsPointDto } from '../../shared/types/api'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, ScatterChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, ScatterChart, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent])

const props = withDefaults(defineProps<{
  points: AnalyticsPointDto[]
  unit: string
  showMovingAverage?: boolean
  height?: string
}>(), {
  showMovingAverage: true,
  height: '360px',
})

const option = computed(() => ({
  animationDuration: 450,
  grid: { left: 48, right: 22, top: 42, bottom: props.points.length > 20 ? 72 : 42 },
  tooltip: {
    trigger: 'axis',
    valueFormatter: (value: unknown) => `${value} ${props.unit}`,
  },
  legend: { data: props.showMovingAverage ? ['原始记录', '最近 7 条移动平均'] : ['原始记录'] },
  xAxis: {
    type: 'time',
    axisLabel: { color: '#94a3b8' },
    axisLine: { lineStyle: { color: '#cbd5e1' } },
  },
  yAxis: {
    type: 'value',
    scale: true,
    name: props.unit,
    axisLabel: { color: '#94a3b8' },
    splitLine: { lineStyle: { color: 'rgba(148,163,184,.16)' } },
  },
  dataZoom: props.points.length > 20
    ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 12 }]
    : [{ type: 'inside' }],
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
    ...(props.showMovingAverage
      ? [{
          name: '最近 7 条移动平均',
          type: 'line',
          showSymbol: false,
          lineStyle: { width: 2, type: 'dashed', color: '#f59e0b' },
          data: props.points.filter(point => point.movingAverage != null).map(point => [point.measuredAt, point.movingAverage]),
        }]
      : []),
  ],
}))
</script>

<template>
  <div v-if="points.length" class="w-full" :style="{ height }">
    <VChart autoresize :option="option" />
  </div>
  <div v-else class="grid h-72 place-items-center rounded-2xl border border-dashed border-default text-sm text-muted">
    暂无可分析的数据
  </div>
</template>

