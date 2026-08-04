import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BlobDataStore, StoreConflictError } from '../../server/utils/data-store'

const blob = vi.hoisted(() => {
  class BlobPreconditionFailedError extends Error {}
  return {
    get: vi.fn(),
    put: vi.fn(),
    BlobPreconditionFailedError,
  }
})

vi.mock('@vercel/blob', () => blob)

describe('Vercel Blob JSON 仓储', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Blob 不存在时创建默认数据', async () => {
    blob.get.mockResolvedValueOnce(null)
    blob.put.mockResolvedValueOnce({ etag: 'etag-1' })
    const store = new BlobDataStore('trackfit/data.json', () => '{"version":3}\n')

    await expect(store.read()).resolves.toEqual({ content: '{"version":3}\n', etag: 'etag-1', writable: true })
    expect(blob.put).toHaveBeenCalledWith('trackfit/data.json', '{"version":3}\n', expect.objectContaining({ access: 'private' }))
  })

  it('支持条件读取和条件更新', async () => {
    blob.get.mockResolvedValueOnce({ statusCode: 304, stream: null, blob: { etag: '"etag-1"' } })
    blob.put.mockResolvedValueOnce({ etag: '"etag-2"' })
    const store = new BlobDataStore('trackfit/data.json', () => '{}\n')

    await expect(store.readIfChanged('"etag-1"')).resolves.toBeNull()
    await expect(store.replace('"etag-1"', '{"version":3}\n')).resolves.toEqual({ content: '{"version":3}\n', etag: '"etag-2"', writable: true })
    expect(blob.get).toHaveBeenCalledWith('trackfit/data.json', expect.objectContaining({ ifNoneMatch: '"etag-1"' }))
    expect(blob.put).toHaveBeenCalledWith('trackfit/data.json', '{"version":3}\n', expect.objectContaining({ ifMatch: '"etag-1"', allowOverwrite: true }))
  })

  it('将 Blob 前置条件失败转换为存储冲突', async () => {
    blob.put.mockRejectedValueOnce(new blob.BlobPreconditionFailedError())
    const store = new BlobDataStore('trackfit/data.json', () => '{}\n')
    await expect(store.replace('stale-etag', '{}\n')).rejects.toBeInstanceOf(StoreConflictError)
  })

  it('读取完整 Blob 内容', async () => {
    const stream = new Response('{"version":3}\n').body
    blob.get.mockResolvedValueOnce({ statusCode: 200, stream, blob: { etag: 'etag-1' } })
    const store = new BlobDataStore('trackfit/data.json', () => '{}\n')
    await expect(store.read()).resolves.toEqual({ content: '{"version":3}\n', etag: 'etag-1', writable: true })
  })
})
