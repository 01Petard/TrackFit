import { getHeader, setResponseHeader, setResponseStatus } from 'h3'
import { readDataSnapshot, readDataSnapshotIfChanged } from '../../utils/data-file'
import { requireTrackFitUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const session = await requireTrackFitUser(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const requestedEtag = getHeader(event, 'if-none-match')
  const snapshot = requestedEtag ? await readDataSnapshotIfChanged(requestedEtag) : await readDataSnapshot()
  if (!snapshot) {
    setResponseHeader(event, 'ETag', requestedEtag!)
    setResponseStatus(event, 304)
    return null
  }
  setResponseHeader(event, 'ETag', snapshot.etag)
  setResponseHeader(event, 'X-TrackFit-Writable', String(snapshot.writable && session.user.role === 'admin'))
  return snapshot.data
})
