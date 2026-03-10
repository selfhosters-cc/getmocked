import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const mockupSetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

describe('mockup set validation', () => {
  it('accepts valid mockup set data', () => {
    const result = mockupSetSchema.safeParse({ name: 'Black T-Shirt', description: '5 angles' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = mockupSetSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})
