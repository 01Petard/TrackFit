import type { TrackFitData } from '../schemas/trackfit'
import type { LocalizedDescriptor } from './analytics'
import { listBehaviorTimeline } from './behavior'
import { listMeasurements } from './trackfit'
import dayjs from 'dayjs'

export type HistoryRecordKind = 'body' | 'training' | 'sleep'

export interface HistoryRecordQuery {
  kind?: HistoryRecordKind
  start?: string
  end?: string
}

export interface HistoryRecordItem {
  key: string
  id: number
  kind: HistoryRecordKind
  occurredAt: string
  title: LocalizedDescriptor
  details: LocalizedDescriptor[]
  description: LocalizedDescriptor | { text: string }
}

export interface HistoryWeek {
  key: string
  days: { date: string, items: HistoryRecordItem[] }[]
}

export interface HistoryDayGroup {
  kind: HistoryRecordKind
  records: HistoryRecordItem[]
  summaries: { key: string, title?: LocalizedDescriptor, detail: LocalizedDescriptor }[]
}

export function summarizeHistoryDay(items: HistoryRecordItem[]): HistoryDayGroup[] {
  return (['body', 'sleep', 'training'] as const).flatMap((kind): HistoryDayGroup[] => {
    const records = items.filter(item => item.kind === kind)
    if (!records.length) return []

    const summaries: HistoryDayGroup['summaries'] = []
    if (kind === 'training') {
      const types = new Map<string, { title: LocalizedDescriptor, minutes: number }>()
      for (const record of records) {
        const total = types.get(record.title.key) ?? { title: record.title, minutes: 0 }
        total.minutes += Number(record.details[0]?.values?.minutes ?? 0)
        types.set(record.title.key, total)
      }
      for (const [key, total] of types) {
        summaries.push({ key, title: total.title, detail: { key: 'history.trainingDuration', values: { minutes: total.minutes } } })
      }
    } else if (kind === 'sleep') {
      const minutes = records.reduce((sum, record) => sum + Number(record.details[0]?.values?.minutes ?? 0), 0)
      summaries.push({ key: kind, detail: { key: 'history.sleepDuration', values: { minutes } } })
    } else {
      for (const record of records) {
        if (record.details[0]) summaries.push({ key: record.key, detail: record.details[0] })
      }
    }
    return [{ kind, records, summaries }]
  })
}

export function getHistoryWindow(records: HistoryRecordItem[], page = 1, now = new Date()) {
  const today = dayjs(now).startOf('day')
  const monday = today.subtract((today.day() + 6) % 7, 'day')
  const oldest = records.reduce((date, item) => item.occurredAt < date ? item.occurredAt : date, today.toISOString())
  const totalPages = Math.max(1, Math.ceil((monday.diff(dayjs(oldest).startOf('day'), 'day') + 7) / 28))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const end = monday.add(6, 'day').subtract((currentPage - 1) * 28, 'day')
  const start = end.subtract(27, 'day')
  const grouped = new Map(groupHistoryByWeek(records).map(week => [week.key, week]))
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const beginning = end.subtract(6 + index * 7, 'day')
    const key = beginning.format('YYYY-MM-DD')
    return grouped.get(key) ?? { key, days: Array.from({ length: 7 }, (_, day) => ({ date: beginning.add(day, 'day').format('YYYY-MM-DD'), items: [] as HistoryRecordItem[] })) }
  })
  return { weeks, page: currentPage, totalPages, start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') }
}

// Keep every day's records together when paginating, with Monday as the first column.
export function groupHistoryByWeek(records: HistoryRecordItem[]): HistoryWeek[] {
  const weeks = new Map<string, HistoryWeek>()
  for (const item of records) {
    const date = dayjs(item.occurredAt)
    const monday = date.startOf('day').subtract((date.day() + 6) % 7, 'day')
    const key = monday.format('YYYY-MM-DD')
    let week = weeks.get(key)
    if (!week) {
      week = { key, days: Array.from({ length: 7 }, (_, index) => ({ date: monday.add(index, 'day').format('YYYY-MM-DD'), items: [] })) }
      weeks.set(key, week)
    }
    week.days[(date.day() + 6) % 7]!.items.push(item)
  }
  return [...weeks.values()].sort((a, b) => b.key.localeCompare(a.key))
}

const trainingTypeKeys = { strength: 'training.strength', cardio: 'training.cardio', mobility: 'training.mobility', other: 'training.other' } as const

export function listHistoryRecords(data: TrackFitData, query: HistoryRecordQuery = {}): HistoryRecordItem[] {
  const records = [
    ...listMeasurements(data, { page: 1, pageSize: Number.MAX_SAFE_INTEGER }).items.map(record => ({
      key: `body-${record.id}`,
      id: record.id,
      kind: 'body' as const,
      occurredAt: record.measuredAt,
      title: { key: 'history.bodyMeasurement' },
      details: [
        ...record.values.map(value => ({ key: 'history.metricValue', values: { metricCode: value.code, metricName: value.name, value: value.value, unit: value.unit } })),
        ...(record.bmi == null ? [] : [{ key: 'history.bmi', values: { value: record.bmi } }]),
        ...(record.waistHipRatio == null ? [] : [{ key: 'history.waistHipRatio', values: { value: record.waistHipRatio } }]),
      ],
      description: record.note ? { text: record.note } : { key: 'history.bodyDescription', values: { count: record.values.length } },
    })),
    ...listBehaviorTimeline(data).map((item): HistoryRecordItem => {
      if (item.training) {
        return {
          key: `training-${item.id}`,
          id: item.id,
          kind: 'training',
          occurredAt: item.occurredAt,
          title: { key: trainingTypeKeys[item.training.type] },
          details: [{ key: 'history.trainingDuration', values: { minutes: item.training.durationMinutes } }],
          description: item.training.note ? { text: item.training.note } : { key: 'history.trainingDescription' },
        }
      }
      const sleep = item.sleep!
      return {
        key: `sleep-${item.id}`,
        id: item.id,
        kind: 'sleep',
        occurredAt: item.occurredAt,
        title: { key: 'history.sleepRecord' },
        details: [{ key: 'history.sleepDuration', values: { minutes: sleep.durationMinutes } }, { key: 'history.sleepScore', values: { score: sleep.quality } }],
        description: { key: 'history.sleepWindow', values: { fellAsleepAt: sleep.fellAsleepAt, wokeUpAt: sleep.wokeUpAt } },
      }
    }),
  ]
  const start = query.start == null ? Number.NEGATIVE_INFINITY : new Date(query.start).getTime()
  const end = query.end == null ? Number.POSITIVE_INFINITY : new Date(query.end).getTime()
  return records
    .filter(item => query.kind == null || item.kind === query.kind)
    .filter((item) => {
      const occurredAt = new Date(item.occurredAt).getTime()
      return occurredAt >= start && occurredAt <= end
    })
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime() || b.id - a.id)
}
