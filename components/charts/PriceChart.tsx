'use client'

import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, CrosshairMode, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts'
import { Candle } from '@/types'
import { formatCurrency } from '@/lib/utils'

type Interval = '5m' | '15m' | '1h' | '4h' | '1d'

const INTERVALS: { label: string; value: Interval }[] = [
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
]

export default function PriceChart() {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const [interval, setInterval] = useState<Interval>('15m')
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'hsl(215 20% 55%)',
      },
      grid: {
        vertLines: { color: 'hsl(217 32% 12%)' },
        horzLines: { color: 'hsl(217 32% 12%)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'hsl(217 32% 14%)' },
      timeScale: {
        borderColor: 'hsl(217 32% 14%)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: { mouseWheel: true, pinch: true },
    })

    chartRef.current = chart

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00c896',
      downColor: '#ff4d4d',
      borderUpColor: '#00c896',
      borderDownColor: '#ff4d4d',
      wickUpColor: '#00c896',
      wickDownColor: '#ff4d4d',
    })
    candleSeriesRef.current = candleSeries

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })
    volumeSeriesRef.current = volumeSeries

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [])

  useEffect(() => {
    loadCandles()
  }, [interval])

  async function loadCandles() {
    setLoading(true)
    try {
      const res = await fetch(`/api/market/candles?interval=${interval}&limit=300`)
      const data = await res.json()
      if (!data.success) return

      const candles: Candle[] = data.data
      const tvCandles: CandlestickData[] = candles.map(c => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
      const volumeData = candles.map(c => ({
        time: c.time as Time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(0,200,150,0.3)' : 'rgba(255,77,77,0.3)',
      }))

      candleSeriesRef.current?.setData(tvCandles)
      volumeSeriesRef.current?.setData(volumeData)
      chartRef.current?.timeScale().fitContent()

      const lastCandle = candles[candles.length - 1]
      if (lastCandle) setCurrentPrice(lastCandle.close)
    } catch (err) {
      console.error('[PriceChart] Load error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Live price update via SSE
  useEffect(() => {
    const source = new EventSource('/api/market/stream')
    source.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'ticker' && msg.data.price) {
          setCurrentPrice(msg.data.price)
        }
      } catch {}
    }
    return () => source.close()
  }, [])

  return (
    <div className="card-glass rounded-xl overflow-hidden">
      {/* Chart Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-3">
          <span className="font-semibold">BTC/USDT</span>
          {currentPrice && (
            <span className="text-lg font-bold mono text-btc">
              {formatCurrency(currentPrice)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {INTERVALS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setInterval(value)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                interval === value
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <div ref={containerRef} className="w-full h-[400px]" />
      </div>
    </div>
  )
}
