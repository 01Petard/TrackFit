import { asc, eq } from 'drizzle-orm'
import { setResponseHeader } from 'h3'
import { measurementSessions, measurementValues, metricDefinitions } from '../../database/schema'
import { db } from '../../utils/database'

export default defineEventHandler(async (event) => {
  const rows = await db.select({
    id: measurementSessions.id,
    measuredAt: measurementSessions.measuredAt,
    note: measurementSessions.note,
    metric: metricDefinitions.name,
    code: metricDefinitions.code,
    value: measurementValues.value,
    unit: metricDefinitions.unit,
  }).from(measurementValues)
    .innerJoin(measurementSessions, eq(measurementSessions.id, measurementValues.sessionId))
    .innerJoin(metricDefinitions, eq(metricDefinitions.id, measurementValues.metricId))
    .orderBy(asc(measurementSessions.measuredAt), asc(measurementSessions.id), asc(metricDefinitions.sortOrder))

  const lines = [
    ['记录ID', '测量时间', '指标编码', '指标名称', '数值', '单位', '备注'],
    ...rows.map(row => [row.id, row.measuredAt.toISOString(), row.code, row.metric, row.value, row.unit, row.note ?? '']),
  ].map(columns => columns.map(csvCell).join(','))

  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'Content-Disposition', 'attachment; filename="trackfit-measurements.csv"')
  return `\uFEFF${lines.join('\r\n')}`
})

function csvCell(value: unknown): string {
  const content = String(value).replaceAll('"', '""')
  return `"${content}"`
}

