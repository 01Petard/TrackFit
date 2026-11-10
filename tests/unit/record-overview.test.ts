import { describe, expect, it } from 'vitest'
import { backupSchema } from '../../shared/schemas/trackfit'
import { buildRecordOverview } from '../../shared/utils/record-overview'

function fixture() {
  return backupSchema.parse({ version: 6, exportedAt: new Date().toISOString(), settings: [], metrics: [], bodyRecords: [], trainingRecords: [], sleepRecords: [] })
}

describe('记录中心目标和完整度', () => {
  it('固定三行 28 天，健身和睡眠按日累计后计算目标比例', () => {
    const data = fixture()
    const now = new Date(2026, 9, 19, 20)
    data.trainingRecords = [{ id: 1, recordedAt: new Date(2026, 9, 19, 9).toISOString(), type: 'strength', durationMinutes: 10, note: null }, { id: 2, recordedAt: new Date(2026, 9, 19, 10).toISOString(), type: 'cardio', durationMinutes: 5, note: null }]
    data.sleepRecords = [{ id: 1, fellAsleepAt: new Date(2026, 9, 18, 23).toISOString(), wokeUpAt: new Date(2026, 9, 19, 3).toISOString(), quality: 80, note: null }]
    const result = buildRecordOverview(data, now)
    expect(result.days).toHaveLength(28)
    expect(result.days[0]!.date).toBe('2026-09-22')
    expect(result.days.at(-1)).toMatchObject({ date: '2026-10-19', training: 50, sleep: 50, body: 0 })
    expect(result.completeness).toBe(2)
  })

  it('超额封顶，完整度按有记录的日期计数，不受同日重复次数影响', () => {
    const data = fixture()
    data.bodyRecords = [1, 2].map(id => ({ id, measuredAt: new Date(2026, 9, 19, 8, id).toISOString(), values: [{ metricId: 1, value: 70 }], note: null }))
    data.trainingRecords = Array.from({ length: 6 }, (_, id) => ({ id: id + 1, recordedAt: new Date(2026, 9, 19, 10, id).toISOString(), type: 'strength' as const, durationMinutes: 60, note: null }))
    data.sleepRecords = [{ id: 1, fellAsleepAt: new Date(2026, 9, 18, 21).toISOString(), wokeUpAt: new Date(2026, 9, 19, 7).toISOString(), quality: 80, note: null }]
    const result = buildRecordOverview(data, new Date(2026, 9, 19, 20))
    expect(result.days.at(-1)).toMatchObject({ body: 100, training: 100, sleep: 100 })
    expect(result.trainingPercent).toBe(100)
    expect(result.durationPercent).toBe(100)
    expect(result.completeness).toBe(4)
    expect(result.coverage.map(item => item.days)).toEqual([1, 1, 1])
    expect(result.sleepGoalDays).toBe(1)
  })

  it('排除窗口外和未来记录，零目标不会产生无效比例', () => {
    const data = fixture()
    data.trainingRecords = [{ id: 1, recordedAt: new Date(2026, 8, 21, 10).toISOString(), type: 'strength', durationMinutes: 60, note: null }, { id: 2, recordedAt: new Date(2026, 9, 20, 10).toISOString(), type: 'cardio', durationMinutes: 60, note: null }]
    expect(buildRecordOverview(data, new Date(2026, 9, 19, 20)).completeness).toBe(0)
    const settings = backupSchema.parse({ ...data, settings: [{ id: 1, heightCm: 175, dataVersion: 1, weeklyTrainingGoalMinutes: 0 }] })
    expect(buildRecordOverview(settings, new Date(2026, 9, 19, 20)).durationPercent).toBe(0)
  })
})
