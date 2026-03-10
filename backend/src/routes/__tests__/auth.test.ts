import { describe, it, expect } from 'vitest'
import { hashPassword, comparePassword } from '../../lib/auth-utils.js'
import { signToken, verifyToken } from '../../lib/jwt.js'

describe('auth utilities', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('test123')
    expect(hash).not.toBe('test123')
    expect(await comparePassword('test123', hash)).toBe(true)
    expect(await comparePassword('wrong', hash)).toBe(false)
  })

  it('signs and verifies JWT tokens', () => {
    const token = signToken({ userId: 'abc-123' })
    const payload = verifyToken(token)
    expect(payload.userId).toBe('abc-123')
  })

  it('rejects invalid JWT tokens', () => {
    expect(() => verifyToken('garbage')).toThrow()
  })
})
