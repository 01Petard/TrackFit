import { createError, getHeader, readBody, setResponseHeader } from 'h3'
import { dataEtagHeader, readDataIfMatch } from '../../../shared/utils/data-version'
import { DataConflictError, InvalidDataError, replaceData } from '../../utils/data-file'
import { requireTrackFitAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireTrackFitAdmin(event)
  const expectedEtag = readDataIfMatch({ get: name => getHeader(event, name) ?? null })
  if (!expectedEtag) throw createError({ statusCode: 428, statusMessage: 'Missing data version', data: { code: 'data.versionMissing' } })
  try {
    const snapshot = await replaceData(expectedEtag, await readBody(event))
    setResponseHeader(event, 'ETag', snapshot.etag)
    setResponseHeader(event, dataEtagHeader, snapshot.etag)
    setResponseHeader(event, 'Cache-Control', 'private, no-store')
    setResponseHeader(event, 'X-TrackFit-Writable', String(snapshot.writable))
    return snapshot.data
  } catch (error) {
    if (error instanceof DataConflictError) throw createError({ statusCode: 409, statusMessage: 'Data was updated elsewhere', data: { code: 'data.conflict' } })
    if (error instanceof InvalidDataError) throw createError({ statusCode: 422, statusMessage: 'Invalid data', data: { code: 'data.invalid' } })
    throw error
  }
})
