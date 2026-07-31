import type { MeasurementDto, MeasurementValueDto } from '../../shared/types/api'
import type { MeasurementWrite } from '../../shared/schemas/trackfit'
import { and, asc, count, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { createError } from 'h3'
import { appSettings, measurementSessions, measurementValues, metricDefinitions } from '../database/schema'
import { calculateBmi, calculateWaistHipRatio } from './analytics'
import { db } from './database'

interface ListOptions {
  page: number
  pageSize: number
  start?: Date
  end?: Date
  metricId?: number
}

export async function listMeasurements(options: ListOptions) {
  const conditions = [
    options.start ? gte(measurementSessions.measuredAt, options.start) : undefined,
    options.end ? lte(measurementSessions.measuredAt, options.end) : undefined,
    options.metricId
      ? inArray(
          measurementSessions.id,
          db.select({ sessionId: measurementValues.sessionId })
            .from(measurementValues)
            .where(eq(measurementValues.metricId, options.metricId)),
        )
      : undefined,
  ].filter(Boolean)
  const where = conditions.length ? and(...conditions) : undefined

  const [sessions, totalRows] = await Promise.all([
    db.select().from(measurementSessions)
      .where(where)
      .orderBy(desc(measurementSessions.measuredAt), desc(measurementSessions.id))
      .limit(options.pageSize)
      .offset((options.page - 1) * options.pageSize),
    db.select({ value: count() }).from(measurementSessions).where(where),
  ])

  return {
    items: await hydrateMeasurements(sessions),
    total: totalRows[0]?.value ?? 0,
    page: options.page,
    pageSize: options.pageSize,
  }
}

export async function getMeasurement(id: number): Promise<MeasurementDto> {
  const sessions = await db.select().from(measurementSessions).where(eq(measurementSessions.id, id)).limit(1)
  if (!sessions[0]) {
    throw createError({ statusCode: 404, statusMessage: '测量记录不存在' })
  }
  return (await hydrateMeasurements(sessions))[0]!
}

export async function createMeasurement(payload: MeasurementWrite): Promise<MeasurementDto> {
  const metrics = await validateMetricValues(payload)
  const settings = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1)
  const heightCmSnapshot = settings[0]?.heightCm ?? null

  const id = await db.transaction(async (transaction) => {
    const result = await transaction.insert(measurementSessions).values({
      measuredAt: payload.measuredAt,
      heightCmSnapshot,
      note: payload.note || null,
    })
    const sessionId = result[0].insertId
    await transaction.insert(measurementValues).values(payload.values.map(item => ({
      sessionId,
      metricId: item.metricId,
      value: item.value.toFixed(metrics.get(item.metricId)?.decimalPlaces ?? 3),
    })))
    return sessionId
  })

  return getMeasurement(id)
}

export async function updateMeasurement(id: number, payload: MeasurementWrite): Promise<MeasurementDto> {
  await getMeasurement(id)
  const metrics = await validateMetricValues(payload)

  await db.transaction(async (transaction) => {
    await transaction.update(measurementSessions).set({
      measuredAt: payload.measuredAt,
      note: payload.note || null,
    }).where(eq(measurementSessions.id, id))
    await transaction.delete(measurementValues).where(eq(measurementValues.sessionId, id))
    await transaction.insert(measurementValues).values(payload.values.map(item => ({
      sessionId: id,
      metricId: item.metricId,
      value: item.value.toFixed(metrics.get(item.metricId)?.decimalPlaces ?? 3),
    })))
  })

  return getMeasurement(id)
}

export async function deleteMeasurement(id: number): Promise<void> {
  const result = await db.delete(measurementSessions).where(eq(measurementSessions.id, id))
  if (result[0].affectedRows === 0) {
    throw createError({ statusCode: 404, statusMessage: '测量记录不存在' })
  }
}

async function validateMetricValues(payload: MeasurementWrite) {
  const ids = payload.values.map(item => item.metricId)
  const metrics = await db.select().from(metricDefinitions).where(inArray(metricDefinitions.id, ids))
  const metricMap = new Map(metrics.map(metric => [metric.id, metric]))

  for (const item of payload.values) {
    const metric = metricMap.get(item.metricId)
    if (!metric || !metric.enabled) {
      throw createError({ statusCode: 422, statusMessage: `指标 ${item.metricId} 不存在或已停用` })
    }
    const minimum = metric.minimumValue == null ? null : Number(metric.minimumValue)
    const maximum = metric.maximumValue == null ? null : Number(metric.maximumValue)
    if ((minimum != null && item.value < minimum) || (maximum != null && item.value > maximum)) {
      throw createError({ statusCode: 422, statusMessage: `${metric.name} 超出合理范围` })
    }
  }

  return metricMap
}

async function hydrateMeasurements(sessions: typeof measurementSessions.$inferSelect[]): Promise<MeasurementDto[]> {
  if (!sessions.length) {
    return []
  }
  const rows = await db.select({
    sessionId: measurementValues.sessionId,
    metricId: metricDefinitions.id,
    code: metricDefinitions.code,
    name: metricDefinitions.name,
    unit: metricDefinitions.unit,
    value: measurementValues.value,
  }).from(measurementValues)
    .innerJoin(metricDefinitions, eq(metricDefinitions.id, measurementValues.metricId))
    .where(inArray(measurementValues.sessionId, sessions.map(session => session.id)))
    .orderBy(asc(metricDefinitions.sortOrder), asc(metricDefinitions.id))

  const valuesBySession = new Map<number, typeof rows>()
  for (const row of rows) {
    const values = valuesBySession.get(row.sessionId) ?? []
    values.push(row)
    valuesBySession.set(row.sessionId, values)
  }
  return sessions.map((session) => {
    const values: MeasurementValueDto[] = (valuesBySession.get(session.id) ?? []).map(row => ({
      metricId: row.metricId,
      code: row.code,
      name: row.name,
      unit: row.unit,
      value: Number(row.value),
    }))
    const byCode = new Map(values.map(value => [value.code, value.value]))
    const height = session.heightCmSnapshot == null ? null : Number(session.heightCmSnapshot)
    return {
      id: session.id,
      measuredAt: session.measuredAt.toISOString(),
      heightCmSnapshot: height,
      note: session.note,
      bmi: calculateBmi(byCode.get('weight'), height),
      waistHipRatio: calculateWaistHipRatio(byCode.get('waist'), byCode.get('hip')),
      values,
    }
  })
}
