'use client'

import { useState, useEffect, useCallback } from 'react'
import { PredictionResult, TechnicalSignal } from '@/types'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  userId: string
}

export default function PredictionCard({ userId }: Props) {
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchPrediction = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/predictions')
      const data = await res.json()
      if (data.success) {
        setPrediction(data.data.prediction)
        setLastUpdated(new Date())
      }
    } catch {
      toast.error('Failed to fetch prediction')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPrediction()
    // Refresh every 15 minutes
    const interval = setInterval(fetchPrediction, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchPrediction])

  const dirIcon = prediction?.direction === 'UP'
    ? <TrendingUp className="w-5 h-5" />
    : prediction?.direction === 'DOWN'
    ? <TrendingDown className="w-5 h-5" />
    : <Minus className="w-5 h-5" />

  const dirColor = prediction?.direction === 'UP'
    ? 'text-profit border-profit/30 bg-profit/10'
    : prediction?.direction === 'DOWN'
    ? 'text-loss border-loss/30 bg-loss/10'
    : 'text-muted-foreground border-border bg-secondary'

  const confidence = prediction?.confidence ?? 0

  return (
    <div className="card-glass rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">AI Prediction · 15m</h3>
        <button
          onClick={fetchPrediction}
          disabled={loading}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {prediction ? (
        <>
          {/* Direction Badge */}
          <div className={`flex items-center gap-2 p-3 rounded-lg border ${dirColor}`}>
            {dirIcon}
            <div>
              <p className="font-bold text-lg leading-none">{prediction.direction}</p>
              <p className="text-xs opacity-70 mt-0.5">Next 15 minutes</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold mono">{confidence.toFixed(0)}%</p>
              <p className="text-xs opacity-70">confidence</p>
            </div>
          </div>

          {/* Confidence Bar */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Signal strength</span>
              <span>{confidence.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  prediction.direction === 'UP' ? 'bg-profit' :
                  prediction.direction === 'DOWN' ? 'bg-loss' : 'bg-muted-foreground'
                }`}
                style={{ width: `${confidence}%` }}
              />
            </div>
          </div>

          {/* Price Targets */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-secondary rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Entry</p>
              <p className="text-sm font-semibold mono">{formatCurrency(prediction.entryPrice, 'USD', 0)}</p>
            </div>
            <div className="bg-profit/10 border border-profit/20 rounded-lg p-2">
              <p className="text-xs text-profit">Target</p>
              <p className="text-sm font-semibold mono text-profit">{formatCurrency(prediction.targetPrice, 'USD', 0)}</p>
            </div>
            <div className="bg-loss/10 border border-loss/20 rounded-lg p-2">
              <p className="text-xs text-loss">Stop</p>
              <p className="text-sm font-semibold mono text-loss">{formatCurrency(prediction.stopPrice, 'USD', 0)}</p>
            </div>
          </div>

          {/* Signal Breakdown */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Signal breakdown</p>
            <div className="space-y-1.5">
              {prediction.signals.slice(0, 5).map((sig: TechnicalSignal) => (
                <SignalRow key={sig.name} signal={sig} />
              ))}
            </div>
          </div>

          {lastUpdated && (
            <p className="text-xs text-muted-foreground/50 text-center">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </>
      ) : loading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-8 bg-secondary animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
          <AlertCircle className="w-8 h-8 opacity-40" />
          <p className="text-sm">No prediction available</p>
        </div>
      )}
    </div>
  )
}

function SignalRow({ signal }: { signal: TechnicalSignal }) {
  const isPositive = signal.score > 0
  const width = Math.abs(signal.score)

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-24 truncate">{signal.name}</span>
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden relative">
        <div
          className={`absolute top-0 h-full rounded-full ${isPositive ? 'bg-profit left-1/2' : 'bg-loss right-1/2'}`}
          style={{ width: `${width / 2}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-px h-full bg-border/50" />
        </div>
      </div>
      <span className={`text-xs font-medium mono w-12 text-right ${
        signal.signal === 'BUY' ? 'text-profit' : signal.signal === 'SELL' ? 'text-loss' : 'text-muted-foreground'
      }`}>
        {signal.signal}
      </span>
    </div>
  )
}
