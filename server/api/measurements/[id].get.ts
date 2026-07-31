import { getRouterParam } from 'h3'
import { parsePositiveInteger } from '../../utils/http'
import { getMeasurement } from '../../utils/measurements'

export default defineEventHandler(async (event) => {
  return getMeasurement(parsePositiveInteger(getRouterParam(event, 'id'), '记录 ID'))
})

