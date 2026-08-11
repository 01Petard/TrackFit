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
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials', data: { code: 'auth.invalidCredentials' } })
  }
  await setUserSession(event, {
    user: { username: input.username, role },
    loggedInAt: new Date().toISOString(),
  })
  return { role }
})
