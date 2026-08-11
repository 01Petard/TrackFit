import { describe, expect, it } from 'vitest'
import { buildAnalytics, buildMetricTrendInsight, calculateBmi, calculateWaistHipRatio, resolveYAxisBounds } from '../../shared/utils/analytics'

describe('身体指标计算', () => {
  it('计算 BMI 并保留两位小数', () => {
    expect(calculateBmi(70, 175)).toBe(22.86)
    expect(calculateBmi(undefined, 175)).toBeNull()
  })

  it('只在腰围和臀围都有效时计算腰臀比', () => {
    expect(calculateWaistHipRatio(80, 100)).toBe(0.8)
    expect(calculateWaistHipRatio(80, undefined)).toBeNull()
  })

  it('体重图表优先使用用户上下限，否则使用数据极值', () => {
    const points = [{ value: 68.5 }, { value: 72.3 }, { value: 70 }]
    expect(resolveYAxisBounds('weight', points, 60, 75)).toEqual({ min: 60, max: 75 })
    expect(resolveYAxisBounds('weight', points)).toEqual({ min: 68.5, max: 72.3 })
    expect(resolveYAxisBounds('waist', points, 60, 75)).toEqual({})
  })

  it('结合七天变化和目标体重生成友好评价', () => {
    const analytics = buildAnalytics([
      { id: 1, measuredAt: '2026-07-01T08:00:00.000Z', value: 80 },
      { id: 2, measuredAt: '2026-07-07T08:00:00.000Z', value: 76 },
    ])
    const insight = buildMetricTrendInsight({
      metric: {
        id: 1,
        code: 'weight',
        name: '体重',
        unit: 'kg',
        decimalPlaces: 1,
        minimumValue: 20,
        maximumValue: 400,
        metricType: 'core',
        enabled: true,
        sortOrder: 10,
      },
      ...analytics,
    }, 60, 75)

    expect(insight).toMatchObject({
      direction: 'down',
      trend: { key: 'insights.trend.approaching' },
      change: { key: 'insights.change.down', values: { amount: 4, unit: 'kg' } },
      evaluation: { key: 'insights.evaluation.weightAboveApproaching' },
      tone: 'positive',
    })
  })
})

describe('原始时间序列分析', () => {
  const points = Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    measuredAt: new Date(Date.UTC(2026, 6, 1, 8, index)),
    value: 80 - index,
  }))

  it('保留同一天的全部测量并按精确时间排序', () => {
    const result = buildAnalytics([...points].reverse())
    expect(result.points).toHaveLength(8)
    expect(result.points[0]?.id).toBe(1)
    expect(result.points.at(-1)?.id).toBe(8)
  })

  it('先计算每日均值，再计算各周期日均线', () => {
    const dailyPoints = [
      { id: 1, measuredAt: '2026-07-01T08:00:00.000Z', value: 80 },
      { id: 2, measuredAt: '2026-07-01T12:00:00.000Z', value: 82 },
      { id: 3, measuredAt: '2026-07-02T08:00:00.000Z', value: 78 },
      { id: 4, measuredAt: '2026-07-03T08:00:00.000Z', value: 75 },
      { id: 5, measuredAt: '2026-07-04T08:00:00.000Z', value: 72 },
    ]
    const result = buildAnalytics(dailyPoints)

    expect(result.movingAverages[3]).toEqual([
      { measuredAt: '2026-07-03T08:00:00.000Z', value: 78 },
      { measuredAt: '2026-07-04T08:00:00.000Z', value: 75 },
    ])
    expect(result.movingAverages[7]).toEqual([])
    expect(result.movingAverages[30]).toEqual([])
    expect(result.movingAverages[90]).toEqual([])
  })

  it('统计首次、最新、变化和记录次数', () => {
    expect(buildAnalytics(points).summary).toEqual({
      first: 80,
      latest: 73,
      previousChange: -1,
      totalChange: -7,
      minimum: 73,
      maximum: 80,
      average: 76.5,
      count: 8,
    })
  })
})
