import { describe, expect, it } from 'vitest'
import { init, use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent } from 'echarts/components'
import { chartTimeAxis, toDailyChartPoints } from '../../app/utils/chart-axis'

use([SVGRenderer, LineChart, DataZoomComponent, GridComponent])

function renderedLabels(width: number, start: Date, end: Date) {
  const chart = init(null, undefined, { ssr: true, renderer: 'svg', width, height: 420 })
  try {
    chart.setOption({
      animation: false,
      grid: { left: 54, right: 78, top: 64, bottom: 76 },
      xAxis: chartTimeAxis,
      yAxis: { type: 'value' },
      dataZoom: [{ type: 'inside', filterMode: 'none' }],
      series: [{ type: 'line', data: [
        [new Date(2026, 6, 1).getTime(), 80],
        [new Date(2027, 0, 8).getTime(), 70],
      ] }],
    })
    chart.dispatchAction({ type: 'dataZoom', startValue: start.getTime(), endValue: end.getTime() })
    return [...chart.renderToSVGString().matchAll(/<text[^>]*>(.*?)<\/text>/g)].map(match => match[1])
  } finally {
    chart.dispose()
  }
}

describe('图表日期刻度', () => {
  it('桌面缩放到一周时逐日显示日期，包括跨月和无测量记录的日期', () => {
    const labels = renderedLabels(1100, new Date(2026, 6, 29), new Date(2026, 7, 5))
    for (const date of ['07-29', '07-30', '07-31', '08-01', '08-02', '08-03', '08-04', '08-05']) {
      expect(labels).toContain(date)
    }
  })

  it('手机缩放到两天时显示所有日期，跨年时带上年份', () => {
    const labels = renderedLabels(390, new Date(2026, 11, 31), new Date(2027, 0, 2))
    expect(labels).toContain('12-31')
    expect(labels).toContain('01-01')
    expect(labels).toContain('01-02')
    expect(labels).toContain('2027')
  })

  it('日内缩放不生成时分秒刻度', () => {
    const labels = renderedLabels(1100, new Date(2026, 7, 1), new Date(2026, 7, 2))
    expect(labels).toContain('08-01')
    expect(labels.some(label => /\d{2}:\d{2}/.test(label ?? ''))).toBe(false)
  })

  it('同一天的实测点和均线对齐当天零点，保留每条原始记录及数值', () => {
    const points = [
      { measuredAt: new Date(2026, 7, 19, 8, 2, 22).toISOString(), value: 75.29 },
      { measuredAt: new Date(2026, 7, 19, 20, 15).toISOString(), value: 75.1 },
      { measuredAt: new Date(2026, 7, 20, 7, 30).toISOString(), value: 75 },
    ]
    const original = structuredClone(points)
    expect(toDailyChartPoints(points)).toEqual([
      [new Date(2026, 7, 19).getTime(), 75.29],
      [new Date(2026, 7, 19).getTime(), 75.1],
      [new Date(2026, 7, 20).getTime(), 75],
    ])
    expect(points).toEqual(original)
    expect(chartTimeAxis.axisPointer.label.formatter({ value: new Date(2026, 7, 19).getTime() })).toBe('08-19')
  })
})
