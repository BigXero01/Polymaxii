'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { TrendingUp, TrendingDown, X } from 'lucide-react'

type StatusFilter = 'ALL' | 'OPEN' | 'CLOSED'

interface Props { userId: string }

export default function TradesPage({ userId }: Props) {
  const [trades, setTrades] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [loading, setLoading] = useState(false)

  const fetchTrades = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      const res = await fetch(`/api/trades?${params}`)
      const data = await res.json()
      if (data.success) {
        setTrades(data.data.trades)
        setTotal(data.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => { fetchTrades() }, [fetchTrades])

  async function closeTrade(id: string) {
    const res = await fetch(`/api/trades/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) {
      toast.success(`Trade closed at ${formatCurrency(data.data.exitPrice, 'USD', 0)}`)
      fetchTrades()
    } else {
      toast.error(data.error)
    }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trades</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{total} total trades</p>
        </div>
        <div className="flex gap-1">
          {(['ALL', 'OPEN', 'CLOSED'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                statusFilter === s
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="card-glass rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : trades.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No trades found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border/30">
                  {['Side', 'Entry', 'Exit', 'Qty', 'Notional', 'P&L', 'Mode', 'Status', 'Opened', 'Closed', ''].map(h => (
                    <th key={h} className="text-right first:text-left px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map(t => {
                  const pnl = t.pnl ?? t.unrealizedPnl
                  const pnlPct = t.pnlPct ?? t.unrealizedPnlPct
                  return (
                    <tr key={t.id} className="border-b border-border/20 hover:bg-secondary/30 transition">
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 font-medium text-xs ${
                          t.side === 'LONG' ? 'text-profit' : 'text-loss'
                        }`}>
                          {t.side === 'LONG' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {t.side}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right mono text-xs">{formatCurrency(t.entryPrice, 'USD', 0)}</td>
                      <td className="px-4 py-3 text-right mono text-xs">
                        {t.exitPrice ? formatCurrency(t.exitPrice, 'USD', 0) :
                         t.currentPrice ? <span className="text-muted-foreground">{formatCurrency(t.currentPrice, 'USD', 0)}</span> : '—'}
                      </td>
                      <td className="px-4 py-3 text-right mono text-xs">{t.quantity.toFixed(5)}</td>
                      <td className="px-4 py-3 text-right mono text-xs">{formatCurrency(t.notional)}</td>
                      <td className={`px-4 py-3 text-right mono text-xs font-medium ${
                        pnl == null ? 'text-muted-foreground' : pnl >= 0 ? 'text-profit' : 'text-loss'
                      }`}>
                        {pnl != null ? `${pnl >= 0 ? '+' : ''}${formatCurrency(pnl)}` : '—'}
                        {pnlPct != null && <span className="text-xs opacity-60 ml-1">({formatPercent(pnlPct)})</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs">
                        <span className={t.tradingMode === 'LIVE' ? 'text-btc' : 'text-muted-foreground'}>{t.tradingMode}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          t.status === 'OPEN' ? 'bg-profit/15 text-profit' : 'bg-secondary text-muted-foreground'
                        }`}>{t.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {format(new Date(t.openedAt), 'MM/dd HH:mm')}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {t.closedAt ? format(new Date(t.closedAt), 'MM/dd HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {t.status === 'OPEN' && (
                          <button
                            onClick={() => closeTrade(t.id)}
                            className="p-1 rounded hover:bg-loss/20 text-muted-foreground hover:text-loss transition"
                            title="Close trade"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-40 transition"
          >
            Prev
          </button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm rounded-lg bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-40 transition"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
