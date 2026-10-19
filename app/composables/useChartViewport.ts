import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { resolveYAxisBounds } from '../../shared/utils/analytics'

interface ChartViewportSource {
  points: ReadonlyArray<{ measuredAt: string, value: number }>
  timePoints?: ReadonlyArray<{ measuredAt: string }>
  metricCode: string
  start?: string
  targetMinimum?: number | null
  targetMaximum?: number | null
  targetValue?: number | null
  dayPadding?: number
}

interface DataZoomEvent {
  dataZoomId?: string
  start?: number
  end?: number
  batch?: DataZoomEvent[]
}

export function useChartViewport(source: () => ChartViewportSource) {
  const config = computed(source)
  const today = dayjs().startOf('day').valueOf()
  const xZoom = ref({ start: 0, end: 100 })
  const yZoom = ref({ start: 0, end: 100 })
  const yAxisBounds = computed(() => resolveYAxisBounds(config.value.metricCode, config.value.points, config.value.targetMinimum, config.value.targetMaximum, config.value.targetValue))
  const xAxisBounds = computed(() => {
    const input = config.value
    const times = (input.timePoints ?? input.points).map(point => dayjs(point.measuredAt).startOf('day').valueOf())
    if (!times.length) return {}
    const min = Math.min(...times, ...(input.start ? [dayjs(input.start).startOf('day').valueOf()] : []))
    const max = Math.max(...times, ...(input.start ? [today] : []))
    const padding = (input.dayPadding ?? 0) * 86400000
    // 单日记录也保留可拖动的时间窗口。
    return min === max ? { min: min - 86400000 - padding, max: max + 86400000 + padding } : { min: min - padding, max: max + padding }
  })

  watch([config, xAxisBounds, yAxisBounds], ([input, timeBounds, valueBounds]) => {
    const percent = (value: number, min: number, max: number) => Math.max(0, Math.min(100, (value - min) / (max - min) * 100))
    const padding = (input.dayPadding ?? 0) * 86400000
    xZoom.value = input.start && timeBounds.min != null && timeBounds.max != null
      ? { start: percent(dayjs(input.start).startOf('day').valueOf() - padding, timeBounds.min, timeBounds.max), end: percent(today + padding, timeBounds.min, timeBounds.max) }
      : { start: 0, end: 100 }
    // 目标区间仅决定初始视野，完整坐标轴仍覆盖区间外的实测记录。
    yZoom.value = input.metricCode === 'weight' && input.targetMinimum != null && input.targetMaximum != null && valueBounds.min != null && valueBounds.max != null
      ? { start: percent(input.targetMinimum, valueBounds.min, valueBounds.max), end: percent(input.targetMaximum, valueBounds.min, valueBounds.max) }
      : { start: 0, end: 100 }
  }, { immediate: true })

  function onDataZoom(event: DataZoomEvent) {
    for (const change of event.batch ?? [event]) {
      if (change.start == null || change.end == null) continue
      if (change.dataZoomId?.startsWith('x-')) xZoom.value = { start: change.start, end: change.end }
      if (change.dataZoomId?.startsWith('y-')) yZoom.value = { start: change.start, end: change.end }
    }
  }

  return { xAxisBounds, yAxisBounds, xZoom, yZoom, onDataZoom }
}
