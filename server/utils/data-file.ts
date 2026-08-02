import type { TrackFitData } from '../../shared/schemas/trackfit'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { backupSchema } from '../../shared/schemas/trackfit'

interface DataSnapshot {
  data: TrackFitData
  etag: string
  writable: boolean
}

let writeQueue = Promise.resolve()

export async function readDataSnapshot(): Promise<DataSnapshot> {
  const filePath = getDataFilePath()
  await ensureDataFile(filePath)
  const content = await readFile(filePath, 'utf8')
  const parsed = backupSchema.safeParse(JSON.parse(content))
  if (!parsed.success) throw new Error(`数据文件格式无效: ${parsed.error.issues[0]?.message ?? '未知错误'}`)
  return {
    data: parsed.data,
    etag: createEtag(content),
    writable: await isWritable(filePath),
  }
}

export function replaceData(expectedEtag: string, input: unknown): Promise<DataSnapshot> {
  const task = writeQueue.then(async () => {
    const current = await readDataSnapshot()
    if (expectedEtag !== '*' && expectedEtag !== current.etag) {
      return Promise.reject(new DataConflictError())
    }
    const parsed = backupSchema.safeParse(input)
    if (!parsed.success) throw new InvalidDataError(parsed.error.issues[0]?.message ?? '数据格式无效')
    const data = { ...parsed.data, exportedAt: new Date().toISOString() }
    const content = `${JSON.stringify(data, null, 2)}\n`
    await atomicWrite(getDataFilePath(), content)
    return { data, etag: createEtag(content), writable: true }
  })
  writeQueue = task.then(() => undefined, () => undefined)
  return task
}

export class DataConflictError extends Error {}
export class InvalidDataError extends Error {}

function getDataFilePath(): string {
  const configured = process.env.TRACKFIT_DATA_FILE || useRuntimeConfig().dataFile
  return resolve(configured || resolve(process.cwd(), 'data/trackfit-data.json'))
}

async function ensureDataFile(filePath: string): Promise<void> {
  try {
    await access(filePath, constants.F_OK)
  } catch (error) {
    if (!isMissingFile(error)) throw error
    await mkdir(dirname(filePath), { recursive: true })
    try {
      await writeFile(filePath, `${JSON.stringify(createDefaultData(), null, 2)}\n`, { encoding: 'utf8', flag: 'wx', flush: true })
    } catch (writeError) {
      if (!isExistingFile(writeError)) throw writeError
    }
  }
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  const temporaryPath = resolve(dirname(filePath), `.${basename(filePath)}.${process.pid}.${Date.now()}.tmp`)
  try {
    await writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx', flush: true })
    await rename(temporaryPath, filePath)
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
}

async function isWritable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.R_OK | constants.W_OK)
    return true
  } catch {
    return false
  }
}

function createEtag(content: string): string {
  return `"${createHash('sha256').update(content).digest('base64url')}"`
}

function createDefaultData(): TrackFitData {
  const metrics = [
    ['weight', '体重', 'kg', 2, 20, 400],
    ['body_fat', '体脂率', '%', 1, 1, 75],
    ['waist', '腰围', 'cm', 1, 30, 300],
    ['hip', '臀围', 'cm', 1, 30, 300],
    ['chest', '胸围', 'cm', 1, 30, 300],
    ['upper_arm', '上臂围', 'cm', 1, 10, 150],
    ['thigh', '大腿围', 'cm', 1, 10, 200],
    ['calf', '小腿围', 'cm', 1, 10, 150],
  ] as const
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: [{ id: 1, heightCm: null, desiredWeightMinimum: null, desiredWeightMaximum: null, defaultDateRange: '30d', theme: 'system', dataVersion: 1 }],
    metrics: metrics.map(([code, name, unit, decimalPlaces, minimumValue, maximumValue], index) => ({
      id: index + 1,
      code,
      name,
      unit,
      decimalPlaces,
      minimumValue,
      maximumValue,
      metricType: 'core',
      enabled: true,
      sortOrder: (index + 1) * 10,
    })),
    sessions: [],
    values: [],
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function isExistingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST'
}
