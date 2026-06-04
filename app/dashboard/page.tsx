import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { getCachedTicker } from '@/lib/binance'
import PortfolioStats from '@/components/dashboard/PortfolioStats'
import PredictionCard from '@/components/trading/PredictionCard'
import TradingBot from '@/components/trading/TradingBot'
import PriceChart from '@/components/charts/PriceChart'
import TradeHistory from '@/components/trading/TradeHistory'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await auth()
  const userId = (session!.user as any).id

  const [ticker, portfolio, botSettings, recentTrades] = await Promise.all([
    getCachedTicker(),
    db.portfolio.findUnique({ where: { userId } }),
    db.botSettings.findUnique({ where: { userId } }),
    db.trade.findMany({
      where: { userId },
      orderBy: { openedAt: 'desc' },
      take: 10,
    }),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            BTC/USDT · 15-minute AI trading
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${botSettings?.isActive ? 'bg-profit animate-pulse' : 'bg-muted-foreground'}`} />
          <span className="text-sm font-medium">
            Bot {botSettings?.isActive ? 'Active' : 'Inactive'} ·{' '}
            <span className={botSettings?.tradingMode === 'LIVE' ? 'text-btc' : 'text-muted-foreground'}>
              {botSettings?.tradingMode ?? 'PAPER'} Mode
            </span>
          </span>
        </div>
      </div>

      {/* Portfolio Stats Row */}
      <Suspense fallback={<div className="grid grid-cols-4 gap-4">{Array(4).fill(0).map((_, i) => <StatSkeleton key={i} />)}</div>}>
        {portfolio && <PortfolioStats portfolio={portfolio} ticker={ticker} />}
      </Suspense>

      {/* Main Grid: Chart + Prediction */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <PriceChart />
        </div>
        <div className="space-y-4">
          <PredictionCard userId={userId} />
          <TradingBot settings={botSettings!} />
        </div>
      </div>

      {/* Recent Trades */}
      <TradeHistory trades={recentTrades} ticker={ticker} />
    </div>
  )
}

function StatSkeleton() {
  return <div className="card-glass rounded-xl h-24 animate-pulse" />
}
