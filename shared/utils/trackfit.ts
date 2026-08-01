import type { MeasurementWrite, MetricCreate, SettingsUpdate, TrackFitData } from '../schemas/trackfit'
import type { AnalyticsDto, AppSettingsDto, MeasurementDto, MeasurementPageDto, MeasurementValueDto, MetricDefinitionDto } from '../types/api'
import { measurementWriteSchema, metricCreateSchema, metricUpdateSchema, settingsUpdateSchema } from '../schemas/trackfit'
import { buildAnalytics, calculateBmi, calculateWaistHipRatio } from './analytics'

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
  return data.settings[0] ?? { heightCm: null, defaultDateRange: '30d', theme: 'system', dataVersion: 1 }
}

export function listMeasurements(data: TrackFitData, query: MeasurementQuery): MeasurementPageDto {
  const start = query.start ? new Date(query.start).getTime() : undefined
  const end = query.end ? new Date(query.end).getTime() : undefined
  const matchingSessionIds = query.metricId == null
    ? undefined
    : new Set(data.values.filter(value => value.metricId === query.metricId).map(value => value.sessionId))
  const sessions = data.sessions
    .filter(session => start == null || new Date(session.measuredAt).getTime() >= start)
    .filter(session => end == null || new Date(session.measuredAt).getTime() <= end)
    .filter(session => !matchingSessionIds || matchingSessionIds.has(session.id))
    .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime() || b.id - a.id)
  const offset = (query.page - 1) * query.pageSize
  return {
    items: hydrateMeasurements(data, sessions.slice(offset, offset + query.pageSize)),
    total: sessions.length,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export function getAnalytics(data: TrackFitData, metricCode: string, start?: string, end?: string): AnalyticsDto | null {
  const metric = data.metrics.find(item => item.code === metricCode)
  if (!metric) return null
  const sessions = new Map(data.sessions.map(session => [session.id, session]))
  const startTime = start ? new Date(start).getTime() : undefined
  const endTime = end ? new Date(end).getTime() : undefined
  const points = data.values.flatMap((value) => {
    if (value.metricId !== metric.id) return []
    const session = sessions.get(value.sessionId)
    if (!session) return []
    const time = new Date(session.measuredAt).getTime()
    if (startTime != null && time < startTime) return []
    if (endTime != null && time > endTime) return []
    return [{ id: session.id, measuredAt: session.measuredAt, value: value.value }]
  })
  return { metric, ...buildAnalytics(points) }
}

export function createMetric(data: TrackFitData, input: MetricCreate): void {
  const metric = metricCreateSchema.parse(input)
  if (data.metrics.some(item => item.code === metric.code)) throw new Error('指标编码已存在')
  data.metrics.push({ id: nextId(data.metrics), ...metric, minimumValue: metric.minimumValue ?? null, maximumValue: metric.maximumValue ?? null, metricType: 'custom', enabled: true })
}

export function updateMetric(data: TrackFitData, id: number, input: unknown): void {
  const patch = metricUpdateSchema.parse(input)
  const metric = data.metrics.find(item => item.id === id)
  if (!metric) throw new Error('指标不存在')
  if (metric.metricType === 'core' && (patch.code !== undefined || patch.unit !== undefined)) throw new Error('核心指标编码和单位不可修改')
  if (patch.code && data.metrics.some(item => item.id !== id && item.code === patch.code)) throw new Error('指标编码已存在')
  Object.assign(metric, patch)
}

export function saveSettings(data: TrackFitData, input: SettingsUpdate): void {
  const settings = settingsUpdateSchema.parse(input)
  data.settings = [{ id: 1, ...settings, dataVersion: data.settings[0]?.dataVersion ?? 1 }]
}

export function saveMeasurement(data: TrackFitData, input: unknown, id?: number): number {
  const payload = measurementWriteSchema.parse(input)
  validateMeasurementValues(data, payload)
  const existing = id == null ? undefined : data.sessions.find(session => session.id === id)
  if (id != null && !existing) throw new Error('测量记录不存在')
  const sessionId = existing?.id ?? nextId(data.sessions)
  const measuredAt = payload.measuredAt.toISOString()
  const note = payload.note || null
  if (existing) {
    Object.assign(existing, { measuredAt, note })
    data.values = data.values.filter(value => value.sessionId !== sessionId)
  } else {
    data.sessions.push({ id: sessionId, measuredAt, heightCmSnapshot: getSettings(data).heightCm, note })
  }
  let valueId = nextId(data.values)
  const metrics = new Map(data.metrics.map(metric => [metric.id, metric]))
  data.values.push(...payload.values.map(item => ({
    id: valueId++,
    sessionId,
    metricId: item.metricId,
    value: Number(item.value.toFixed(metrics.get(item.metricId)?.decimalPlaces ?? 3)),
  })))
  return sessionId
}

export function deleteMeasurement(data: TrackFitData, id: number): void {
  if (!data.sessions.some(session => session.id === id)) throw new Error('测量记录不存在')
  data.sessions = data.sessions.filter(session => session.id !== id)
  data.values = data.values.filter(value => value.sessionId !== id)
}

export function createCsv(data: TrackFitData): string {
  const metrics = new Map(data.metrics.map(metric => [metric.id, metric]))
  const sessions = new Map(data.sessions.map(session => [session.id, session]))
  const rows = data.values.flatMap((value) => {
    const metric = metrics.get(value.metricId)
    const session = sessions.get(value.sessionId)
    return metric && session ? [{ value, metric, session }] : []
  }).sort((a, b) => new Date(a.session.measuredAt).getTime() - new Date(b.session.measuredAt).getTime() || a.session.id - b.session.id || a.metric.sortOrder - b.metric.sortOrder)
  const lines = [
    ['记录ID', '测量时间', '指标编码', '指标名称', '数值', '单位', '备注'],
    ...rows.map(({ value, metric, session }) => [session.id, session.measuredAt, metric.code, metric.name, value.value, metric.unit, session.note ?? '']),
  ].map(columns => columns.map(csvCell).join(','))
  return `\uFEFF${lines.join('\r\n')}`
}

function hydrateMeasurements(data: TrackFitData, sessions: TrackFitData['sessions']): MeasurementDto[] {
  const metrics = new Map(data.metrics.map(metric => [metric.id, metric]))
  return sessions.map((session) => {
    const values: MeasurementValueDto[] = data.values
      .filter(value => value.sessionId === session.id)
      .flatMap((value) => {
        const metric = metrics.get(value.metricId)
        return metric ? [{ metricId: metric.id, code: metric.code, name: metric.name, unit: metric.unit, value: value.value }] : []
      })
      .sort((a, b) => (metrics.get(a.metricId)?.sortOrder ?? 0) - (metrics.get(b.metricId)?.sortOrder ?? 0) || a.metricId - b.metricId)
    const byCode = new Map(values.map(value => [value.code, value.value]))
    return {
      id: session.id,
      measuredAt: session.measuredAt,
      heightCmSnapshot: session.heightCmSnapshot,
      note: session.note,
      bmi: calculateBmi(byCode.get('weight'), session.heightCmSnapshot),
      waistHipRatio: calculateWaistHipRatio(byCode.get('waist'), byCode.get('hip')),
      values,
    }
  })
}

function validateMeasurementValues(data: TrackFitData, payload: MeasurementWrite): void {
  const metrics = new Map(data.metrics.map(metric => [metric.id, metric]))
  for (const item of payload.values) {
    const metric = metrics.get(item.metricId)
    if (!metric || !metric.enabled) throw new Error(`指标 ${item.metricId} 不存在或已停用`)
    if ((metric.minimumValue != null && item.value < metric.minimumValue) || (metric.maximumValue != null && item.value > metric.maximumValue)) {
      throw new Error(`${metric.name} 超出合理范围`)
    }
  }
}

function nextId(items: Array<{ id: number }>): number {
  return Math.max(0, ...items.map(item => item.id)) + 1
}

function csvCell(value: unknown): string {
  return `"${String(value).replaceAll('"', '""')}"`
}
