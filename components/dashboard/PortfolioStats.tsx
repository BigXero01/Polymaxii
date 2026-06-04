'use client'

import { formatCurrency, formatBTC, formatPercent } from '@/lib/utils'
import { BTCTicker } from '@/types'
import { DollarSign, Bitcoin, TrendingUp, Activity } from 'lucide-react'

interface Portfolio {
  usdBalance: number
  btcBalance: number
  totalDeposited: number
  realizedPnl: number
  maxDrawdown: number
}

interface Props {
  portfolio: Portfolio
  ticker: BTCTicker
}

export default function PortfolioStats({ portfolio, ticker }: Props) {
  const btcValueUsd = portfolio.btcBalance * ticker.price
  const totalValue = portfolio.usdBalance + btcValueUsd
  const totalReturn = portfolio.realizedPnl
  const totalReturnPct = portfolio.totalDeposited > 0
    ? (totalReturn / portfolio.totalDeposited) * 100
    : 0

  const stats = [
    {
      label: 'Total Balance',
      value: formatCurrency(totalValue),
      sub: `${formatCurrency(portfolio.usdBalance)} USD + ${formatBTC(portfolio.btcBalance, 4)} BTC`,
      icon: DollarSign,
      color: 'text-btc',
      glow: 'glow-btc',
    },
    {
      label: 'Realized P&L',
      value: formatCurrency(totalReturn),
      sub: formatPercent(totalReturnPct),
      icon: TrendingUp,
      color: totalReturn >= 0 ? 'text-profit' : 'text-loss',
      glow: totalReturn >= 0 ? 'glow-profit' : 'glow-loss',
    },
    {
      label: 'BTC Holdings',
      value: formatBTC(portfolio.btcBalance),
      sub: `≈ ${formatCurrency(btcValueUsd)}`,
      icon: Bitcoin,
      color: 'text-btc',
      glow: '',
    },
    {
      label: 'Max Drawdown',
      value: formatPercent(-portfolio.maxDrawdown),
      sub: 'All time low',
      icon: Activity,
      color: portfolio.maxDrawdown > 20 ? 'text-loss' : 'text-muted-foreground',
      glow: '',
    },
  ]

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className={`card-glass rounded-xl p-4 ${s.glow}`}>
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {s.label}
            </span>
            <div className={`p-1.5 rounded-lg bg-secondary ${s.color}`}>
              <s.icon className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className={`text-xl font-bold mono ${s.color}`}>{s.value}</p>
          <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
        </div>
      ))}
    </div>
  )
}
