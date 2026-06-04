import { Candle } from '@/types'

// Utility: extract close prices from candles
export function closes(candles: Candle[]): number[] {
  return candles.map(c => c.close)
}

export function highs(candles: Candle[]): number[] {
  return candles.map(c => c.high)
}

export function lows(candles: Candle[]): number[] {
  return candles.map(c => c.low)
}

export function volumes(candles: Candle[]): number[] {
  return candles.map(c => c.volume)
}

// Simple Moving Average
export function sma(data: number[], period: number): number[] {
  const result: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(NaN); continue }
    const slice = data.slice(i - period + 1, i + 1)
    result.push(slice.reduce((a, b) => a + b, 0) / period)
  }
  return result
}

// Exponential Moving Average
export function ema(data: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(NaN); continue }
    if (i === period - 1) {
      result.push(data.slice(0, period).reduce((a, b) => a + b, 0) / period)
      continue
    }
    result.push(data[i] * k + result[result.length - 1] * (1 - k))
  }
  return result
}

// RSI
export function rsi(data: number[], period = 14): number[] {
  const result: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period) { result.push(NaN); continue }
    const changes = data.slice(i - period + 1, i + 1).map((v, j, a) => j === 0 ? 0 : v - a[j - 1])
    const gains = changes.filter(c => c > 0).reduce((a, b) => a + b, 0) / period
    const losses = Math.abs(changes.filter(c => c < 0).reduce((a, b) => a + b, 0)) / period
    if (losses === 0) { result.push(100); continue }
    const rs = gains / losses
    result.push(100 - (100 / (1 + rs)))
  }
  return result
}

// MACD
export function macd(
  data: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
  const fastEma = ema(data, fastPeriod)
  const slowEma = ema(data, slowPeriod)
  const macdLine = fastEma.map((f, i) => (isNaN(f) || isNaN(slowEma[i])) ? NaN : f - slowEma[i])
  const validMacd = macdLine.filter(v => !isNaN(v))
  const rawSignal = ema(validMacd, signalPeriod)
  const signalLine: number[] = []
  let si = 0
  for (let i = 0; i < macdLine.length; i++) {
    if (isNaN(macdLine[i])) { signalLine.push(NaN); continue }
    signalLine.push(rawSignal[si++] ?? NaN)
  }
  const histogram = macdLine.map((m, i) =>
    isNaN(m) || isNaN(signalLine[i]) ? NaN : m - signalLine[i]
  )
  return { macdLine, signalLine, histogram }
}

// Bollinger Bands
export function bollingerBands(
  data: number[],
  period = 20,
  stdDevMultiplier = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(data, period)
  const upper: number[] = []
  const lower: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (isNaN(middle[i])) { upper.push(NaN); lower.push(NaN); continue }
    const slice = data.slice(i - period + 1, i + 1)
    const mean = middle[i]
    const variance = slice.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / period
    const std = Math.sqrt(variance)
    upper.push(mean + stdDevMultiplier * std)
    lower.push(mean - stdDevMultiplier * std)
  }
  return { upper, middle, lower }
}

// Average True Range
export function atr(candles: Candle[], period = 14): number[] {
  const trueRanges: number[] = []
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) { trueRanges.push(candles[i].high - candles[i].low); continue }
    const prevClose = candles[i - 1].close
    trueRanges.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prevClose),
      Math.abs(candles[i].low - prevClose)
    ))
  }
  return sma(trueRanges, period)
}

// Stochastic Oscillator
export function stochastic(
  candles: Candle[],
  period = 14,
  smoothK = 3,
  smoothD = 3
): { k: number[]; d: number[] } {
  const rawK: number[] = []
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) { rawK.push(NaN); continue }
    const slice = candles.slice(i - period + 1, i + 1)
    const highest = Math.max(...slice.map(c => c.high))
    const lowest = Math.min(...slice.map(c => c.low))
    rawK.push(highest === lowest ? 50 : ((candles[i].close - lowest) / (highest - lowest)) * 100)
  }
  const k = sma(rawK.filter(v => !isNaN(v)), smoothK)
  // Re-pad with NaNs
  const kPadded: number[] = Array(rawK.length - k.length).fill(NaN).concat(k)
  const d = sma(k.filter(v => !isNaN(v)), smoothD)
  const dPadded: number[] = Array(kPadded.length - d.length).fill(NaN).concat(d)
  return { k: kPadded, d: dPadded }
}

// On-Balance Volume
export function obv(candles: Candle[]): number[] {
  const result: number[] = [0]
  for (let i = 1; i < candles.length; i++) {
    const prev = result[i - 1]
    if (candles[i].close > candles[i - 1].close) {
      result.push(prev + candles[i].volume)
    } else if (candles[i].close < candles[i - 1].close) {
      result.push(prev - candles[i].volume)
    } else {
      result.push(prev)
    }
  }
  return result
}

// Volume Weighted Average Price (rolling)
export function vwap(candles: Candle[], period = 20): number[] {
  const result: number[] = []
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) { result.push(NaN); continue }
    const slice = candles.slice(i - period + 1, i + 1)
    const totalVol = slice.reduce((a, c) => a + c.volume, 0)
    const typicalPriceVol = slice.reduce((a, c) => a + ((c.high + c.low + c.close) / 3) * c.volume, 0)
    result.push(totalVol === 0 ? NaN : typicalPriceVol / totalVol)
  }
  return result
}

// Williams %R
export function williamsR(candles: Candle[], period = 14): number[] {
  const result: number[] = []
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) { result.push(NaN); continue }
    const slice = candles.slice(i - period + 1, i + 1)
    const highest = Math.max(...slice.map(c => c.high))
    const lowest = Math.min(...slice.map(c => c.low))
    result.push(highest === lowest ? -50 : ((highest - candles[i].close) / (highest - lowest)) * -100)
  }
  return result
}

// Commodity Channel Index
export function cci(candles: Candle[], period = 20): number[] {
  const result: number[] = []
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) { result.push(NaN); continue }
    const slice = candles.slice(i - period + 1, i + 1)
    const typicalPrices = slice.map(c => (c.high + c.low + c.close) / 3)
    const tp = typicalPrices[typicalPrices.length - 1]
    const mean = typicalPrices.reduce((a, b) => a + b, 0) / period
    const meanDev = typicalPrices.reduce((a, b) => a + Math.abs(b - mean), 0) / period
    result.push(meanDev === 0 ? 0 : (tp - mean) / (0.015 * meanDev))
  }
  return result
}

// Detect candlestick patterns
export interface CandlePattern {
  name: string
  bullish: boolean
  strength: number // 0-1
}

export function detectPatterns(candles: Candle[]): CandlePattern[] {
  const patterns: CandlePattern[] = []
  const len = candles.length
  if (len < 3) return patterns

  const c0 = candles[len - 1]
  const c1 = candles[len - 2]
  const c2 = candles[len - 3]

  const body0 = Math.abs(c0.close - c0.open)
  const body1 = Math.abs(c1.close - c1.open)
  const range0 = c0.high - c0.low

  // Doji
  if (body0 < range0 * 0.1) {
    patterns.push({ name: 'Doji', bullish: false, strength: 0.3 })
  }

  // Hammer / Inverted Hammer
  const lowerWick0 = Math.min(c0.open, c0.close) - c0.low
  const upperWick0 = c0.high - Math.max(c0.open, c0.close)
  if (lowerWick0 > body0 * 2 && upperWick0 < body0 * 0.5 && c1.close < c1.open) {
    patterns.push({ name: 'Hammer', bullish: true, strength: 0.7 })
  }

  // Shooting Star
  if (upperWick0 > body0 * 2 && lowerWick0 < body0 * 0.5 && c1.close > c1.open) {
    patterns.push({ name: 'ShootingStar', bullish: false, strength: 0.7 })
  }

  // Bullish Engulfing
  if (c1.close < c1.open && c0.close > c0.open && c0.open < c1.close && c0.close > c1.open) {
    patterns.push({ name: 'BullishEngulfing', bullish: true, strength: 0.8 })
  }

  // Bearish Engulfing
  if (c1.close > c1.open && c0.close < c0.open && c0.open > c1.close && c0.close < c1.open) {
    patterns.push({ name: 'BearishEngulfing', bullish: false, strength: 0.8 })
  }

  // Morning Star
  if (c2.close < c2.open && body1 < Math.abs(c2.close - c2.open) * 0.3 && c0.close > c0.open && c0.close > (c2.open + c2.close) / 2) {
    patterns.push({ name: 'MorningStar', bullish: true, strength: 0.9 })
  }

  // Evening Star
  if (c2.close > c2.open && body1 < Math.abs(c2.close - c2.open) * 0.3 && c0.close < c0.open && c0.close < (c2.open + c2.close) / 2) {
    patterns.push({ name: 'EveningStar', bullish: false, strength: 0.9 })
  }

  return patterns
}
