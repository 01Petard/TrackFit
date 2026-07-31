import { sql } from 'drizzle-orm'
import { db } from '../utils/database'

export default defineEventHandler(async () => {
  const result = await db.execute(sql`SELECT VERSION() AS version`)
  const version = String((result[0] as unknown as Array<{ version: string }>)[0]?.version ?? 'unknown')
  return {
    status: 'ok',
    database: 'mysql',
    version,
    expectedVersion: '8.0.32',
    versionMatched: version.startsWith('8.0.32'),
  }
})
