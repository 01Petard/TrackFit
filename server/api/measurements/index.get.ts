import { getQuery } from 'h3'
import { listMeasurements } from '../../utils/measurements'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
  const start = typeof query.start === 'string' && query.start ? new Date(query.start) : undefined
  const end = typeof query.end === 'string' && query.end ? new Date(query.end) : undefined
  const metricId = typeof query.metricId === 'string' && query.metricId ? Number(query.metricId) : undefined

  return listMeasurements({ page, pageSize, start, end, metricId })
})

