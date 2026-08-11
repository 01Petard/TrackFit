import type { H3Event } from 'h3'
import type { TrackFitRole } from '../../shared/types/auth'
import { scryptSync, timingSafeEqual } from 'node:crypto'

interface FixedCredential {
  username: string
  passwordHash: string
  role: TrackFitRole
}

export function verifyCredential(username: string, password: string): TrackFitRole | null {
  const credential = getCredentials().find(item => item.username === username)
  if (!credential || !verifyPassword(password, credential.passwordHash)) return null
  return credential.role
}

export async function requireTrackFitUser(event: H3Event) {
  return await requireUserSession(event)
}

export async function requireTrackFitAdmin(event: H3Event) {
  const session = await requireTrackFitUser(event)
  if (session.user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'This account is read-only', data: { code: 'auth.readOnly' } })
  }
  return session
}

function getCredentials(): FixedCredential[] {
  return [
    {
      username: process.env.TRACKFIT_ADMIN_USERNAME ?? '',
      passwordHash: process.env.TRACKFIT_ADMIN_PASSWORD_HASH ?? '',
      role: 'admin' as const,
    },
    {
      username: process.env.TRACKFIT_VIEWER_USERNAME ?? '',
      passwordHash: process.env.TRACKFIT_VIEWER_PASSWORD_HASH ?? '',
      role: 'viewer' as const,
    },
  ].filter(item => item.username && item.passwordHash)
}

function verifyPassword(password: string, encodedHash: string): boolean {
  const [algorithm, saltHex, expectedHex, extra] = encodedHash.split(':')
  if (algorithm !== 'scrypt' || !saltHex || !expectedHex || extra) return false
  try {
    const expected = Buffer.from(expectedHex, 'hex')
    const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length)
    return expected.length > 0 && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
