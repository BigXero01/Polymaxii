'use client'

import { useState } from 'react'
import { BotSettings } from '@prisma/client'
import { Bot, Power, Settings2, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Props {
  settings: BotSettings
}

export default function TradingBot({ settings: initialSettings }: Props) {
  const [settings, setSettings] = useState(initialSettings)
  const [toggling, setToggling] = useState(false)

  async function toggleBot() {
    setToggling(true)
    try {
      const res = await fetch('/api/bot/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !settings.isActive }),
      })
      const data = await res.json()
      if (data.success) {
        setSettings(data.data)
        toast.success(data.data.isActive ? 'Bot activated' : 'Bot deactivated')
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('Failed to toggle bot')
    } finally {
      setToggling(false)
    }
  }

  async function triggerPrediction() {
    try {
      const res = await fetch('/api/bot/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger_prediction' }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Prediction cycle triggered')
      }
    } catch {
      toast.error('Failed to trigger prediction')
    }
  }

  return (
    <div className="card-glass rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Trading Bot</h3>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
          settings.tradingMode === 'LIVE'
            ? 'text-btc border-btc/30 bg-btc/10'
            : 'text-muted-foreground border-border bg-secondary'
        }`}>
          {settings.tradingMode}
        </span>
      </div>

      {/* Status Toggle */}
      <button
        onClick={toggleBot}
        disabled={toggling}
        className={`w-full flex items-center justify-between p-3 rounded-lg border transition ${
          settings.isActive
            ? 'bg-profit/10 border-profit/30 text-profit'
            : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
        }`}
      >
        <div className="flex items-center gap-2">
          <Power className={`w-4 h-4 ${toggling ? 'animate-pulse' : ''}`} />
          <span className="font-medium text-sm">
            {toggling ? 'Updating…' : settings.isActive ? 'Bot Active' : 'Bot Inactive'}
          </span>
        </div>
        <div className={`w-10 h-5 rounded-full border transition-colors ${
          settings.isActive ? 'bg-profit border-profit/50' : 'bg-secondary border-border'
        }`}>
          <div className={`w-3.5 h-3.5 rounded-full bg-white mt-[3px] transition-transform ${
            settings.isActive ? 'translate-x-[22px]' : 'translate-x-[3px]'
          }`} />
        </div>
      </button>

      {/* Config Summary */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-secondary rounded-lg p-2">
          <p className="text-muted-foreground">Min confidence</p>
          <p className="font-semibold mono">{settings.minConfidence}%</p>
        </div>
        <div className="bg-secondary rounded-lg p-2">
          <p className="text-muted-foreground">Max position</p>
          <p className="font-semibold mono">{settings.maxPositionSizePct}%</p>
        </div>
        <div className="bg-secondary rounded-lg p-2">
          <p className="text-muted-foreground">Stop loss</p>
          <p className="font-semibold mono text-loss">{settings.stopLossPct}%</p>
        </div>
        <div className="bg-secondary rounded-lg p-2">
          <p className="text-muted-foreground">Take profit</p>
          <p className="font-semibold mono text-profit">{settings.takeProfitPct}%</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={triggerPrediction}
          className="flex-1 text-xs py-2 px-3 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition font-medium"
        >
          Run Prediction
        </button>
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-1 text-xs py-2 px-3 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition font-medium"
        >
          <Settings2 className="w-3 h-3" />
          Configure
        </Link>
      </div>
    </div>
  )
}
