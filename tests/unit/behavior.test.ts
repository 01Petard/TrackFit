import type { TrackFitData } from '../../shared/schemas/trackfit'
import { describe, expect, it } from 'vitest'
import { backupSchema } from '../../shared/schemas/trackfit'
import {
  buildBehaviorCorrelations,
  buildPeriodReport,
  buildWeightCorrelationComparison,
  deleteSleep,
  deleteTraining,
  listBehaviorTimeline,
  saveSleep,
  saveTraining,
} from '../../shared/utils/behavior'
import { saveMeasurement } from '../../shared/utils/trackfit'

describe('训练与睡眠业务', () => {
  it('保存、编辑和删除行为记录', () => {
    const data = fixture()
    const trainingId = saveTraining(data, { type: 'strength', durationMinutes: 45 }, undefined, new Date('2026-08-03T10:00:00+08:00'))
    const sleepId = saveSleep(data, { fellAsleepAt: '2026-08-02T23:00:00+08:00', durationMinutes: 510, quality: 80 })

    expect(listBehaviorTimeline(data)).toMatchObject([
      { kind: 'training', training: { durationMinutes: 45 } },
      { kind: 'sleep', sleep: { durationMinutes: 510 } },
    ])
    saveTraining(data, { type: 'cardio', durationMinutes: 30 }, trainingId)
    expect(data.trainingRecords[0]?.type).toBe('cardio')

    deleteTraining(data, trainingId)
    deleteSleep(data, sleepId)
    expect(data.trainingRecords).toEqual([])
    expect(data.sleepRecords).toEqual([])
  })

  it('自动计算起床时间并拒绝超长时长', () => {
    const data = fixture()
    saveSleep(data, { fellAsleepAt: '2026-08-03T23:00:00+08:00', durationMinutes: 480, quality: 80 })
    expect(data.sleepRecords[0]?.wokeUpAt).toBe('2026-08-03T23:00:00.000Z')
    expect(() => saveSleep(data, { fellAsleepAt: '2026-08-01T07:00:00+08:00', durationMinutes: 1441, quality: 80 })).toThrow()
    expect(() => saveTraining(data, { type: 'strength', durationMinutes: 1441 })).toThrow()
  })

  it('至少 14 个重叠日后计算滞后相关性，零方差不输出', () => {
    const data = fixture()
    for (let index = 0; index < 14; index++) {
      const behaviorDate = new Date(2026, 6, index + 1, 23, 30)
      const measurementDate = new Date(2026, 6, index + 2, 0, 30)
      saveTraining(data, { type: 'strength', durationMinutes: 20 + index }, undefined, behaviorDate)
      saveMeasurement(data, { measuredAt: measurementDate, values: [{ metricId: 1, value: 59 + index }] })
      saveMeasurement(data, { measuredAt: new Date(measurementDate.getTime() + 60 * 60 * 1000), values: [{ metricId: 1, value: 61 + index }] })
    }
    const result = buildBehaviorCorrelations(data).find(item => item.factor === 'trainingDuration' && item.lagDays === 1)
    expect(result).toMatchObject({ metricCode: 'weight', coefficient: 1, sampleSize: 14 })

    for (const record of data.bodyRecords) for (const value of record.values) value.value = 70
    expect(buildBehaviorCorrelations(data)).toEqual([])
  })

  it('生成周报并与等长上一周期对比', () => {
    const data = fixture()
    saveTraining(data, { type: 'strength', durationMinutes: 60 }, undefined, new Date('2026-08-03T10:00:00+08:00'))
    saveTraining(data, { type: 'cardio', durationMinutes: 30 }, undefined, new Date('2026-07-30T14:00:00+08:00'))
    saveSleep(data, { fellAsleepAt: '2026-08-02T23:00:00+08:00', durationMinutes: 480, quality: 80 })
    const report = buildPeriodReport(data, 'week', new Date('2026-08-06T12:00:00+08:00'))
    expect(report.training).toMatchObject({ count: 1, totalMinutes: 60, previousTotalMinutes: 30 })
    expect(report.sleep).toMatchObject({ averageMinutes: 480, goalDays: 1 })
  })

  it.each([
    { name: '负相关增强', previous: { signal: -10, noise: 20 }, recent: { signal: -20, noise: 10 }, change: 'stronger', coefficients: [-0.447, -0.894], reversed: false },
    { name: '负相关减弱', previous: { signal: -20, noise: 10 }, recent: { signal: -10, noise: 20 }, change: 'weaker', coefficients: [-0.894, -0.447], reversed: false },
    { name: '正相关增强', previous: { signal: 10, noise: 20 }, recent: { signal: 20, noise: 10 }, change: 'stronger', coefficients: [0.447, 0.894], reversed: false },
    { name: '小幅变化', previous: { signal: -20, noise: 40 }, recent: { signal: -25, noise: 45 }, change: 'stable', coefficients: [-0.447, -0.486], reversed: false },
    { name: '绝对值相同但方向反转', previous: { signal: 10, noise: 20 }, recent: { signal: -10, noise: 20 }, change: 'stable', coefficients: [0.447, -0.447], reversed: true },
  ])('用绝对值判断两个周期的关联强弱：$name', ({ previous, recent, change, coefficients, reversed }) => {
    const data = comparisonFixture(previous, recent)
    const result = buildWeightCorrelationComparison(data, new Date(2026, 8, 29, 12)).results.find(item => item.factor === 'trainingDuration' && item.lagDays === 0)
    expect(result).toMatchObject({
      strengthChange: change,
      directionChanged: reversed,
      previous: { coefficient: coefficients[0], sampleSize: 28 },
      recent: { coefficient: coefficients[1], sampleSize: 28 },
    })
  })

  it.each(['recent', 'previous'] as const)('任一周期不足 14 个重叠日时不判断强弱：%s', (period) => {
    const data = comparisonFixture(
      { signal: -10, noise: 20, days: period === 'previous' ? 13 : 28 },
      { signal: -20, noise: 10, days: period === 'recent' ? 13 : 28 },
    )
    const result = buildWeightCorrelationComparison(data, new Date(2026, 8, 29, 12)).results.find(item => item.factor === 'trainingDuration' && item.lagDays === 0)
    expect(result?.strengthChange).toBe('insufficient')
    expect(result?.[period]).toBeNull()
    expect(result?.[period === 'recent' ? 'previous' : 'recent']?.sampleSize).toBe(28)
  })

  it('任一周期数值不变时不判断强弱', () => {
    const data = comparisonFixture({ signal: -10, noise: 20 }, { signal: 0, noise: 0 })
    const comparison = buildWeightCorrelationComparison(data, new Date(2026, 8, 29, 12))
    expect(comparison.results.find(item => item.factor === 'trainingDuration' && item.lagDays === 0)).toMatchObject({ strengthChange: 'insufficient', recent: null })
    expect(comparison.results.filter(item => item.factor !== 'trainingDuration').every(item => item.strengthChange === 'insufficient')).toBe(true)
  })

  it('按本地自然日划分两个不重叠的 30 天，保留窗口之前的滞后行为', () => {
    const data = fixture()
    for (let index = -1; index <= 60; index++) {
      const date = new Date(2026, 7, 1 + index, index % 2 === 0 ? 0 : 23, 30)
      saveMeasurement(data, { measuredAt: date, values: [{ metricId: 1, value: 60 + index / 10 }] })
      saveMeasurement(data, { measuredAt: date, values: [{ metricId: 1, value: 62 + index / 10 }] })
      const trainingDate = new Date(date)
      trainingDate.setDate(trainingDate.getDate() - 7)
      saveTraining(data, { type: 'strength', durationMinutes: 30 + index }, undefined, trainingDate)
    }
    const result = buildWeightCorrelationComparison(data, new Date(2026, 8, 29, 12))
    expect(result).toMatchObject({ recentStart: '2026-08-31', recentEnd: '2026-09-29', previousStart: '2026-08-01', previousEnd: '2026-08-30' })
    expect(result.results.find(item => item.factor === 'trainingDuration' && item.lagDays === 7)).toMatchObject({
      recent: { coefficient: 1, sampleSize: 30 },
      previous: { coefficient: 1, sampleSize: 30 },
      strengthChange: 'stable',
    })
  })
})

function comparisonFixture(previous: { signal: number, noise: number, days?: number }, recent: { signal: number, noise: number, days?: number }): TrackFitData {
  const data = fixture()
  for (const [period, input] of [previous, recent].entries()) {
    for (let index = 0; index < (input.days ?? 28); index++) {
      const signal = index % 4 < 2 ? -1 : 1
      const noise = index % 2 === 0 ? -1 : 1
      const date = new Date(2026, 7, 1 + period * 30 + index, 12)
      saveMeasurement(data, { measuredAt: date, values: [{ metricId: 1, value: 70 + signal }] })
      saveTraining(data, { type: 'strength', durationMinutes: 100 + input.signal * signal + input.noise * noise }, undefined, date)
    }
  }
  return data
}

function fixture(): TrackFitData {
  return backupSchema.parse({
    version: 6,
    exportedAt: '2026-08-01T00:00:00.000Z',
    settings: [{ id: 1, heightCm: 175, defaultDateRange: '30d', theme: 'system', dataVersion: 1 }],
    metrics: [{
      id: 1,
      code: 'weight',
      name: '体重',
      unit: 'kg',
      decimalPlaces: 2,
      minimumValue: 20,
      maximumValue: 400,
      metricType: 'core',
      enabled: true,
      sortOrder: 10,
    }],
    bodyRecords: [],
    trainingRecords: [],
    sleepRecords: [],
  })
}
