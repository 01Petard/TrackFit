import { backupSchema } from '../../../shared/schemas/trackfit'
import { appSettings, measurementSessions, measurementValues, metricDefinitions } from '../../database/schema'
import { db } from '../../utils/database'
import { parseBodyWithSchema } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const backup = await parseBodyWithSchema(event, backupSchema)

  await db.transaction(async (transaction) => {
    await transaction.delete(measurementValues)
    await transaction.delete(measurementSessions)
    await transaction.delete(metricDefinitions)
    await transaction.delete(appSettings)

    if (backup.settings.length) {
      await transaction.insert(appSettings).values(backup.settings.map(row => ({
        ...row,
        heightCm: row.heightCm?.toFixed(2) ?? null,
      })))
    }
    if (backup.metrics.length) {
      await transaction.insert(metricDefinitions).values(backup.metrics.map(row => ({
        ...row,
        minimumValue: row.minimumValue?.toFixed(3) ?? null,
        maximumValue: row.maximumValue?.toFixed(3) ?? null,
      })))
    }
    if (backup.sessions.length) {
      await transaction.insert(measurementSessions).values(backup.sessions.map(row => ({
        ...row,
        measuredAt: new Date(row.measuredAt),
        heightCmSnapshot: row.heightCmSnapshot?.toFixed(2) ?? null,
      })))
    }
    if (backup.values.length) {
      await transaction.insert(measurementValues).values(backup.values.map(row => ({
        ...row,
        value: row.value.toFixed(3),
      })))
    }
  })

  return {
    success: true,
    restored: {
      metrics: backup.metrics.length,
      sessions: backup.sessions.length,
      values: backup.values.length,
    },
  }
})
