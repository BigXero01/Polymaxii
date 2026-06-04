import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { closeTrade } from '@/lib/trader'
import { getCachedTicker } from '@/lib/binance'
import db from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// DELETE /api/trades/[id] — close a trade manually
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return apiError('Unauthorized', 401)
  const userId = (session.user as any).id

  const trade = await db.trade.findUnique({ where: { id: params.id } })
  if (!trade || trade.userId !== userId) return apiError('Trade not found', 404)
  if (trade.status !== 'OPEN') return apiError('Trade is not open', 400)

  const ticker = await getCachedTicker()
  await closeTrade(userId, trade.id, ticker.price, 'MANUAL')

  return apiSuccess({ message: 'Trade closed', exitPrice: ticker.price })
}

// GET /api/trades/[id] — get single trade
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return apiError('Unauthorized', 401)
  const userId = (session.user as any).id

  const trade = await db.trade.findUnique({ where: { id: params.id } })
  if (!trade || trade.userId !== userId) return apiError('Trade not found', 404)

  return apiSuccess(trade)
}
