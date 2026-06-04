import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { subDays, format } from 'date-fns'
import db from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return apiError('Unauthorized', 401)
  const userId = (session.user as any).id

  const { searchParams } = req.nextUrl
  const period = (searchParams.get('period') ?? '30d') as '7d' | '30d' | '90d' | 'all'

  const daysMap = { '7d': 7, '30d': 30, '90d': 90, all: 365 * 3 }
  const since = subDays(new Date(), daysMap[period] ?? 30)

  const trades = await db.trade.findMany({
    where: {
      userId,
      status: 'CLOSED',
      closedAt: { gte: since },
    },
    orderBy: { closedAt: 'asc' },
    select: { pnl: true, pnlPct: true, closedAt: true, side: true, entryPrice: true, exitPrice: true },
  })

  // Daily PnL history
  const pnlByDay = new Map<string, number>()
  let cumulative = 0
  const pnlHistory: { date: string; pnl: number; cumulative: number }[] = []

  for (const trade of trades) {
    const day = format(trade.closedAt!, 'yyyy-MM-dd')
    pnlByDay.set(day, (pnlByDay.get(day) ?? 0) + (trade.pnl ?? 0))
  }

  for (const [date, pnl] of pnlByDay) {
    cumulative += pnl
    pnlHistory.push({ date, pnl, cumulative })
  }

  // Trade distribution
  const wins = trades.filter(t => (t.pnl ?? 0) > 0.01).length
  const losses = trades.filter(t => (t.pnl ?? 0) < -0.01).length
  const breakeven = trades.length - wins - losses

  // Hourly performance
  const hourlyMap = new Map<number, { total: number; count: number }>()
  for (const trade of trades) {
    const hour = trade.closedAt!.getHours()
    const curr = hourlyMap.get(hour) ?? { total: 0, count: 0 }
    hourlyMap.set(hour, { total: curr.total + (trade.pnl ?? 0), count: curr.count + 1 })
  }
  const hourlyPerformance = Array.from(hourlyMap.entries())
    .map(([hour, { total, count }]) => ({ hour, avgPnl: total / count, trades: count }))
    .sort((a, b) => a.hour - b.hour)

  // Prediction accuracy
  const predictions = await db.prediction.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { status: true },
  })
  const predictionAccuracy = {
    correct: predictions.filter(p => p.status === 'CORRECT').length,
    incorrect: predictions.filter(p => p.status === 'INCORRECT').length,
    expired: predictions.filter(p => p.status === 'EXPIRED').length,
  }

  return apiSuccess({
    period,
    pnlHistory,
    tradeDistribution: { win: wins, loss: losses, breakeven },
    hourlyPerformance,
    predictionAccuracy,
    totalTrades: trades.length,
  })
}
