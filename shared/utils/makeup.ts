import type { MeasurementWrite, SleepWrite, TrackFitData, TrainingWrite } from '../schemas/trackfit'
import dayjs from 'dayjs'
import { measurementWriteSchema, sleepWriteSchema, trainingWriteSchema } from '../schemas/trackfit'
import { saveSleep, saveTraining } from './behavior'
import { TrackFitDomainError } from './domain-error'
import { saveMeasurement } from './trackfit'

export interface MakeupDayInput {
  date: string
  measurement: MeasurementWrite
  training: TrainingWrite
  trainingAt: Date
  sleep: SleepWrite
}

export type MakeupKind = 'all' | 'weight' | 'sleep' | 'training'

export type SingleMakeupInput
  = | { kind: 'weight', date: string, measurement: MeasurementWrite }
    | { kind: 'training', date: string, training: TrainingWrite, trainingAt: Date }
    | { kind: 'sleep', date: string, sleep: SleepWrite }

export function findLatestMissingDay(data: TrackFitData, now = new Date(), kind: MakeupKind = 'all'): string | null {
  const bodyDays = data.bodyRecords.map(item => dayjs(item.measuredAt).format('YYYY-MM-DD'))
  const trainingDays = data.trainingRecords.map(item => dayjs(item.recordedAt).format('YYYY-MM-DD'))
  const sleepDays = data.sleepRecords.map(item => dayjs(item.wokeUpAt).format('YYYY-MM-DD'))
  const recordedDays = new Set([...bodyDays, ...trainingDays, ...sleepDays])
  if (!recordedDays.size) return null

  const weightMetricId = data.metrics.find(metric => metric.code === 'weight' && metric.enabled)?.id
  if (kind === 'weight' && weightMetricId == null) return null
  const weightDays = new Set(data.bodyRecords
    .filter(item => item.values.some(value => value.metricId === weightMetricId))
    .map(item => dayjs(item.measuredAt).format('YYYY-MM-DD')))
  const specificDays = kind === 'weight' ? weightDays : kind === 'training' ? new Set(trainingDays) : new Set(sleepDays)

  const earliest = [...recordedDays].sort()[0]!
  for (let day = dayjs(now).startOf('day').subtract(1, 'day'); day.format('YYYY-MM-DD') >= earliest; day = day.subtract(1, 'day')) {
    const date = day.format('YYYY-MM-DD')
    if (kind === 'all' ? !recordedDays.has(date) : !specificDays.has(date)) return date
  }
  return null
}

export function saveMakeupDay(data: TrackFitData, input: MakeupDayInput, now = new Date()): void {
  if (findLatestMissingDay(data, now) !== input.date) throw new TrackFitDomainError('makeup.dayUnavailable')

  const measurement = measurementWriteSchema.parse(input.measurement)
  const training = trainingWriteSchema.parse(input.training)
  const trainingAt = new Date(input.trainingAt)
  const sleep = sleepWriteSchema.parse(input.sleep)
  const wakeUpAt = dayjs(sleep.fellAsleepAt).add(sleep.durationMinutes, 'minute')
  if (dayjs(measurement.measuredAt).format('YYYY-MM-DD') !== input.date
    || dayjs(trainingAt).format('YYYY-MM-DD') !== input.date
    || !Number.isFinite(trainingAt.getTime())
    || wakeUpAt.format('YYYY-MM-DD') !== input.date) {
    throw new TrackFitDomainError('makeup.dateMismatch')
  }

  saveMeasurement(data, measurement)
  saveTraining(data, training, undefined, trainingAt)
  saveSleep(data, sleep)
}

export function saveSingleMakeupDay(data: TrackFitData, input: SingleMakeupInput, now = new Date()): void {
  if (input.kind === 'weight') {
    const weightMetricId = data.metrics.find(metric => metric.code === 'weight' && metric.enabled)?.id
    const targetDay = dayjs(input.date)
    if (weightMetricId == null
      || !targetDay.isValid()
      || targetDay.format('YYYY-MM-DD') !== input.date
      || !targetDay.isBefore(dayjs(now), 'day')
      || data.bodyRecords.some(item => dayjs(item.measuredAt).format('YYYY-MM-DD') === input.date && item.values.some(value => value.metricId === weightMetricId))) {
      throw new TrackFitDomainError('makeup.dayUnavailable')
    }
    const measurement = measurementWriteSchema.parse(input.measurement)
    if (dayjs(measurement.measuredAt).format('YYYY-MM-DD') !== input.date
      || measurement.values.length !== 1
      || measurement.values[0]?.metricId !== weightMetricId) throw new TrackFitDomainError('makeup.dateMismatch')
    saveMeasurement(data, measurement)
  } else if (input.kind === 'training') {
    const targetDay = dayjs(input.date)
    if (!targetDay.isValid()
      || targetDay.format('YYYY-MM-DD') !== input.date
      || !targetDay.isBefore(dayjs(now), 'day')
      || data.trainingRecords.some(item => dayjs(item.recordedAt).format('YYYY-MM-DD') === input.date)) {
      throw new TrackFitDomainError('makeup.dayUnavailable')
    }
    const training = trainingWriteSchema.parse(input.training)
    const trainingAt = new Date(input.trainingAt)
    if (!Number.isFinite(trainingAt.getTime()) || dayjs(trainingAt).format('YYYY-MM-DD') !== input.date) throw new TrackFitDomainError('makeup.dateMismatch')
    saveTraining(data, training, undefined, trainingAt)
  } else {
    if (findLatestMissingDay(data, now, input.kind) !== input.date) throw new TrackFitDomainError('makeup.dayUnavailable')
    const sleep = sleepWriteSchema.parse(input.sleep)
    if (dayjs(sleep.fellAsleepAt).add(sleep.durationMinutes, 'minute').format('YYYY-MM-DD') !== input.date) throw new TrackFitDomainError('makeup.dateMismatch')
    saveSleep(data, sleep)
  }
}
