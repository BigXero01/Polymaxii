import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import db from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const settingsSchema = z.object({
  isActive: z.boolean().optional(),
  tradingMode: z.enum(['PAPER', 'LIVE']).optional(),
  minConfidence: z.number().min(50).max(95).optional(),
  maxPositionSizePct: z.number().min(0.5).max(20).optional(),
  stopLossPct: z.number().min(0.5).max(10).optional(),
  takeProfitPct: z.number().min(0.5).max(20).optional(),
  maxConcurrentTrades: z.number().int().min(1).max(10).optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return apiError('Unauthorized', 401)
  const userId = (session.user as any).id

  const settings = await db.botSettings.findUnique({ where: { userId } })
  if (!settings) return apiError('Settings not found', 404)
  return apiSuccess(settings)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return apiError('Unauthorized', 401)
  const userId = (session.user as any).id

  const body = await req.json().catch(() => ({}))
  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.errors[0].message)

  // If switching to LIVE, check API keys exist
  if (parsed.data.tradingMode === 'LIVE') {
    const apiKey = await db.exchangeApiKey.findFirst({
      where: { userId, isActive: true },
    })
    if (!apiKey) {
      return apiError('Add Binance API keys before enabling live trading', 400)
    }
  }

  const settings = await db.botSettings.upsert({
    where: { userId },
    create: { userId, ...parsed.data },
    update: parsed.data,
  })

  return apiSuccess(settings)
}
