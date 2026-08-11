import { put } from '@vercel/blob'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { backupSchema } from '../shared/schemas/trackfit.ts'

async function main(): Promise<void> {
  loadLocalEnv()

  const filePath = resolve(process.env.TRACKFIT_DATA_FILE || 'data/trackfit-data.json')
  const pathname = process.env.TRACKFIT_BLOB_PATH || 'trackfit/trackfit-data.json'
  const source = await readFile(filePath, 'utf8')
  const data = backupSchema.parse(JSON.parse(source))
  const content = `${JSON.stringify(data, null, 2)}\n`

  console.log('数据校验通过', {
    filePath,
    pathname,
    metrics: data.metrics.length,
    bodyRecords: data.bodyRecords.length,
    bodyRecordValues: data.bodyRecords.reduce((total, record) => total + record.values.length, 0),
    trainingRecords: data.trainingRecords.length,
    sleepRecords: data.sleepRecords.length,
  })

  if (!process.argv.includes('--confirm')) {
    console.log('当前为预检查，确认覆盖时执行 pnpm blob:restore --confirm')
    return
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new Error('缺少 BLOB_READ_WRITE_TOKEN，请先配置本地 .env')

  const result = await put(pathname, content, {
    token,
    access: 'private',
    allowOverwrite: true,
    contentType: 'application/json; charset=utf-8',
    cacheControlMaxAge: 60,
  })

  console.log('Blob 恢复成功', {
    pathname: result.pathname,
    etag: result.etag,
  })
}

function loadLocalEnv(): void {
  try {
    process.loadEnvFile(resolve('.env'))
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
  }
}

await main()
