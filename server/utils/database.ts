import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from '../database/schema'

const databaseUrl = process.env.DATABASE_URL || useRuntimeConfig().databaseUrl

if (!databaseUrl) {
  throw new Error('DATABASE_URL 未配置')
}

const globalDatabase = globalThis as typeof globalThis & {
  trackfitPool?: mysql.Pool
}

const pool = globalDatabase.trackfitPool ?? mysql.createPool({
  uri: databaseUrl,
  connectionLimit: 10,
  enableKeepAlive: true,
  decimalNumbers: true,
  timezone: 'Z',
})

if (import.meta.dev) {
  globalDatabase.trackfitPool = pool
}

export const db = drizzle({ client: pool, schema, mode: 'default' })
export { pool }
