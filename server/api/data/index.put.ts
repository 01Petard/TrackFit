import { createError, getHeader, readBody, setResponseHeader } from 'h3'
import { DataConflictError, InvalidDataError, replaceData } from '../../utils/data-file'

export default defineEventHandler(async (event) => {
  const expectedEtag = getHeader(event, 'if-match')
  if (!expectedEtag) throw createError({ statusCode: 428, statusMessage: '缺少数据版本，请刷新后重试' })
  try {
    const snapshot = await replaceData(expectedEtag, await readBody(event))
    setResponseHeader(event, 'ETag', snapshot.etag)
    setResponseHeader(event, 'Cache-Control', 'no-store')
    setResponseHeader(event, 'X-TrackFit-Writable', String(snapshot.writable))
    return snapshot.data
  } catch (error) {
    if (error instanceof DataConflictError) throw createError({ statusCode: 409, statusMessage: '数据已被其他设备更新' })
    if (error instanceof InvalidDataError) throw createError({ statusCode: 422, statusMessage: error.message })
    throw error
  }
})
