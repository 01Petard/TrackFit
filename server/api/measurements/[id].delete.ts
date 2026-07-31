import { getRouterParam } from 'h3'
import { parsePositiveInteger } from '../../utils/http'
import { deleteMeasurement } from '../../utils/measurements'

export default defineEventHandler(async (event) => {
  await deleteMeasurement(parsePositiveInteger(getRouterParam(event, 'id'), '记录 ID'))
  return { success: true }
})

