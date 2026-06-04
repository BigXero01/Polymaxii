import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { closeTrade } from '@/lib/trader'
import { getCachedTicker } from '@/lib/binance'
import db from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// GET /api/trades — list user trades
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return apiError('Unauthorized', 401)
  const userId = (session.user as any).id

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status') as 'OPEN' | 'CLOSED' | null
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
  const skip = (page - 1) * limit

  const where: any = { userId }
  if (status) where.status = status

  const [trades, total] = await Promise.all([
    db.trade.findMany({
      where,
      orderBy: { openedAt: 'desc' },
      skip,
      take: limit,
    }),
    db.trade.count({ where }),
  ])

  // Enrich open trades with unrealized PnL
  let enriched = trades
  if (status === 'OPEN' || !status) {
    const ticker = await getCachedTicker()
    enriched = trades.map(t => {
      if (t.status !== 'OPEN') return t
      const priceDiff = t.side === 'LONG'
        ? ticker.price - t.entryPrice
        : t.entryPrice - ticker.price
      const unrealizedPnl = priceDiff * t.quantity
      const unrealizedPnlPct = (priceDiff / t.entryPrice) * 100
      return { ...t, unrealizedPnl, unrealizedPnlPct, currentPrice: ticker.price }
    })
  }

  return apiSuccess({ trades: enriched, total, page, limit })
}
