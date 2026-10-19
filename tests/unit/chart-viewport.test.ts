import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import dayjs from 'dayjs'
import { useChartViewport } from '../../app/composables/useChartViewport'

describe('图表可调整视野', () => {
  const points = [
    { measuredAt: dayjs().subtract(180, 'day').toISOString(), value: 90 },
    { measuredAt: dayjs().subtract(1, 'day').toISOString(), value: 50 },
  ]

  it('初始显示最近时间和目标区间，完整边界仍覆盖更早和超出目标的记录', () => {
    const viewport = useChartViewport(() => ({ points, start: dayjs().subtract(30, 'day').toISOString(), metricCode: 'weight', targetMinimum: 60, targetMaximum: 75 }))
    expect(viewport.xAxisBounds.value.min).toBe(dayjs(points[0]!.measuredAt).startOf('day').valueOf())
    expect(viewport.xZoom.value.start).toBeGreaterThan(80)
    expect(viewport.xZoom.value.end).toBe(100)
    expect(viewport.yAxisBounds.value.min).toBeLessThan(50)
    expect(viewport.yAxisBounds.value.max).toBeGreaterThan(90)
    expect(viewport.yZoom.value.start).toBeGreaterThan(0)
    expect(viewport.yZoom.value.end).toBeLessThan(100)
  })

  it('保留用户缩放，切换时间选项时重置初始视野', async () => {
    const start = ref<string | undefined>(dayjs().subtract(30, 'day').toISOString())
    const viewport = useChartViewport(() => ({ points, start: start.value, metricCode: 'weight', targetMinimum: 60, targetMaximum: 75 }))
    viewport.onDataZoom({ batch: [{ dataZoomId: 'x-inside', start: 0, end: 60 }, { dataZoomId: 'y-slider', start: 0, end: 100 }] })
    await nextTick()
    expect(viewport.xZoom.value).toEqual({ start: 0, end: 60 })
    expect(viewport.yZoom.value).toEqual({ start: 0, end: 100 })
    start.value = undefined
    await nextTick()
    expect(viewport.xZoom.value).toEqual({ start: 0, end: 100 })
  })

  it('睡眠和训练目标始终包含在初始纵轴视野内，调整目标后同步更新', async () => {
    const target = ref(8)
    const viewport = useChartViewport(() => ({
      points: [{ measuredAt: points[0]!.measuredAt, value: 6 }],
      metricCode: 'sleep_duration',
      targetValue: target.value,
    }))
    expect(viewport.yAxisBounds.value.min).toBeLessThan(6)
    expect(viewport.yAxisBounds.value.max).toBeGreaterThan(8)
    target.value = 10
    await nextTick()
    expect(viewport.yAxisBounds.value.max).toBeGreaterThan(10)
    expect(viewport.yZoom.value).toEqual({ start: 0, end: 100 })

    const training = useChartViewport(() => ({ points: [{ measuredAt: points[0]!.measuredAt, value: 60 }], metricCode: 'training_duration', targetValue: 30 }))
    expect(training.yAxisBounds.value.min).toBeLessThan(30)
    expect(training.yAxisBounds.value.max).toBeGreaterThan(60)
  })

  it('柱状图坐标轴与缩放窗口均保留半天留白，完整显示首尾柱体', () => {
    const start = dayjs().subtract(30, 'day').toISOString()
    const viewport = useChartViewport(() => ({ points, start, metricCode: 'training_duration', dayPadding: 0.5 }))
    const bounds = viewport.xAxisBounds.value
    expect(bounds.min).toBe(dayjs(points[0]!.measuredAt).startOf('day').valueOf() - 43_200_000)
    expect(bounds.max).toBe(dayjs().startOf('day').valueOf() + 43_200_000)
    const visibleStart = bounds.min! + viewport.xZoom.value.start / 100 * (bounds.max! - bounds.min!)
    expect(visibleStart).toBeCloseTo(dayjs(start).startOf('day').valueOf() - 43_200_000, 0)
    expect(viewport.xZoom.value.end).toBe(100)
  })

  it('最近区间没有测量时仍保留历史记录，并支持对比指标更早的时间范围', () => {
    const viewport = useChartViewport(() => ({
      points: points.slice(0, 1),
      timePoints: [{ measuredAt: dayjs().subtract(365, 'day').toISOString() }, ...points.slice(0, 1)],
      start: dayjs().subtract(7, 'day').toISOString(),
      metricCode: 'waist',
      targetMinimum: 60,
      targetMaximum: 75,
    }))
    expect(viewport.xAxisBounds.value.min).toBe(dayjs().subtract(365, 'day').startOf('day').valueOf())
    expect(viewport.xZoom.value.start).toBeLessThan(viewport.xZoom.value.end)
    expect(viewport.yZoom.value).toEqual({ start: 0, end: 100 })
    expect(viewport.yAxisBounds.value).toEqual({})
  })
})
