import { getRouterParam } from 'h3'
import { measurementWriteSchema } from '../../../shared/schemas/trackfit'
import { parseBodyWithSchema, parsePositiveInteger } from '../../utils/http'
import { updateMeasurement } from '../../utils/measurements'

export default defineEventHandler(async (event) => {
  const id = parsePositiveInteger(getRouterParam(event, 'id'), '记录 ID')
  return updateMeasurement(id, await parseBodyWithSchema(event, measurementWriteSchema))
})
