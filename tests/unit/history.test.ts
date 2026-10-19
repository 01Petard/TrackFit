import { describe, expect, it } from 'vitest'
import { backupSchema } from '../../shared/schemas/trackfit'
import { getHistoryWindow, groupHistoryByWeek, listHistoryRecords, summarizeHistoryDay } from '../../shared/utils/history'

describe('统一历史记录', () => {
  it('每日同类记录只展示一个分组，同项目训练及睡眠累加，身体保留每次测量值', () => {
    const [sleep, training, body] = listHistoryRecords(backupSchema.parse(historyFixture()))
    const records = [
      training!,
      { ...training!, key: 'training-2', title: { key: 'training.cardio' }, details: [{ key: 'history.trainingDuration', values: { minutes: 5 } }] },
      { ...training!, key: 'training-3', title: { key: 'training.cardio' }, details: [{ key: 'history.trainingDuration', values: { minutes: 30 } }] },
      body!,
      { ...body!, key: 'body-2', details: [{ key: 'history.metricValue', values: { metricCode: 'weight', metricName: '体重', value: 71, unit: 'kg' } }] },
      sleep!,
      { ...sleep!, key: 'sleep-2', details: [{ key: 'history.sleepDuration', values: { minutes: 30 } }] },
    ]
    const original = structuredClone(records)
    const groups = summarizeHistoryDay(records)

    expect(groups.map(group => group.kind)).toEqual(['body', 'sleep', 'training'])
    expect(groups.map(group => group.records.length)).toEqual([2, 2, 3])
    expect(groups[2]!.summaries).toEqual([
      { key: 'training.strength', title: { key: 'training.strength' }, detail: { key: 'history.trainingDuration', values: { minutes: 45 } } },
      { key: 'training.cardio', title: { key: 'training.cardio' }, detail: { key: 'history.trainingDuration', values: { minutes: 35 } } },
    ])
    expect(groups[0]!.summaries.map(summary => summary.detail.values?.value)).toEqual([70, 71])
    expect(groups[1]!.summaries).toEqual([{ key: 'sleep', detail: { key: 'history.sleepDuration', values: { minutes: 510 } } }])
    expect(records).toEqual(original)
    expect(summarizeHistoryDay([])).toEqual([])
  })

  it('每页固定连续四周，包含空周，并从本周向前翻页', () => {
    const records = listHistoryRecords(backupSchema.parse(historyFixture()))
    const now = new Date(2026, 9, 19, 12)
    const first = getHistoryWindow(records, 1, now)
    expect(first.start).toBe('2026-09-28')
    expect(first.end).toBe('2026-10-25')
    expect(first.weeks).toHaveLength(4)
    expect(first.weeks.flatMap(week => week.days)).toHaveLength(28)
    expect(first.weeks.flatMap(week => week.days.flatMap(day => day.items))).toHaveLength(0)
    const second = getHistoryWindow(records, 2, now)
    expect(second.start).toBe('2026-08-31')
    expect(second.end).toBe('2026-09-27')
    expect(getHistoryWindow(records, 999, now).page).toBe(first.totalPages)
    expect(getHistoryWindow([], 999, now)).toMatchObject({ page: 1, totalPages: 1 })
  })
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

  it('按本地日期归入周一到周日，跨年仍保持完整周且不丢失同日记录', () => {
    const template = listHistoryRecords(backupSchema.parse(historyFixture()))[0]!
    const records = [
      ...Array.from({ length: 25 }, (_, index) => ({ ...template, key: `record-${index}`, occurredAt: new Date(2026, 0, 4, 12, index).toISOString() })),
      { ...template, key: 'next-monday', occurredAt: new Date(2026, 0, 5, 0, 0).toISOString() },
      { ...template, key: 'previous-sunday', occurredAt: new Date(2025, 11, 28, 23, 59).toISOString() },
    ]
    const weeks = groupHistoryByWeek(records)

    expect(weeks.map(week => week.key)).toEqual(['2026-01-05', '2025-12-29', '2025-12-22'])
    expect(weeks.every(week => week.days.length === 7)).toBe(true)
    expect(weeks[0]!.days[0]!.items[0]!.key).toBe('next-monday')
    expect(weeks[1]!.days[6]!.date).toBe('2026-01-04')
    expect(weeks[1]!.days[6]!.items).toHaveLength(25)
    expect(weeks.flatMap(week => week.days.flatMap(day => day.items))).toHaveLength(records.length)
    expect(groupHistoryByWeek([])).toEqual([])
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
