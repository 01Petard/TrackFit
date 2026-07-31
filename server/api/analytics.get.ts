import type { MetricDefinitionDto } from '../../shared/types/api'
import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { createError, getQuery } from 'h3'
import { measurementSessions, measurementValues, metricDefinitions } from '../database/schema'
import { buildAnalytics } from '../utils/analytics'
import { db } from '../utils/database'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const metricCode = typeof query.metric === 'string' ? query.metric : 'weight'
  const start = typeof query.start === 'string' && query.start ? new Date(query.start) : undefined
  const end = typeof query.end === 'string' && query.end ? new Date(query.end) : undefined

  const metrics = await db.select().from(metricDefinitions).where(eq(metricDefinitions.code, metricCode)).limit(1)
  const metric = metrics[0]
  if (!metric) {
    throw createError({ statusCode: 404, statusMessage: '分析指标不存在' })
  }

  const conditions = [
    eq(measurementValues.metricId, metric.id),
    start ? gte(measurementSessions.measuredAt, start) : undefined,
    end ? lte(measurementSessions.measuredAt, end) : undefined,
  ].filter(Boolean)
  const rawPoints = await db.select({
    id: measurementSessions.id,
    measuredAt: measurementSessions.measuredAt,
    value: measurementValues.value,
  }).from(measurementValues)
    .innerJoin(measurementSessions, eq(measurementSessions.id, measurementValues.sessionId))
    .where(and(...conditions))
    .orderBy(asc(measurementSessions.measuredAt), asc(measurementSessions.id))

  const result = buildAnalytics(rawPoints.map(point => ({ ...point, value: Number(point.value) })))
  const metricDto: MetricDefinitionDto = {
    ...metric,
    minimumValue: metric.minimumValue == null ? null : Number(metric.minimumValue),
    maximumValue: metric.maximumValue == null ? null : Number(metric.maximumValue),
  }
  return { metric: metricDto, ...result }
})

