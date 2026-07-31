import type { ZodType } from 'zod'
import { createError, readBody } from 'h3'

export async function parseBodyWithSchema<T>(event: Parameters<typeof readBody>[0], schema: ZodType<T>): Promise<T> {
  const result = schema.safeParse(await readBody(event))
  if (!result.success) {
    throw createError({
      statusCode: 422,
      statusMessage: '请求参数校验失败',
      data: result.error.flatten(),
    })
  }
  return result.data
}

export function parsePositiveInteger(value: string | undefined, name: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError({ statusCode: 400, statusMessage: `${name} 无效` })
  }
  return parsed
}
