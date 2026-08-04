import { randomBytes, scryptSync } from 'node:crypto'

const password = process.argv[2]
if (!password) {
  console.error('Usage: pnpm auth:hash <password>')
  process.exitCode = 1
} else {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  console.log(`scrypt:${salt.toString('hex')}:${hash.toString('hex')}`)
}
