import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import db from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/utils'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message)
    }

    const { email, password, name } = parsed.data

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) return apiError('Email already registered', 409)

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await db.user.create({
      data: { email, passwordHash, name },
      select: { id: true, email: true, name: true },
    })

    // Bootstrap portfolio and settings
    await Promise.all([
      db.portfolio.create({ data: { userId: user.id } }),
      db.botSettings.create({ data: { userId: user.id } }),
    ])

    return apiSuccess({ user }, 201)
  } catch (err) {
    console.error('[Register]', err)
    return apiError('Registration failed', 500)
  }
}
