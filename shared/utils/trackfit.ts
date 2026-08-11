import type { MeasurementWrite, MetricCreate, SettingsUpdate, TrackFitData } from '../schemas/trackfit'
import type { AnalyticsDto, AppSettingsDto, MeasurementDto, MeasurementPageDto, MeasurementValueDto, MetricDefinitionDto } from '../types/api'
import { measurementWriteSchema, metricCreateSchema, metricUpdateSchema, settingsUpdateSchema } from '../schemas/trackfit'
import { buildAnalytics, calculateBmi, calculateWaistHipRatio } from './analytics'
import { TrackFitDomainError } from './domain-error'

export interface MeasurementQuery {
  page: number
  pageSize: number
  start?: string
  end?: string
  metricId?: number
}

export function getMetrics(data: TrackFitData): MetricDefinitionDto[] {
  return [...data.metrics].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
}

export function getSettings(data: TrackFitData): AppSettingsDto {
  return data.settings[0] ?? {
    heightCm: null,
    desiredWeightMinimum: null,
    desiredWeightMaximum: null,
    defaultDateRange: '30d',
    sleepGoalHours: 8,
    weeklyTrainingGoalMinutes: 150,
    theme: 'system',
    dataVersion: 1,
  }
}

export function listMeasurements(data: TrackFitData, query: MeasurementQuery): MeasurementPageDto {
  const start = query.start ? new Date(query.start).getTime() : undefined
  const end = query.end ? new Date(query.end).getTime() : undefined
  const records = data.bodyRecords
    .filter(record => start == null || new Date(record.measuredAt).getTime() >= start)
    .filter(record => end == null || new Date(record.measuredAt).getTime() <= end)
    .filter(record => query.metricId == null || record.values.some(value => value.metricId === query.metricId))
    .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime() || b.id - a.id)
  const offset = (query.page - 1) * query.pageSize
  return {
    items: hydrateMeasurements(data, records.slice(offset, offset + query.pageSize)),
    total: records.length,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export function getAnalytics(data: TrackFitData, metricCode: string, start?: string, end?: string): AnalyticsDto | null {
  const metric = data.metrics.find(item => item.code === metricCode)
  if (!metric) return null
  const startTime = start ? new Date(start).getTime() : undefined
  const endTime = end ? new Date(end).getTime() : undefined
  const allPoints = data.bodyRecords.flatMap(record => record.values.flatMap(value => value.metricId === metric.id
    ? [{ id: record.id, measuredAt: record.measuredAt, value: value.value }]
    : []))
  const points = allPoints.filter((point) => {
    const time = new Date(point.measuredAt).getTime()
    return (startTime == null || time >= startTime) && (endTime == null || time <= endTime)
  })
  const analytics = buildAnalytics(points)
  const fullMovingAverages = buildAnalytics(allPoints).movingAverages
  analytics.movingAverages = Object.fromEntries(Object.entries(fullMovingAverages).map(([period, values]) => [
    period,
    values.filter((point) => {
      const time = new Date(point.measuredAt).getTime()
      return (startTime == null || time >= startTime) && (endTime == null || time <= endTime)
    }),
  ])) as typeof analytics.movingAverages
  return { metric, ...analytics }
}

export function createMetric(data: TrackFitData, input: MetricCreate): void {
  const metric = metricCreateSchema.parse(input)
  if (data.metrics.some(item => item.code === metric.code)) throw new TrackFitDomainError('metric.codeExists')
  data.metrics.push({ id: nextId(data.metrics), ...metric, minimumValue: metric.minimumValue ?? null, maximumValue: metric.maximumValue ?? null, metricType: 'custom', enabled: true })
}

export function updateMetric(data: TrackFitData, id: number, input: unknown): void {
  const patch = metricUpdateSchema.parse(input)
  const metric = data.metrics.find(item => item.id === id)
  if (!metric) throw new TrackFitDomainError('metric.notFound')
  if (metric.metricType === 'core' && (patch.code !== undefined || patch.unit !== undefined)) throw new TrackFitDomainError('metric.coreImmutable')
  if (patch.code && data.metrics.some(item => item.id !== id && item.code === patch.code)) throw new TrackFitDomainError('metric.codeExists')
  Object.assign(metric, patch)
}

export function saveSettings(data: TrackFitData, input: SettingsUpdate): void {
  const settings = settingsUpdateSchema.parse(input)
  data.settings = [{ id: 1, ...settings, dataVersion: data.settings[0]?.dataVersion ?? 1 }]
}

export function saveMeasurement(data: TrackFitData, input: unknown, id?: number): number {
  const payload = measurementWriteSchema.parse(input)
  validateMeasurementValues(data, payload)
  const existing = id == null ? undefined : data.bodyRecords.find(record => record.id === id)
  if (id != null && !existing) throw new TrackFitDomainError('measurement.notFound')
  const recordId = existing?.id ?? nextId(data.bodyRecords)
  const measuredAt = payload.measuredAt.toISOString()
  const note = payload.note || null
  if (existing) {
    Object.assign(existing, { measuredAt, note, values: buildRecordValues(data, payload.values) })
  } else {
    data.bodyRecords.push({ id: recordId, measuredAt, note, values: buildRecordValues(data, payload.values) })
  }
  return recordId
}

export function deleteMeasurement(data: TrackFitData, id: number): void {
  if (!data.bodyRecords.some(record => record.id === id)) throw new TrackFitDomainError('measurement.notFound')
  data.bodyRecords = data.bodyRecords.filter(record => record.id !== id)
}

export function createCsv(data: TrackFitData, locale: 'zh' | 'en' = 'zh'): string {
  const metrics = new Map(data.metrics.map(metric => [metric.id, metric]))
  const rows = data.bodyRecords.flatMap(record => record.values.flatMap((value) => {
    const metric = metrics.get(value.metricId)
    return metric ? [{ value, metric, record }] : []
  })).sort((a, b) => new Date(a.record.measuredAt).getTime() - new Date(b.record.measuredAt).getTime() || a.record.id - b.record.id || a.metric.sortOrder - b.metric.sortOrder)
  const lines = [
    locale === 'zh'
      ? ['记录ID', '测量时间', '指标编码', '指标名称', '数值', '单位', '备注']
      : ['Record ID', 'Measured at', 'Metric code', 'Metric name', 'Value', 'Unit', 'Note'],
    ...rows.map(({ value, metric, record }) => [record.id, record.measuredAt, metric.code, metric.name, value.value, metric.unit, record.note ?? '']),
  ].map(columns => columns.map(csvCell).join(','))
  return `\uFEFF${lines.join('\r\n')}`
}

function hydrateMeasurements(data: TrackFitData, records: TrackFitData['bodyRecords']): MeasurementDto[] {
  const metrics = new Map(data.metrics.map(metric => [metric.id, metric]))
  const heightCm = getSettings(data).heightCm
  return records.map((record) => {
    const values: MeasurementValueDto[] = record.values
      .flatMap((value) => {
        const metric = metrics.get(value.metricId)
        return metric ? [{ metricId: metric.id, code: metric.code, name: metric.name, unit: metric.unit, value: value.value }] : []
      })
      .sort((a, b) => (metrics.get(a.metricId)?.sortOrder ?? 0) - (metrics.get(b.metricId)?.sortOrder ?? 0) || a.metricId - b.metricId)
    const byCode = new Map(values.map(value => [value.code, value.value]))
    return {
      id: record.id,
      measuredAt: record.measuredAt,
      note: record.note,
      bmi: calculateBmi(byCode.get('weight'), heightCm),
      waistHipRatio: calculateWaistHipRatio(byCode.get('waist'), byCode.get('hip')),
      values,
    }
  })
}

function buildRecordValues(data: TrackFitData, values: MeasurementWrite['values']): TrackFitData['bodyRecords'][number]['values'] {
  const metrics = new Map(data.metrics.map(metric => [metric.id, metric]))
  return values.map(item => ({
    metricId: item.metricId,
    value: Number(item.value.toFixed(metrics.get(item.metricId)?.decimalPlaces ?? 3)),
  }))
}

function validateMeasurementValues(data: TrackFitData, payload: MeasurementWrite): void {
  const metrics = new Map(data.metrics.map(metric => [metric.id, metric]))
  for (const item of payload.values) {
    const metric = metrics.get(item.metricId)
    if (!metric || !metric.enabled) throw new TrackFitDomainError('metric.unavailable', { id: item.metricId })
    if ((metric.minimumValue != null && item.value < metric.minimumValue) || (metric.maximumValue != null && item.value > metric.maximumValue)) {
      throw new TrackFitDomainError('metric.outOfRange', { metric: metric.name })
    }
  }
}

function nextId(items: Array<{ id: number }>): number {
  return Math.max(0, ...items.map(item => item.id)) + 1
}

function csvCell(value: unknown): string {
  return `"${String(value).replaceAll('"', '""')}"`
}
