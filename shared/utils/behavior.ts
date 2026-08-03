import type { SleepWrite, TrackFitData, TrainingWrite } from '../schemas/trackfit'
import type { BehaviorQuery, BehaviorTimelineItemDto, CorrelationDto, PeriodReportDto, SleepRecordDto } from '../types/api'
import { sleepWriteSchema, trainingWriteSchema } from '../schemas/trackfit'

const correlationLags = [0, 1, 3, 7] as const

export function listBehaviorTimeline(data: TrackFitData, query: BehaviorQuery = {}): BehaviorTimelineItemDto[] {
  const start = query.start ? new Date(query.start).getTime() : Number.NEGATIVE_INFINITY
  const end = query.end ? new Date(query.end).getTime() : Number.POSITIVE_INFINITY
  return [
    ...data.trainingSessions.flatMap((item) => {
      const occurredAt = new Date(item.startedAt).getTime()
      return occurredAt >= start && occurredAt <= end
        ? [{ id: item.id, kind: 'training' as const, occurredAt: item.startedAt, training: item }]
        : []
    }),
    ...data.sleepRecords.flatMap((item) => {
      const occurredAt = new Date(item.wokeUpAt).getTime()
      return occurredAt >= start && occurredAt <= end
        ? [{ id: item.id, kind: 'sleep' as const, occurredAt: item.wokeUpAt, sleep: hydrateSleep(item) }]
        : []
    }),
  ].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime() || b.id - a.id)
}

export function saveTraining(data: TrackFitData, input: TrainingWrite | unknown, id?: number): number {
  const payload = trainingWriteSchema.parse(input)
  const existing = id == null ? undefined : data.trainingSessions.find(item => item.id === id)
  if (id != null && !existing) throw new Error('训练记录不存在')
  const item = {
    id: existing?.id ?? nextId(data.trainingSessions),
    startedAt: payload.startedAt.toISOString(),
    type: payload.type,
    durationMinutes: payload.durationMinutes,
    intensity: payload.intensity,
    note: payload.note || null,
  }
  if (existing) Object.assign(existing, item)
  else data.trainingSessions.push(item)
  return item.id
}

export function deleteTraining(data: TrackFitData, id: number): void {
  if (!data.trainingSessions.some(item => item.id === id)) throw new Error('训练记录不存在')
  data.trainingSessions = data.trainingSessions.filter(item => item.id !== id)
}

export function saveSleep(data: TrackFitData, input: SleepWrite | unknown, id?: number): number {
  const payload = sleepWriteSchema.parse(input)
  const existing = id == null ? undefined : data.sleepRecords.find(item => item.id === id)
  if (id != null && !existing) throw new Error('睡眠记录不存在')
  const item = {
    id: existing?.id ?? nextId(data.sleepRecords),
    fellAsleepAt: payload.fellAsleepAt.toISOString(),
    wokeUpAt: payload.wokeUpAt.toISOString(),
    quality: payload.quality,
    note: payload.note || null,
  }
  if (existing) Object.assign(existing, item)
  else data.sleepRecords.push(item)
  return item.id
}

export function deleteSleep(data: TrackFitData, id: number): void {
  if (!data.sleepRecords.some(item => item.id === id)) throw new Error('睡眠记录不存在')
  data.sleepRecords = data.sleepRecords.filter(item => item.id !== id)
}

export function buildBehaviorCorrelations(data: TrackFitData): CorrelationDto[] {
  const measurementDays = buildMeasurementDays(data)
  const behaviorDays = buildBehaviorDays(data)
  return data.metrics
    .filter(metric => ['weight', 'body_fat', 'waist'].includes(metric.code))
    .flatMap(metric => correlationLags.flatMap(lag => (
      [
        correlation(metric, measurementDays, behaviorDays, 'trainingDuration', lag),
        correlation(metric, measurementDays, behaviorDays, 'trainingIntensity', lag),
        correlation(metric, measurementDays, behaviorDays, 'sleepDuration', lag),
        correlation(metric, measurementDays, behaviorDays, 'sleepQuality', lag),
      ].filter((item): item is CorrelationDto => item != null)
    )))
    .sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient))
}

export function buildPeriodReport(data: TrackFitData, period: 'week' | 'month', now = new Date()): PeriodReportDto {
  const end = new Date(now)
  const start = period === 'week' ? startOfWeek(end) : startOfMonth(end)
  const duration = end.getTime() - start.getTime()
  const previousEnd = new Date(start.getTime() - 1)
  const previousStart = new Date(previousEnd.getTime() - duration)
  const currentMeasurements = measurementValuesInRange(data, start, end)
  const previousMeasurements = measurementValuesInRange(data, previousStart, previousEnd)
  const currentTraining = data.trainingSessions.filter(item => inRange(item.startedAt, start, end))
  const previousTraining = data.trainingSessions.filter(item => inRange(item.startedAt, previousStart, previousEnd))
  const currentSleep = data.sleepRecords.filter(item => inRange(item.wokeUpAt, start, end)).map(hydrateSleep)
  const previousSleep = data.sleepRecords.filter(item => inRange(item.wokeUpAt, previousStart, previousEnd)).map(hydrateSleep)
  const sleepGoalMinutes = (data.settings[0]?.sleepGoalHours ?? 8) * 60

  return {
    period,
    start: start.toISOString(),
    end: end.toISOString(),
    bodyMetrics: data.metrics.filter(metric => ['weight', 'body_fat', 'waist'].includes(metric.code)).map((metric) => {
      const values = currentMeasurements.get(metric.id) ?? []
      const previousValues = previousMeasurements.get(metric.id) ?? []
      return {
        code: metric.code,
        name: metric.name,
        unit: metric.unit,
        average: average(values),
        change: values.length > 1 ? round(values.at(-1)! - values[0]!, 3) : null,
        volatility: standardDeviation(values),
        previousAverage: average(previousValues),
      }
    }),
    training: {
      count: currentTraining.length,
      totalMinutes: sum(currentTraining.map(item => item.durationMinutes)),
      averageIntensity: average(currentTraining.map(item => item.intensity)),
      previousTotalMinutes: sum(previousTraining.map(item => item.durationMinutes)),
    },
    sleep: {
      averageMinutes: average(currentSleep.map(item => item.durationMinutes)),
      averageQuality: average(currentSleep.map(item => item.quality)),
      goalDays: currentSleep.filter(item => item.durationMinutes >= sleepGoalMinutes).length,
      previousAverageMinutes: average(previousSleep.map(item => item.durationMinutes)),
    },
    strongestCorrelations: buildBehaviorCorrelations(data).slice(0, 3),
  }
}

export function createTrainingCsv(data: TrackFitData): string {
  return csv([
    ['记录ID', '训练时间', '训练类型', '时长（分钟）', '主观强度（十分制）', '备注'],
    ...[...data.trainingSessions]
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
      .map(item => [item.id, item.startedAt, item.type, item.durationMinutes, item.intensity, item.note ?? '']),
  ])
}

export function createSleepCsv(data: TrackFitData): string {
  return csv([
    ['记录ID', '入睡时间', '醒来时间', '时长（分钟）', '睡眠质量（百分制）', '备注'],
    ...[...data.sleepRecords]
      .sort((a, b) => new Date(a.wokeUpAt).getTime() - new Date(b.wokeUpAt).getTime())
      .map(item => [item.id, item.fellAsleepAt, item.wokeUpAt, hydrateSleep(item).durationMinutes, item.quality, item.note ?? '']),
  ])
}

function buildMeasurementDays(data: TrackFitData): Map<number, Map<string, number>> {
  const sessions = new Map(data.sessions.map(item => [item.id, item]))
  const buckets = new Map<number, Map<string, number[]>>()
  for (const value of data.values) {
    const session = sessions.get(value.sessionId)
    if (!session) continue
    const metricDays = buckets.get(value.metricId) ?? new Map<string, number[]>()
    const key = localDayKey(session.measuredAt)
    metricDays.set(key, [...(metricDays.get(key) ?? []), value.value])
    buckets.set(value.metricId, metricDays)
  }
  return new Map([...buckets].map(([metricId, days]) => [metricId, new Map([...days].map(([key, values]) => [key, average(values)!]))]))
}

function buildBehaviorDays(data: TrackFitData): Map<string, Record<CorrelationDto['factor'], number>> {
  const days = new Map<string, { durations: number[], intensities: number[], sleepDurations: number[], qualities: number[] }>()
  const bucket = (key: string) => days.get(key) ?? { durations: [], intensities: [], sleepDurations: [], qualities: [] }
  for (const item of data.trainingSessions) {
    const key = localDayKey(item.startedAt)
    const day = bucket(key)
    day.durations.push(item.durationMinutes)
    day.intensities.push(item.intensity)
    days.set(key, day)
  }
  for (const item of data.sleepRecords) {
    const key = localDayKey(item.wokeUpAt)
    const day = bucket(key)
    day.sleepDurations.push(hydrateSleep(item).durationMinutes)
    day.qualities.push(item.quality)
    days.set(key, day)
  }
  return new Map([...days].map(([key, day]) => [key, {
    trainingDuration: sum(day.durations),
    trainingIntensity: average(day.intensities) ?? 0,
    sleepDuration: average(day.sleepDurations) ?? 0,
    sleepQuality: average(day.qualities) ?? 0,
  }]))
}

function correlation(
  metric: TrackFitData['metrics'][number],
  measurementDays: Map<number, Map<string, number>>,
  behaviorDays: Map<string, Record<CorrelationDto['factor'], number>>,
  factor: CorrelationDto['factor'],
  lagDays: CorrelationDto['lagDays'],
): CorrelationDto | null {
  const pairs = [...(measurementDays.get(metric.id) ?? [])].flatMap(([day, value]) => {
    const behavior = behaviorDays.get(shiftDay(day, -lagDays))?.[factor]
    return behavior == null || behavior === 0 ? [] : [[value, behavior] as const]
  })
  if (pairs.length < 14) return null
  const coefficient = pearson(pairs)
  return coefficient == null ? null : {
    metricCode: metric.code,
    metricName: metric.name,
    factor,
    lagDays,
    coefficient: round(coefficient, 3),
    sampleSize: pairs.length,
  }
}

function measurementValuesInRange(data: TrackFitData, start: Date, end: Date): Map<number, number[]> {
  const days = buildMeasurementDays(data)
  return new Map([...days].map(([metricId, values]) => [metricId, [...values]
    .filter(([key]) => inRange(`${key}T12:00:00`, start, end))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value)]))
}

function pearson(pairs: ReadonlyArray<readonly [number, number]>): number | null {
  const xAverage = average(pairs.map(([x]) => x))!
  const yAverage = average(pairs.map(([, y]) => y))!
  const numerator = sum(pairs.map(([x, y]) => (x - xAverage) * (y - yAverage)))
  const denominator = Math.sqrt(
    sum(pairs.map(([x]) => (x - xAverage) ** 2)) * sum(pairs.map(([, y]) => (y - yAverage) ** 2)),
  )
  return denominator === 0 ? null : numerator / denominator
}

function hydrateSleep(item: TrackFitData['sleepRecords'][number]): SleepRecordDto {
  return { ...item, durationMinutes: Math.round((new Date(item.wokeUpAt).getTime() - new Date(item.fellAsleepAt).getTime()) / 60000) }
}

function startOfWeek(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7))
  return result
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function localDayKey(value: Date | string): string {
  const date = new Date(value)
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function shiftDay(day: string, amount: number): string {
  const [year, month, date] = day.split('-').map(Number)
  return localDayKey(new Date(year!, month! - 1, date! + amount, 12))
}

function inRange(value: string, start: Date, end: Date): boolean {
  const time = new Date(value).getTime()
  return time >= start.getTime() && time <= end.getTime()
}

function average(values: number[]): number | null {
  return values.length ? round(sum(values) / values.length, 3) : null
}

function standardDeviation(values: number[]): number | null {
  const mean = average(values)
  return mean == null ? null : round(Math.sqrt(sum(values.map(value => (value - mean) ** 2)) / values.length), 3)
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function round(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function nextId(items: Array<{ id: number }>): number {
  return Math.max(0, ...items.map(item => item.id)) + 1
}

function csv(rows: unknown[][]): string {
  const content = rows.map(columns => columns.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')
  return `\uFEFF${content}`
}
