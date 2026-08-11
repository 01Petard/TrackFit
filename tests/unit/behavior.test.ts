import type { TrackFitData } from '../../shared/schemas/trackfit'
import { describe, expect, it } from 'vitest'
import { backupSchema } from '../../shared/schemas/trackfit'
import {
  buildBehaviorCorrelations,
  buildPeriodReport,
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
    expect(data.trainingSessions[0]?.type).toBe('cardio')

    deleteTraining(data, trainingId)
    deleteSleep(data, sleepId)
    expect(data.trainingSessions).toEqual([])
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

    for (const value of data.values) value.value = 70
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
})

function fixture(): TrackFitData {
  return backupSchema.parse({
    version: 1,
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
    sessions: [],
    values: [],
  })
}
