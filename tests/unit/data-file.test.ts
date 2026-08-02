import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DataConflictError, readDataSnapshot, replaceData } from '../../server/utils/data-file'

describe('JSON 数据文件仓储', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(resolve(tmpdir(), 'trackfit-'))
    process.env.TRACKFIT_DATA_FILE = resolve(directory, 'trackfit-data.json')
  })

  afterEach(async () => {
    delete process.env.TRACKFIT_DATA_FILE
    await rm(directory, { recursive: true })
  })

  it('首次读取时创建默认文件并可原子更新', async () => {
    const initial = await readDataSnapshot()
    expect(initial.data.metrics).toHaveLength(8)
    initial.data.settings[0]!.heightCm = 175

    const saved = await replaceData(initial.etag, initial.data)
    expect(saved.data.settings[0]?.heightCm).toBe(175)
    expect(JSON.parse(await readFile(process.env.TRACKFIT_DATA_FILE!, 'utf8')).settings[0].heightCm).toBe(175)
  })

  it('拒绝使用过期 ETag 覆盖数据', async () => {
    const initial = await readDataSnapshot()
    await replaceData(initial.etag, initial.data)
    await expect(replaceData(initial.etag, initial.data)).rejects.toBeInstanceOf(DataConflictError)
  })

  it('损坏文件不会被空数据覆盖', async () => {
    await writeFile(process.env.TRACKFIT_DATA_FILE!, '{broken', 'utf8')
    await expect(readDataSnapshot()).rejects.toThrow()
    expect(await readFile(process.env.TRACKFIT_DATA_FILE!, 'utf8')).toBe('{broken')
  })

  it('读取旧数据时自动补齐目标体重字段', async () => {
    await writeFile(process.env.TRACKFIT_DATA_FILE!, JSON.stringify({
      version: 1,
      exportedAt: '2026-08-01T00:00:00.000Z',
      settings: [{ id: 1, heightCm: 175, defaultDateRange: '30d', theme: 'system', dataVersion: 1 }],
      metrics: [],
      sessions: [],
      values: [],
    }), 'utf8')
    const snapshot = await readDataSnapshot()
    expect(snapshot.data.settings[0]).toMatchObject({ desiredWeightMinimum: null, desiredWeightMaximum: null })
  })
})
