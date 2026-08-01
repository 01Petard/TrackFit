import { getHeader, setResponseHeader, setResponseStatus } from 'h3'
import { readDataSnapshot } from '../../utils/data-file'

export default defineEventHandler(async (event) => {
  const snapshot = await readDataSnapshot()
  setResponseHeader(event, 'ETag', snapshot.etag)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'X-TrackFit-Writable', String(snapshot.writable))
  if (getHeader(event, 'if-none-match') === snapshot.etag) {
    setResponseStatus(event, 304)
    return null
  }
  return snapshot.data
})
