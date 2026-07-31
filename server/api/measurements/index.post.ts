import { measurementWriteSchema } from '../../../shared/schemas/trackfit'
import { parseBodyWithSchema } from '../../utils/http'
import { createMeasurement } from '../../utils/measurements'

export default defineEventHandler(async (event) => {
  return createMeasurement(await parseBodyWithSchema(event, measurementWriteSchema))
})
