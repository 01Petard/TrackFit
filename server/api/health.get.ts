import { readDataSnapshot } from '../utils/data-file'

export default defineEventHandler(async (event) => {
  await readDataSnapshot()
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { status: 'ok' }
})
