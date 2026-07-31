import { settingsUpdateSchema } from '../../shared/schemas/trackfit'
import { appSettings } from '../database/schema'
import { db } from '../utils/database'
import { parseBodyWithSchema } from '../utils/http'

export default defineEventHandler(async (event) => {
  const payload = await parseBodyWithSchema(event, settingsUpdateSchema)
  await db.insert(appSettings).values({
    id: 1,
    heightCm: payload.heightCm.toFixed(2),
    defaultDateRange: payload.defaultDateRange,
    theme: payload.theme,
  }).onDuplicateKeyUpdate({ set: {
    heightCm: payload.heightCm.toFixed(2),
    defaultDateRange: payload.defaultDateRange,
    theme: payload.theme,
  } })
  return { success: true }
})
