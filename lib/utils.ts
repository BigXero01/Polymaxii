import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'USD', decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

export function formatBTC(amount: number, decimals = 6): string {
  return `₿${amount.toFixed(decimals)}`
}

export function formatPercent(value: number, decimals = 2): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatLargeNumber(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`
  return value.toFixed(2)
}

export function btcToSats(btc: number): number {
  return Math.round(btc * 1e8)
}

export function satsToBtc(sats: number): number {
  return sats / 1e8
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

export function calculatePnl(
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  exitPrice: number,
  quantity: number
): { pnl: number; pnlPct: number } {
  const priceDiff = side === 'LONG' ? exitPrice - entryPrice : entryPrice - exitPrice
  const pnl = priceDiff * quantity
  const pnlPct = (priceDiff / entryPrice) * 100
  return { pnl, pnlPct }
}

export function calculateSharpe(returns: number[], riskFreeRate = 0): number {
  if (returns.length < 2) return 0
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((acc, r) => acc + Math.pow(r - avg, 2), 0) / returns.length
  const stdDev = Math.sqrt(variance)
  if (stdDev === 0) return 0
  return ((avg - riskFreeRate) / stdDev) * Math.sqrt(365)
}

export function getTimeUntilNextInterval(intervalMinutes: number): number {
  const now = Date.now()
  const intervalMs = intervalMinutes * 60 * 1000
  return intervalMs - (now % intervalMs)
}

export function apiError(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status })
}

export function apiSuccess<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status })
}
