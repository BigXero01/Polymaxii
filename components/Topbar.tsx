'use client'

import { signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { BTCTicker } from '@/types'
import { LogOut, TrendingUp, TrendingDown } from 'lucide-react'

interface TopbarProps {
  user: { name?: string | null; email?: string | null }
}

export default function Topbar({ user }: TopbarProps) {
  const [ticker, setTicker] = useState<BTCTicker | null>(null)

  useEffect(() => {
    const source = new EventSource('/api/market/stream')
    source.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'ticker') setTicker(msg.data)
      } catch {}
    }
    return () => source.close()
  }, [])

  const priceUp = (ticker?.changePct24h ?? 0) >= 0

  return (
    <header className="flex-shrink-0 h-14 flex items-center justify-between px-6 border-b border-border/50 bg-card/50 backdrop-blur-sm">
      {/* BTC Price Ticker */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-btc font-bold text-sm mono">BTC/USDT</span>
          {ticker ? (
            <>
              <span className="font-bold text-lg mono">
                {formatCurrency(ticker.price, 'USD', 2)}
              </span>
              <span className={`flex items-center gap-0.5 text-sm font-medium ${priceUp ? 'text-profit' : 'text-loss'}`}>
                {priceUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {priceUp ? '+' : ''}{ticker.changePct24h.toFixed(2)}%
              </span>
            </>
          ) : (
            <div className="h-5 w-32 bg-secondary animate-pulse rounded" />
          )}
        </div>

        {ticker && (
          <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
            <span>H: {formatCurrency(ticker.high24h, 'USD', 0)}</span>
            <span>L: {formatCurrency(ticker.low24h, 'USD', 0)}</span>
            <span>Vol: {(ticker.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 })} BTC</span>
          </div>
        )}
      </div>

      {/* User Menu */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right">
          <p className="text-sm font-medium">{user.name ?? user.email?.split('@')[0]}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
