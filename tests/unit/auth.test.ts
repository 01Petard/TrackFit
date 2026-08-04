import { scryptSync } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { verifyCredential } from '../../server/utils/auth'

describe('固定账号认证', () => {
  beforeEach(() => {
    process.env.TRACKFIT_ADMIN_USERNAME = 'owner'
    process.env.TRACKFIT_ADMIN_PASSWORD_HASH = createHash('admin-secret', '00112233445566778899aabbccddeeff')
    process.env.TRACKFIT_VIEWER_USERNAME = 'guest'
    process.env.TRACKFIT_VIEWER_PASSWORD_HASH = createHash('viewer-secret', 'ffeeddccbbaa99887766554433221100')
  })

  afterEach(() => {
    delete process.env.TRACKFIT_ADMIN_USERNAME
    delete process.env.TRACKFIT_ADMIN_PASSWORD_HASH
    delete process.env.TRACKFIT_VIEWER_USERNAME
    delete process.env.TRACKFIT_VIEWER_PASSWORD_HASH
  })

  it('识别管理员和只读访客', () => {
    expect(verifyCredential('owner', 'admin-secret')).toBe('admin')
    expect(verifyCredential('guest', 'viewer-secret')).toBe('viewer')
  })

  it('拒绝错误密码、未知账号和非法哈希', () => {
    expect(verifyCredential('owner', 'wrong')).toBeNull()
    expect(verifyCredential('unknown', 'admin-secret')).toBeNull()
    process.env.TRACKFIT_ADMIN_PASSWORD_HASH = 'broken'
    expect(verifyCredential('owner', 'admin-secret')).toBeNull()
  })
})

function createHash(password: string, saltHex: string): string {
  return `scrypt:${saltHex}:${scryptSync(password, Buffer.from(saltHex, 'hex'), 64).toString('hex')}`
}
