import type { AppSettingsDto } from '../../shared/types/api'
import { eq } from 'drizzle-orm'
import { appSettings } from '../database/schema'
import { db } from '../utils/database'

export default defineEventHandler(async (): Promise<AppSettingsDto> => {
  const rows = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1)
  const settings = rows[0]
  return {
    heightCm: settings?.heightCm == null ? null : Number(settings.heightCm),
    defaultDateRange: settings?.defaultDateRange ?? '30d',
    theme: settings?.theme ?? 'system',
    dataVersion: settings?.dataVersion ?? 1,
  }
})

