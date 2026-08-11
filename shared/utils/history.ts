import type { TrackFitData } from '../schemas/trackfit'
import type { LocalizedDescriptor } from './analytics'
import { listBehaviorTimeline } from './behavior'
import { listMeasurements } from './trackfit'

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
