'use client'

import { useState } from 'react'
import { BotSettings } from '@prisma/client'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'

interface ApiKey {
  id: string
  label: string | null
  exchange: string
  isActive: boolean
}

interface Props {
  settings: BotSettings
  apiKeys: ApiKey[]
}

export default function SettingsPage({ settings: init, apiKeys: initKeys }: Props) {
  const [settings, setSettings] = useState(init)
  const [apiKeys, setApiKeys] = useState(initKeys)
  const [saving, setSaving] = useState(false)
  const [newKey, setNewKey] = useState({ apiKey: '', secretKey: '', label: '' })
  const [showSecret, setShowSecret] = useState(false)
  const [addingKey, setAddingKey] = useState(false)

  async function saveSettings() {
    setSaving(true)
    const res = await fetch('/api/bot/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradingMode: settings.tradingMode,
        minConfidence: settings.minConfidence,
        maxPositionSizePct: settings.maxPositionSizePct,
        stopLossPct: settings.stopLossPct,
        takeProfitPct: settings.takeProfitPct,
        maxConcurrentTrades: settings.maxConcurrentTrades,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.success) {
      setSettings(data.data)
      toast.success('Settings saved')
    } else {
      toast.error(data.error)
    }
  }

  async function addApiKey() {
    if (!newKey.apiKey || !newKey.secretKey) {
      toast.error('API key and secret are required')
      return
    }
    setAddingKey(true)
    const res = await fetch('/api/settings/apikeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newKey),
    })
    const data = await res.json()
    setAddingKey(false)
    if (data.success) {
      setApiKeys(k => [...k, data.data])
      setNewKey({ apiKey: '', secretKey: '', label: '' })
      toast.success('API key added')
    } else {
      toast.error(data.error)
    }
  }

  const slider = (
    label: string,
    key: keyof BotSettings,
    min: number,
    max: number,
    step: number,
    unit = '%',
    color = 'text-foreground'
  ) => (
    <div>
      <div className="flex justify-between mb-2">
        <label className="text-sm font-medium">{label}</label>
        <span className={`text-sm font-bold mono ${color}`}>{(settings[key] as number)}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={settings[key] as number}
        onChange={e => setSettings(s => ({ ...s, [key]: parseFloat(e.target.value) }))}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Configure trading bot behavior</p>
      </div>

      {/* Trading Mode */}
      <div className="card-glass rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Trading Mode</h2>
        <div className="grid grid-cols-2 gap-3">
          {(['PAPER', 'LIVE'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setSettings(s => ({ ...s, tradingMode: mode }))}
              className={`p-4 rounded-xl border text-left transition ${
                settings.tradingMode === mode
                  ? mode === 'LIVE'
                    ? 'border-btc/50 bg-btc/10 text-btc'
                    : 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              <p className="font-semibold">{mode}</p>
              <p className="text-xs mt-1 opacity-70">
                {mode === 'PAPER' ? 'Simulated trading with virtual funds' : 'Real trades on Binance — requires API keys'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Risk Parameters */}
      <div className="card-glass rounded-xl p-6 space-y-6">
        <h2 className="font-semibold">Risk Parameters</h2>
        {slider('Min Confidence Threshold', 'minConfidence', 50, 95, 1)}
        {slider('Max Position Size', 'maxPositionSizePct', 0.5, 20, 0.5)}
        {slider('Stop Loss', 'stopLossPct', 0.5, 10, 0.5, '%', 'text-loss')}
        {slider('Take Profit', 'takeProfitPct', 0.5, 20, 0.5, '%', 'text-profit')}
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium">Max Concurrent Trades</label>
            <span className="text-sm font-bold mono">{settings.maxConcurrentTrades}</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={settings.maxConcurrentTrades}
            onChange={e => setSettings(s => ({ ...s, maxConcurrentTrades: parseInt(e.target.value) }))}
            className="w-full accent-primary"
          />
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:bg-primary/90 transition disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      {/* Exchange API Keys */}
      <div className="card-glass rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Binance API Keys</h2>
        <p className="text-xs text-muted-foreground">Required for live trading. Use read + trade permissions. Never enable withdrawal permissions.</p>

        {apiKeys.length > 0 && (
          <div className="space-y-2">
            {apiKeys.map(k => (
              <div key={k.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <div>
                  <p className="text-sm font-medium">{k.label ?? k.exchange}</p>
                  <p className="text-xs text-muted-foreground">
                    {k.exchange} · {k.isActive ? <span className="text-profit">Active</span> : 'Inactive'}
                  </p>
                </div>
                <button className="p-1.5 text-muted-foreground hover:text-loss transition">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <input
            placeholder="Label (e.g. Main account)"
            value={newKey.label}
            onChange={e => setNewKey(k => ({ ...k, label: e.target.value }))}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary/50 transition"
          />
          <input
            placeholder="API Key"
            value={newKey.apiKey}
            onChange={e => setNewKey(k => ({ ...k, apiKey: e.target.value }))}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-primary/50 transition"
          />
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              placeholder="Secret Key"
              value={newKey.secretKey}
              onChange={e => setNewKey(k => ({ ...k, secretKey: e.target.value }))}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 pr-10 text-sm font-mono outline-none focus:border-primary/50 transition"
            />
            <button
              type="button"
              onClick={() => setShowSecret(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={addApiKey}
            disabled={addingKey}
            className="w-full flex items-center justify-center gap-2 bg-secondary border border-border hover:bg-accent text-sm font-medium py-2.5 rounded-lg transition disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            {addingKey ? 'Adding…' : 'Add API Key'}
          </button>
        </div>
      </div>
    </div>
  )
}
