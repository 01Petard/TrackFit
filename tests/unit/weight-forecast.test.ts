import { describe, expect, it } from 'vitest'
import { buildAnalytics } from '../../shared/utils/analytics'
import { analyzeWeightForecast } from '../../shared/utils/weight-forecast'

function weightAnalytics(values: number[]) {
  const analytics = buildAnalytics(values.map((value, index) => ({
    id: index + 1,
    measuredAt: new Date(Date.UTC(2026, 8, index + 1, 8)),
    value,
  })))
  return {
    metric: { id: 1, code: 'weight', name: '体重', unit: 'kg', decimalPlaces: 2, minimumValue: 20, maximumValue: 400, metricType: 'core' as const, enabled: true, sortOrder: 10 },
    ...analytics,
  }
}

describe('体重趋势预测', () => {
  it('四条均线分别外推未来七天，且只在累积足够天数后给出结果', () => {
    const values = Array.from({ length: 97 }, (_, index) => 80 - index * 0.1)
    const result = analyzeWeightForecast(weightAnalytics(values), new Date('2026-12-06T08:00:00.000Z'))

    expect(result.forecastDate).toBe('2026-12-13T08:00:00.000Z')
    expect(result.projections.map(item => item.period)).toEqual([3, 7, 30, 90])
    expect(result.projections.every(item => item.value != null && item.direction === 'down')).toBe(true)
    expect(result.projections[0]?.value).toBeCloseTo(69.8, 2)
  })

  it('按上次体重的 0.5% 和 1% 阈值分级判断波动', () => {
    const stable = analyzeWeightForecast(weightAnalytics([100, 100.5]), new Date('2026-09-03T08:00:00.000Z'))
    expect(stable.fluctuation).toMatchObject({ lower: 99, upper: 101, changePercent: 0.5, status: 'stable' })

    const normal = analyzeWeightForecast(weightAnalytics([100, 101]), new Date('2026-09-03T08:00:00.000Z'))
    expect(normal.fluctuation).toMatchObject({ changePercent: 1, status: 'normal' })

    const above = analyzeWeightForecast(weightAnalytics([100, 101.01]), new Date('2026-09-03T08:00:00.000Z'))
    expect(above.fluctuation).toMatchObject({ status: 'warning' })

    const below = analyzeWeightForecast(weightAnalytics([100, 98.99]), new Date('2026-09-03T08:00:00.000Z'))
    expect(below.fluctuation).toMatchObject({ status: 'warning' })
  })

  it('稀疏记录经插值后可预测，但波动仍按两次实测值判断', () => {
    const analytics = buildAnalytics([
      { id: 1, measuredAt: '2026-09-01T08:00:00.000Z', value: 80 },
      { id: 2, measuredAt: '2026-09-08T08:00:00.000Z', value: 73 },
    ])
    const result = analyzeWeightForecast({
      metric: { id: 1, code: 'weight', name: '体重', unit: 'kg', decimalPlaces: 2, minimumValue: 20, maximumValue: 400, metricType: 'core', enabled: true, sortOrder: 10 },
      ...analytics,
    }, new Date('2026-09-08T08:00:00.000Z'))

    expect(result.projections[0]?.value).not.toBeNull()
    expect(result.projections[1]?.value).not.toBeNull()
    expect(result.projections[2]?.value).toBeNull()
    expect(result.fluctuation).toMatchObject({ previous: 80, latest: 73, status: 'warning' })
  })

  it('数据不足或最新测量过旧时不生成预测', () => {
    const insufficient = analyzeWeightForecast(weightAnalytics([70]), new Date('2026-09-02T08:00:00.000Z'))
    expect(insufficient.fluctuation).toBeNull()
    expect(insufficient.projections.every(item => item.value == null)).toBe(true)

    const stale = analyzeWeightForecast(weightAnalytics([70, 70.3, 70.6]), new Date('2026-09-20T08:00:00.000Z'))
    expect(stale.stale).toBe(true)
    expect(stale.projections.every(item => item.value == null)).toBe(true)
    expect(stale.fluctuation?.status).toBe('stable')
  })
})
