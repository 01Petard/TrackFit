import { asc } from 'drizzle-orm'
import { metricDefinitions } from '../../database/schema'
import { db } from '../../utils/database'

export default defineEventHandler(async () => {
  const rows = await db.select().from(metricDefinitions)
    .orderBy(asc(metricDefinitions.sortOrder), asc(metricDefinitions.id))
  return rows.map(metric => ({
    ...metric,
    minimumValue: metric.minimumValue == null ? null : Number(metric.minimumValue),
    maximumValue: metric.maximumValue == null ? null : Number(metric.maximumValue),
  }))
})

