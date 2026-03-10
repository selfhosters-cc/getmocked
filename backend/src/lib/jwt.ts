import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

export function signToken(payload: { userId: string }): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: string } {
  return jwt.verify(token, SECRET) as { userId: string }
}
