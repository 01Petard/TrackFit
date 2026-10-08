import type { LineSeriesOption } from 'echarts/charts'
import { describe, expect, it } from 'vitest'
import { useChartLineFocus } from '../../app/composables/useChartLineFocus'

const series: LineSeriesOption[] = [
  { name: '原始数据', type: 'line', lineStyle: { color: '#10b981', width: 2 }, itemStyle: { color: '#10b981' }, areaStyle: { color: 'rgba(16,185,129,.08)' } },
  { name: '周均线', type: 'line', showSymbol: false, lineStyle: { color: '#0ea5e9', type: 'dashed', width: 2 } },
  { name: '月均线', type: 'line', showSymbol: false, lineStyle: { color: '#8b5cf6', type: 'dashed', width: 2 } },
]

describe('图表曲线聚焦', () => {
  it.each(['原始数据', '周均线'])('悬停%s时高亮该线并淡化其他曲线，移开后恢复', (name) => {
    const focus = useChartLineFocus()
    focus.onMouseOver({ componentType: 'series', seriesName: name })
    const focused = focus.focusSeries(series)
    expect(focused.find(item => item.name === name)?.lineStyle).toMatchObject({ width: 2, opacity: 1 })
    expect(focused.filter(item => item.name !== name).every(item => item.lineStyle?.opacity === 0.15 && item.itemStyle?.opacity === 0.15)).toBe(true)
    expect(focused[1]?.lineStyle).toMatchObject({ color: '#0ea5e9', type: 'dashed' })
    focus.onMouseOut()
    expect(focus.focusSeries(series).every(item => item.lineStyle?.width === 2 && item.lineStyle.opacity === 1)).toBe(true)
  })

  it('点击保持聚焦，悬停其他曲线时临时切换，移开后恢复点击的曲线', () => {
    const focus = useChartLineFocus()
    focus.onClick({ componentType: 'series', seriesName: '周均线' })
    focus.onMouseOver({ componentType: 'series', seriesName: '月均线' })
    expect(focus.focusSeries(series)[2]?.lineStyle?.opacity).toBe(1)
    expect(focus.focusSeries(series)[1]?.lineStyle?.opacity).toBe(0.15)
    focus.onMouseOut()
    expect(focus.focusSeries(series)[1]?.lineStyle?.opacity).toBe(1)
    expect(focus.focusSeries(series)[2]?.lineStyle?.opacity).toBe(0.15)
    expect(focus.focusSeries(series).every(item => item.lineStyle?.width === 2)).toBe(true)
    focus.onClick({ componentType: 'series', seriesName: '周均线' })
    expect(focus.focusSeries(series).every(item => item.lineStyle?.opacity === 1)).toBe(true)
  })

  it('点击空白处取消聚焦，点击滑块等图形不取消，聚焦均线时淡化原始面积', () => {
    const focus = useChartLineFocus()
    focus.onClick({ componentType: 'series', seriesName: '周均线' })
    focus.onBlankClick({ target: {} })
    expect(focus.focusSeries(series)[0]?.areaStyle?.opacity).toBe(0.1)
    focus.onBlankClick({})
    expect(focus.focusSeries(series).every(item => item.lineStyle?.opacity === 1)).toBe(true)
  })

  it('已聚焦曲线被隐藏时不淡化剩余曲线，也不改写原有曲线配置', () => {
    const focus = useChartLineFocus()
    focus.onClick({ componentType: 'series', seriesName: '月均线' })
    expect(focus.focusSeries(series.slice(0, 2)).every(item => item.lineStyle?.opacity === 1)).toBe(true)
    expect(series[0]?.lineStyle).toEqual({ color: '#10b981', width: 2 })
    expect(series[1]?.showSymbol).toBe(false)
  })
})
