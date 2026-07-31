import { defineConfig } from 'drizzle-kit'

process.loadEnvFile?.()

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL 未配置')
}

export default defineConfig({
  dialect: 'mysql',
  schema: './server/database/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
})
