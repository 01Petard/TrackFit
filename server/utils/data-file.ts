import type { TrackFitData } from '../../shared/schemas/trackfit'
import type { DataStore } from './data-store'
import { resolve } from 'node:path'
import { backupSchema } from '../../shared/schemas/trackfit'
import { BlobDataStore, FileDataStore, StoreConflictError } from './data-store'

export interface DataSnapshot {
  data: TrackFitData
  etag: string
  writable: boolean
}

const stores = new Map<string, DataStore>()

export async function readDataSnapshot(): Promise<DataSnapshot> {
  return parseStoredData(await getDataStore().read())
}

export async function readDataSnapshotIfChanged(etag: string): Promise<DataSnapshot | null> {
  const stored = await getDataStore().readIfChanged(etag)
  return stored ? parseStoredData(stored) : null
}

export async function replaceData(expectedEtag: string, input: unknown): Promise<DataSnapshot> {
  const parsed = backupSchema.safeParse(input)
  if (!parsed.success) throw new InvalidDataError(parsed.error.issues[0]?.message ?? '数据格式无效')
  const data = { ...parsed.data, exportedAt: new Date().toISOString() }
  const content = `${JSON.stringify(data, null, 2)}\n`
  try {
    const stored = await getDataStore().replace(expectedEtag, content)
    return { data, etag: stored.etag, writable: stored.writable }
  } catch (error) {
    if (error instanceof StoreConflictError) throw new DataConflictError()
    throw error
  }
}

export class DataConflictError extends Error {}
export class InvalidDataError extends Error {}

function getDataStore(): DataStore {
  const mode = process.env.TRACKFIT_STORAGE ?? 'file'
  if (mode === 'blob') {
    const pathname = process.env.TRACKFIT_BLOB_PATH ?? 'trackfit/trackfit-data.json'
    if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
      throw new Error('Blob 存储未配置 BLOB_READ_WRITE_TOKEN 或 BLOB_STORE_ID')
    }
    return cachedStore(`blob:${pathname}`, () => new BlobDataStore(pathname, createDefaultContent))
  }
  if (mode !== 'file') throw new Error(`不支持的 TRACKFIT_STORAGE: ${mode}`)
  const configured = process.env.TRACKFIT_DATA_FILE
  const filePath = resolve(configured || resolve(process.cwd(), 'data/trackfit-data.json'))
  return cachedStore(`file:${filePath}`, () => new FileDataStore(filePath, createDefaultContent))
}

function cachedStore(key: string, factory: () => DataStore): DataStore {
  const existing = stores.get(key)
  if (existing) return existing
  const store = factory()
  stores.set(key, store)
  return store
}

function parseStoredData(stored: Awaited<ReturnType<DataStore['read']>>): DataSnapshot {
  let input: unknown
  try {
    input = JSON.parse(stored.content)
  } catch {
    throw new Error('数据文件格式无效: JSON 解析失败')
  }
  const parsed = backupSchema.safeParse(input)
  if (!parsed.success) throw new Error(`数据文件格式无效: ${parsed.error.issues[0]?.message ?? '未知错误'}`)
  return { data: parsed.data, etag: stored.etag, writable: stored.writable }
}

function createDefaultContent(): string {
  return `${JSON.stringify(createDefaultData(), null, 2)}\n`
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
    version: 3,
    exportedAt: new Date().toISOString(),
    settings: [{
      id: 1,
      heightCm: null,
      desiredWeightMinimum: null,
      desiredWeightMaximum: null,
      defaultDateRange: '30d',
      sleepGoalHours: 8,
      weeklyTrainingGoalMinutes: 150,
      theme: 'system',
      dataVersion: 1,
    }],
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
    trainingSessions: [],
    sleepRecords: [],
  }
}
