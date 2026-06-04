'use client'

import { formatCurrency, formatPercent } from '@/lib/utils'
import { BTCTicker } from '@/types'
import { format } from 'date-fns'
import Link from 'next/link'
import { ExternalLink, TrendingUp, TrendingDown } from 'lucide-react'

interface Trade {
  id: string
  side: string
  entryPrice: number
  exitPrice?: number | null
  quantity: number
  notional: number
  status: string
  pnl?: number | null
  pnlPct?: number | null
  tradingMode: string
  openedAt: Date
  closedAt?: Date | null
}

interface Props {
  trades: Trade[]
  ticker: BTCTicker
}

export default function TradeHistory({ trades, ticker }: Props) {
  return (
    <div className="card-glass rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <h3 className="font-semibold text-sm">Recent Trades</h3>
        <Link
          href="/dashboard/trades"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
        >
          View all <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {trades.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          No trades yet. Activate the bot to start trading.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border/30">
                <th className="text-left px-4 py-2.5 font-medium">Side</th>
                <th className="text-right px-4 py-2.5 font-medium">Entry</th>
                <th className="text-right px-4 py-2.5 font-medium">Exit / Current</th>
                <th className="text-right px-4 py-2.5 font-medium">Size</th>
                <th className="text-right px-4 py-2.5 font-medium">P&L</th>
                <th className="text-right px-4 py-2.5 font-medium">Status</th>
                <th className="text-right px-4 py-2.5 font-medium">Mode</th>
                <th className="text-right px-4 py-2.5 font-medium">Opened</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => {
                const isOpen = trade.status === 'OPEN'
                const exitPrice = isOpen ? ticker.price : (trade.exitPrice ?? null)
                const priceDiff = exitPrice
                  ? trade.side === 'LONG' ? exitPrice - trade.entryPrice : trade.entryPrice - exitPrice
                  : null
                const currentPnl = isOpen && priceDiff !== null ? priceDiff * trade.quantity : trade.pnl
                const currentPnlPct = isOpen && priceDiff !== null
                  ? (priceDiff / trade.entryPrice) * 100
                  : trade.pnlPct

                return (
                  <tr key={trade.id} className="border-b border-border/20 hover:bg-secondary/50 transition">
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 font-medium ${
                        trade.side === 'LONG' ? 'text-profit' : 'text-loss'
                      }`}>
                        {trade.side === 'LONG'
                          ? <TrendingUp className="w-3.5 h-3.5" />
                          : <TrendingDown className="w-3.5 h-3.5" />
                        }
                        {trade.side}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right mono text-xs">
                      {formatCurrency(trade.entryPrice, 'USD', 0)}
                    </td>
                    <td className="px-4 py-3 text-right mono text-xs">
                      {exitPrice ? formatCurrency(exitPrice, 'USD', 0) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right mono text-xs">
                      {trade.quantity.toFixed(4)} BTC
                    </td>
                    <td className={`px-4 py-3 text-right mono text-xs font-medium ${
                      currentPnl == null ? 'text-muted-foreground' :
                      currentPnl >= 0 ? 'text-profit' : 'text-loss'
                    }`}>
                      {currentPnl != null
                        ? `${currentPnl >= 0 ? '+' : ''}${formatCurrency(currentPnl)}`
                        : '—'}
                      {currentPnlPct != null && (
                        <span className="text-xs opacity-70 ml-1">
                          ({formatPercent(currentPnlPct)})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        isOpen
                          ? 'bg-profit/15 text-profit'
                          : trade.status === 'CLOSED'
                          ? 'bg-secondary text-muted-foreground'
                          : 'bg-loss/15 text-loss'
                      }`}>
                        {trade.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs ${
                        trade.tradingMode === 'LIVE' ? 'text-btc' : 'text-muted-foreground'
                      }`}>
                        {trade.tradingMode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {format(new Date(trade.openedAt), 'MM/dd HH:mm')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
