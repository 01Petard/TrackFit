import { describe, expect, it } from 'vitest'
import { backupSchema } from '../../shared/schemas/trackfit'
import { saveSleep, saveTraining } from '../../shared/utils/behavior'
import { findLatestMissingDay, saveMakeupDay, saveSingleMakeupDay } from '../../shared/utils/makeup'
import { saveMeasurement } from '../../shared/utils/trackfit'

function fixture() {
  return backupSchema.parse({
    version: 6,
    exportedAt: '2026-09-29T00:00:00.000Z',
    settings: [{ id: 1, heightCm: 175, defaultDateRange: '30d', dataVersion: 1 }],
    metrics: [{ id: 1, code: 'weight', name: '体重', unit: 'kg', decimalPlaces: 2, minimumValue: 20, maximumValue: 400, metricType: 'core', enabled: true, sortOrder: 10 }],
    bodyRecords: [],
    trainingRecords: [],
    sleepRecords: [],
  })
}

describe('连续记录补卡', () => {
  const now = new Date(2026, 8, 29, 12)

  it('只提示首次记录之后、昨天之前最近的缺失自然日', () => {
    const data = fixture()
    expect(findLatestMissingDay(data, now)).toBeNull()
    saveMeasurement(data, { measuredAt: new Date(2026, 8, 26, 8), values: [{ metricId: 1, value: 70 }] })
    saveSleep(data, { fellAsleepAt: new Date(2026, 8, 27, 23), durationMinutes: 480, quality: 80 })

    expect(findLatestMissingDay(data, now)).toBe('2026-09-27')
  })

  it('身体、睡眠或训练任意一项有记录，就不算缺卡', () => {
    for (const kind of ['body', 'sleep', 'training'] as const) {
      const data = fixture()
      saveMeasurement(data, { measuredAt: new Date(2026, 8, 26, 8), values: [{ metricId: 1, value: 70 }] })
      if (kind === 'body') saveMeasurement(data, { measuredAt: new Date(2026, 8, 28, 8), values: [{ metricId: 1, value: 69 }] })
      if (kind === 'sleep') saveSleep(data, { fellAsleepAt: new Date(2026, 8, 27, 23), durationMinutes: 480, quality: 80 })
      if (kind === 'training') saveTraining(data, { type: 'cardio', durationMinutes: 30 }, undefined, new Date(2026, 8, 28, 18))

      expect(findLatestMissingDay(data, now)).toBe('2026-09-27')
      saveTraining(data, { type: 'cardio', durationMinutes: 30 }, undefined, new Date(2026, 8, 27, 18))
      expect(findLatestMissingDay(data, now)).toBeNull()
    }
  })

  it('单项补卡按项目提示缺失日期，并按项目分别补记', () => {
    const data = fixture()
    saveMeasurement(data, { measuredAt: new Date(2026, 8, 26, 8), values: [{ metricId: 1, value: 70 }] })
    saveMeasurement(data, { measuredAt: new Date(2026, 8, 28, 8), values: [{ metricId: 1, value: 69 }] })
    expect(findLatestMissingDay(data, now)).toBe('2026-09-27')
    expect(findLatestMissingDay(data, now, 'weight')).toBe('2026-09-27')
    expect(findLatestMissingDay(data, now, 'sleep')).toBe('2026-09-28')
    expect(findLatestMissingDay(data, now, 'training')).toBe('2026-09-28')

    saveSingleMakeupDay(data, { kind: 'training', date: '2026-09-28', training: { type: 'cardio', durationMinutes: 30 }, trainingAt: new Date(2026, 8, 28, 18) }, now)
    expect(new Date(data.trainingRecords[0]!.recordedAt)).toEqual(new Date(2026, 8, 28, 18))
    saveSingleMakeupDay(data, { kind: 'sleep', date: '2026-09-28', sleep: { fellAsleepAt: new Date(2026, 8, 27, 23), durationMinutes: 480, quality: 80 } }, now)
    expect(findLatestMissingDay(data, now, 'training')).toBe('2026-09-27')
    expect(findLatestMissingDay(data, now, 'sleep')).toBe('2026-09-27')
    expect(findLatestMissingDay(data, now)).toBe('2026-09-27')
    expect(() => saveSingleMakeupDay(data, { kind: 'weight', date: '2026-09-28', measurement: { measuredAt: new Date(2026, 8, 28, 8), values: [{ metricId: 1, value: 69 }] } }, now)).toThrow('makeup.dayUnavailable')
  })

  it('体重补记支持自选历史日期，且只补目标日期的体重', () => {
    const data = fixture()
    saveMeasurement(data, { measuredAt: new Date(2026, 8, 26, 8), values: [{ metricId: 1, value: 70 }] })
    saveTraining(data, { type: 'cardio', durationMinutes: 30 }, undefined, new Date(2026, 8, 28, 18))
    expect(findLatestMissingDay(data, now, 'weight')).toBe('2026-09-28')

    saveSingleMakeupDay(data, { kind: 'weight', date: '2026-09-27', measurement: { measuredAt: new Date(2026, 8, 27, 8), values: [{ metricId: 1, value: 69 }] } }, now)
    expect(data.bodyRecords).toHaveLength(2)
    expect(data.trainingRecords).toHaveLength(1)
    expect(data.sleepRecords).toHaveLength(0)
    expect(new Date(data.bodyRecords[1]!.measuredAt)).toEqual(new Date(2026, 8, 27, 8))
    expect(findLatestMissingDay(data, now, 'weight')).toBe('2026-09-28')
    expect(() => saveSingleMakeupDay(data, { kind: 'weight', date: '2026-09-27', measurement: { measuredAt: new Date(2026, 8, 27, 9), values: [{ metricId: 1, value: 69 }] } }, now)).toThrow('makeup.dayUnavailable')
  })

  it('三项全空的日期也允许只补其中一项，随后算已记录', () => {
    const data = fixture()
    saveMeasurement(data, { measuredAt: new Date(2026, 8, 26, 8), values: [{ metricId: 1, value: 70 }] })
    expect(findLatestMissingDay(data, now)).toBe('2026-09-28')
    expect(findLatestMissingDay(data, now, 'training')).toBe('2026-09-28')

    saveSingleMakeupDay(data, { kind: 'training', date: '2026-09-28', training: { type: 'cardio', durationMinutes: 30 }, trainingAt: new Date(2026, 8, 28, 18) }, now)
    expect(findLatestMissingDay(data, now)).toBe('2026-09-27')
    expect(findLatestMissingDay(data, now, 'training')).toBe('2026-09-27')
    expect(data.trainingRecords).toHaveLength(1)
  })

  it('一次保存三项记录，并以起床日期归属睡眠', () => {
    const data = fixture()
    saveMeasurement(data, { measuredAt: new Date(2026, 8, 26, 8), values: [{ metricId: 1, value: 70 }] })
    saveTraining(data, { type: 'cardio', durationMinutes: 40 }, undefined, new Date(2026, 8, 28, 18))

    const input = {
      date: '2026-09-27',
      measurement: { measuredAt: new Date(2026, 8, 27, 8), values: [{ metricId: 1, value: 69.5 }] },
      training: { type: 'strength' as const, durationMinutes: 30 },
      trainingAt: new Date(2026, 8, 27, 18),
      sleep: { fellAsleepAt: new Date(2026, 8, 26, 23), durationMinutes: 480, quality: 85 },
    }
    saveMakeupDay(data, input, now)

    expect(data.bodyRecords).toHaveLength(2)
    expect(data.trainingRecords).toHaveLength(2)
    expect(data.sleepRecords).toHaveLength(1)
    expect(new Date(data.sleepRecords[0]!.wokeUpAt).getDate()).toBe(27)
    expect(findLatestMissingDay(data, now)).toBeNull()
    expect(() => saveMakeupDay(data, input, now)).toThrow('makeup.dayUnavailable')
  })

  it('日期不匹配时不写入任一记录', () => {
    const data = fixture()
    saveMeasurement(data, { measuredAt: new Date(2026, 8, 26, 8), values: [{ metricId: 1, value: 70 }] })
    const input = {
      date: '2026-09-28',
      measurement: { measuredAt: new Date(2026, 8, 28, 8), values: [{ metricId: 1, value: 69.5 }] },
      training: { type: 'strength' as const, durationMinutes: 30 },
      trainingAt: new Date(2026, 8, 28, 18),
      sleep: { fellAsleepAt: new Date(2026, 8, 27, 23), durationMinutes: 480, quality: 85 },
    }
    input.trainingAt = new Date(2026, 8, 27, 18)

    expect(() => saveMakeupDay(data, input, now)).toThrow('makeup.dateMismatch')
    expect(data.bodyRecords).toHaveLength(1)
    expect(data.trainingRecords).toHaveLength(0)
    expect(data.sleepRecords).toHaveLength(0)
  })
})
