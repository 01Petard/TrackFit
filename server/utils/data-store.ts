import { BlobPreconditionFailedError, get, put } from '@vercel/blob'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'

export interface StoredData {
  content: string
  etag: string
  writable: boolean
}

export interface DataStore {
  read(): Promise<StoredData>
  readIfChanged(etag: string): Promise<StoredData | null>
  replace(expectedEtag: string, content: string): Promise<StoredData>
}

export class StoreConflictError extends Error {}

export class FileDataStore implements DataStore {
  private writeQueue = Promise.resolve()

  constructor(
    private readonly filePath: string,
    private readonly initialContent: () => string,
  ) {}

  async read(): Promise<StoredData> {
    await this.ensureFile()
    const content = await readFile(this.filePath, 'utf8')
    return {
      content,
      etag: createEtag(content),
      writable: await this.isWritable(),
    }
  }

  async readIfChanged(etag: string): Promise<StoredData | null> {
    const snapshot = await this.read()
    return snapshot.etag === etag ? null : snapshot
  }

  replace(expectedEtag: string, content: string): Promise<StoredData> {
    const task = this.writeQueue.then(async () => {
      const current = await this.read()
      if (expectedEtag !== '*' && expectedEtag !== current.etag) throw new StoreConflictError()
      await this.atomicWrite(content)
      return { content, etag: createEtag(content), writable: true }
    })
    this.writeQueue = task.then(() => undefined, () => undefined)
    return task
  }

  private async ensureFile(): Promise<void> {
    try {
      await access(this.filePath, constants.F_OK)
    } catch (error) {
      if (!isErrorCode(error, 'ENOENT')) throw error
      await mkdir(dirname(this.filePath), { recursive: true })
      try {
        await writeFile(this.filePath, this.initialContent(), { encoding: 'utf8', flag: 'wx', flush: true })
      } catch (writeError) {
        if (!isErrorCode(writeError, 'EEXIST')) throw writeError
      }
    }
  }

  private async atomicWrite(content: string): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const temporaryPath = resolve(dirname(this.filePath), `.${basename(this.filePath)}.${process.pid}.${Date.now()}.tmp`)
    try {
      await writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx', flush: true })
      await rename(temporaryPath, this.filePath)
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined)
      throw error
    }
  }

  private async isWritable(): Promise<boolean> {
    try {
      await access(this.filePath, constants.R_OK | constants.W_OK)
      return true
    } catch {
      return false
    }
  }
}

export class BlobDataStore implements DataStore {
  constructor(
    private readonly pathname: string,
    private readonly initialContent: () => string,
  ) {}

  async read(): Promise<StoredData> {
    const result = await get(this.pathname, { access: 'private', useCache: false })
    if (result) return await blobResultToStoredData(result)
    return await this.createInitialBlob()
  }

  async readIfChanged(etag: string): Promise<StoredData | null> {
    const result = await get(this.pathname, {
      access: 'private',
      useCache: false,
      ifNoneMatch: normalizeBlobEtag(etag),
    })
    if (!result) return await this.createInitialBlob()
    if (result.statusCode === 304) return null
    return await blobResultToStoredData(result)
  }

  async replace(expectedEtag: string, content: string): Promise<StoredData> {
    try {
      const result = await put(this.pathname, content, {
        access: 'private',
        allowOverwrite: true,
        contentType: 'application/json; charset=utf-8',
        cacheControlMaxAge: 60,
        ...(expectedEtag === '*' ? {} : { ifMatch: normalizeBlobEtag(expectedEtag) }),
      })
      return { content, etag: normalizeBlobEtag(result.etag), writable: true }
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) throw new StoreConflictError()
      throw error
    }
  }

  private async createInitialBlob(): Promise<StoredData> {
    const content = this.initialContent()
    try {
      const result = await put(this.pathname, content, {
        access: 'private',
        contentType: 'application/json; charset=utf-8',
        cacheControlMaxAge: 60,
      })
      return { content, etag: normalizeBlobEtag(result.etag), writable: true }
    } catch (error) {
      const existing = await get(this.pathname, { access: 'private', useCache: false }).catch(() => null)
      if (existing) return await blobResultToStoredData(existing)
      throw error
    }
  }
}

async function blobResultToStoredData(result: NonNullable<Awaited<ReturnType<typeof get>>>): Promise<StoredData> {
  if (result.statusCode === 304 || !result.stream) throw new Error('条件读取未返回数据内容')
  return {
    content: await new Response(result.stream).text(),
    etag: normalizeBlobEtag(result.blob.etag),
    writable: true,
  }
}

function normalizeBlobEtag(etag: string): string {
  return etag.startsWith('W/') ? etag.slice(2) : etag
}

function createEtag(content: string): string {
  return `"${createHash('sha256').update(content).digest('base64url')}"`
}

function isErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}
