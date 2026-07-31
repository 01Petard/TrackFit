import { describe, expect, it } from 'vitest'
import { buildAnalytics, calculateBmi, calculateWaistHipRatio } from '../../server/utils/analytics'

describe('身体指标计算', () => {
  it('计算 BMI 并保留两位小数', () => {
    expect(calculateBmi(70, 175)).toBe(22.86)
    expect(calculateBmi(undefined, 175)).toBeNull()
  })

  it('只在腰围和臀围都有效时计算腰臀比', () => {
    expect(calculateWaistHipRatio(80, 100)).toBe(0.8)
    expect(calculateWaistHipRatio(80, undefined)).toBeNull()
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

  it('从第七条记录开始计算七条移动平均', () => {
    const result = buildAnalytics(points)
    expect(result.points[5]?.movingAverage).toBeNull()
    expect(result.points[6]?.movingAverage).toBe(77)
    expect(result.points[7]?.movingAverage).toBe(76)
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

