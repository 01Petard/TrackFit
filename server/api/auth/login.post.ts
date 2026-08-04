import { z } from 'zod'
import { verifyCredential } from '../../utils/auth'

const credentialSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(256),
})

export default defineEventHandler(async (event) => {
  const input = await readValidatedBody(event, credentialSchema.parse)
  const role = verifyCredential(input.username, input.password)
  if (!role) {
    throw createError({ statusCode: 401, statusMessage: '用户名或密码错误' })
  }
  await setUserSession(event, {
    user: { username: input.username, role },
    loggedInAt: new Date().toISOString(),
  })
  return { role }
})
