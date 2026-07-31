import { eq } from 'drizzle-orm'
import { createError, getRouterParam } from 'h3'
import { metricUpdateSchema } from '../../../shared/schemas/trackfit'
import { metricDefinitions } from '../../database/schema'
import { db } from '../../utils/database'
import { parseBodyWithSchema, parsePositiveInteger } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const id = parsePositiveInteger(getRouterParam(event, 'id'), '指标 ID')
  const existing = await db.select().from(metricDefinitions).where(eq(metricDefinitions.id, id)).limit(1)
  if (!existing[0]) {
    throw createError({ statusCode: 404, statusMessage: '指标不存在' })
  }

  const payload = await parseBodyWithSchema(event, metricUpdateSchema)
  if (existing[0].metricType === 'core' && (payload.code || payload.unit)) {
    throw createError({ statusCode: 422, statusMessage: '核心指标编码和单位不可修改' })
  }

  await db.update(metricDefinitions).set({
    ...payload,
    minimumValue: payload.minimumValue === undefined ? undefined : payload.minimumValue?.toFixed(3) ?? null,
    maximumValue: payload.maximumValue === undefined ? undefined : payload.maximumValue?.toFixed(3) ?? null,
  }).where(eq(metricDefinitions.id, id))
  return { success: true }
})
