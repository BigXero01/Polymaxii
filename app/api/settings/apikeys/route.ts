import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import crypto from 'crypto'
import db from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/utils'

const schema = z.object({
  apiKey: z.string().min(10),
  secretKey: z.string().min(10),
  label: z.string().optional(),
})

function encryptKey(text: string): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key) return text // Return plaintext if no encryption key (dev only)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv)
  return iv.toString('hex') + ':' + cipher.update(text, 'utf8', 'hex') + cipher.final('hex')
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return apiError('Unauthorized', 401)
  const userId = (session.user as any).id

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.errors[0].message)

  const existing = await db.exchangeApiKey.count({ where: { userId } })
  if (existing >= 5) return apiError('Maximum 5 API keys allowed', 400)

  const record = await db.exchangeApiKey.create({
    data: {
      userId,
      apiKey: encryptKey(parsed.data.apiKey),
      secretKey: encryptKey(parsed.data.secretKey),
      label: parsed.data.label,
    },
    select: { id: true, label: true, exchange: true, isActive: true },
  })

  return apiSuccess(record, 201)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return apiError('Unauthorized', 401)
  const userId = (session.user as any).id

  const { searchParams } = req.nextUrl
  const id = searchParams.get('id')
  if (!id) return apiError('Missing id')

  const key = await db.exchangeApiKey.findUnique({ where: { id } })
  if (!key || key.userId !== userId) return apiError('Not found', 404)

  await db.exchangeApiKey.delete({ where: { id } })
  return apiSuccess({ deleted: true })
}
