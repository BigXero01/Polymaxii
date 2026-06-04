import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getCachedTicker } from '@/lib/binance'
import { calculateSharpe } from '@/lib/utils'
import db from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return apiError('Unauthorized', 401)
  const userId = (session.user as any).id

  const [portfolio, closedTrades, ticker] = await Promise.all([
    db.portfolio.findUnique({ where: { userId } }),
    db.trade.findMany({
      where: { userId, status: 'CLOSED' },
      select: { pnl: true, pnlPct: true, openedAt: true, closedAt: true, side: true },
      orderBy: { closedAt: 'asc' },
    }),
    getCachedTicker(),
  ])

  if (!portfolio) return apiError('Portfolio not found', 404)

  // Open trades unrealized PnL
  const openTrades = await db.trade.findMany({
    where: { userId, status: 'OPEN' },
  })
  const unrealizedPnl = openTrades.reduce((acc, t) => {
    const priceDiff = t.side === 'LONG'
      ? ticker.price - t.entryPrice
      : t.entryPrice - ticker.price
    return acc + priceDiff * t.quantity
  }, 0)

  // Performance metrics
  const wins = closedTrades.filter(t => (t.pnl ?? 0) > 0)
  const losses = closedTrades.filter(t => (t.pnl ?? 0) <= 0)
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0
  const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + (t.pnl ?? 0), 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, t) => a + (t.pnl ?? 0), 0) / losses.length) : 0
  const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : 0

  const returns = closedTrades.map(t => t.pnlPct ?? 0)
  const sharpeRatio = calculateSharpe(returns)

  const totalDeposited = portfolio.totalDeposited
  const totalReturn = portfolio.realizedPnl + unrealizedPnl
  const totalReturnPct = totalDeposited > 0 ? (totalReturn / totalDeposited) * 100 : 0

  return apiSuccess({
    usdBalance: portfolio.usdBalance,
    btcBalance: portfolio.btcBalance,
    btcValueUsd: portfolio.btcBalance * ticker.price,
    totalValueUsd: portfolio.usdBalance + portfolio.btcBalance * ticker.price,
    totalDeposited,
    totalWithdrawn: portfolio.totalWithdrawn,
    realizedPnl: portfolio.realizedPnl,
    unrealizedPnl,
    totalReturn,
    totalReturnPct,
    winRate,
    profitFactor,
    sharpeRatio,
    maxDrawdown: portfolio.maxDrawdown,
    totalTrades: closedTrades.length,
    openTrades: openTrades.length,
    avgWin,
    avgLoss,
    currentBtcPrice: ticker.price,
  })
}
