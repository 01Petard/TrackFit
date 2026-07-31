import { asc } from 'drizzle-orm'
import { setResponseHeader } from 'h3'
import { appSettings, measurementSessions, measurementValues, metricDefinitions } from '../database/schema'
import { db } from '../utils/database'

export default defineEventHandler(async (event) => {
  const [settings, metrics, sessions, values] = await Promise.all([
    db.select().from(appSettings),
    db.select().from(metricDefinitions).orderBy(asc(metricDefinitions.id)),
    db.select().from(measurementSessions).orderBy(asc(measurementSessions.id)),
    db.select().from(measurementValues).orderBy(asc(measurementValues.id)),
  ])

  setResponseHeader(event, 'Content-Disposition', 'attachment; filename="trackfit-backup.json"')
  return {
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    settings: settings.map(row => ({
      id: row.id,
      heightCm: row.heightCm == null ? null : Number(row.heightCm),
      defaultDateRange: row.defaultDateRange,
      theme: row.theme,
      dataVersion: row.dataVersion,
    })),
    metrics: metrics.map(row => ({
      id: row.id,
      code: row.code,
      name: row.name,
      unit: row.unit,
      decimalPlaces: row.decimalPlaces,
      minimumValue: row.minimumValue == null ? null : Number(row.minimumValue),
      maximumValue: row.maximumValue == null ? null : Number(row.maximumValue),
      metricType: row.metricType,
      enabled: row.enabled,
      sortOrder: row.sortOrder,
    })),
    sessions: sessions.map(row => ({
      id: row.id,
      measuredAt: row.measuredAt.toISOString(),
      heightCmSnapshot: row.heightCmSnapshot == null ? null : Number(row.heightCmSnapshot),
      note: row.note,
    })),
    values: values.map(row => ({
      id: row.id,
      sessionId: row.sessionId,
      metricId: row.metricId,
      value: Number(row.value),
    })),
  }
})

