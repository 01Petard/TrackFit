import { createError } from 'h3'
import { metricCreateSchema } from '../../../shared/schemas/trackfit'
import { metricDefinitions } from '../../database/schema'
import { db } from '../../utils/database'
import { parseBodyWithSchema } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const payload = await parseBodyWithSchema(event, metricCreateSchema)
  try {
    const result = await db.insert(metricDefinitions).values({
      ...payload,
      minimumValue: payload.minimumValue?.toFixed(3) ?? null,
      maximumValue: payload.maximumValue?.toFixed(3) ?? null,
      metricType: 'custom',
    })
    return { id: result[0].insertId }
  } catch (error) {
    if (isDuplicateEntry(error)) {
      throw createError({ statusCode: 409, statusMessage: '指标编码已存在' })
    }
    throw createError({ statusCode: 500, statusMessage: '新增指标失败' })
  }
})

function isDuplicateEntry(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
}
