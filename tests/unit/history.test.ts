import { describe, expect, it } from 'vitest'
import { backupSchema } from '../../shared/schemas/trackfit'
import { listHistoryRecords } from '../../shared/utils/history'

describe('统一历史记录', () => {
  it('合并身体训练睡眠记录并按发生时间倒序排列', () => {
    const data = backupSchema.parse(historyFixture())
    const records = listHistoryRecords(data)

    expect(records.map(item => item.key)).toEqual(['sleep-1', 'training-1', 'body-1'])
    expect(records[2]).toMatchObject({
      kind: 'body',
      title: { key: 'history.bodyMeasurement' },
      details: [
        { key: 'history.metricValue', values: { metricCode: 'weight', metricName: '体重', value: 70, unit: 'kg' } },
        { key: 'history.bmi', values: { value: 22.86 } },
      ],
      description: { text: '晨起空腹' },
    })
    expect(records[1]).toMatchObject({ title: { key: 'training.strength' }, details: [{ key: 'history.trainingDuration', values: { minutes: 45 } }] })
    expect(records[0]).toMatchObject({ title: { key: 'history.sleepRecord' }, details: [{ key: 'history.sleepDuration', values: { minutes: 480 } }, { key: 'history.sleepScore', values: { score: 82 } }] })
  })

  it('按记录类型和日期范围筛选', () => {
    const data = backupSchema.parse(historyFixture())

    expect(listHistoryRecords(data, { kind: 'training' }).map(item => item.kind)).toEqual(['training'])
    expect(listHistoryRecords(data, {
      start: '2026-08-02T00:00:00.000Z',
      end: '2026-08-02T23:59:59.999Z',
    }).map(item => item.key)).toEqual(['training-1'])
  })
})

function historyFixture() {
  return {
    version: 6,
    exportedAt: '2026-08-04T00:00:00.000Z',
    settings: [{
      id: 1,
      heightCm: 175,
      desiredWeightMinimum: null,
      desiredWeightMaximum: null,
      defaultDateRange: '30d',
      sleepGoalHours: 8,
      weeklyTrainingGoalMinutes: 150,
      theme: 'system',
      dataVersion: 1,
    }],
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
    bodyRecords: [{
      id: 1,
      measuredAt: '2026-08-01T08:00:00.000Z',
      note: '晨起空腹',
      values: [{ metricId: 1, value: 70 }],
    }],
    trainingRecords: [{
      id: 1,
      recordedAt: '2026-08-02T10:00:00.000Z',
      type: 'strength',
      durationMinutes: 45,
      note: null,
    }],
    sleepRecords: [{
      id: 1,
      fellAsleepAt: '2026-08-02T16:00:00.000Z',
      wokeUpAt: '2026-08-03T00:00:00.000Z',
      quality: 82,
      note: null,
    }],
  }
}
