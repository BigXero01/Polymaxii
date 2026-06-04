import { Candle, PredictionResult, TechnicalSignal } from '@/types'
import {
  closes, highs, lows, volumes,
  ema, rsi, macd, bollingerBands, atr,
  stochastic, obv, vwap, williamsR, cci,
  detectPatterns,
} from './indicators'

const SIGNAL_WEIGHTS = {
  rsi: 0.12,
  macd: 0.18,
  emaCross: 0.15,
  bollinger: 0.10,
  stochastic: 0.10,
  williamsR: 0.08,
  cci: 0.07,
  obv: 0.08,
  vwap: 0.07,
  patterns: 0.05,
}

function last<T>(arr: T[]): T {
  return arr[arr.length - 1]
}

function secondLast<T>(arr: T[]): T {
  return arr[arr.length - 2]
}

function isValid(v: number | undefined | null): v is number {
  return v !== undefined && v !== null && !isNaN(v) && isFinite(v)
}

function normalizeScore(raw: number, min: number, max: number): number {
  // Normalize to -100..+100
  return Math.max(-100, Math.min(100, ((raw - min) / (max - min)) * 200 - 100))
}

export function generatePrediction(candles: Candle[]): PredictionResult {
  if (candles.length < 50) throw new Error('Need at least 50 candles')

  const close = closes(candles)
  const high = highs(candles)
  const low = lows(candles)
  const vol = volumes(candles)
  const currentPrice = last(close)
  const signals: TechnicalSignal[] = []

  // ─── RSI ────────────────────────────────────────────────────────────────────
  const rsiValues = rsi(close, 14)
  const rsiNow = last(rsiValues)
  const rsiPrev = secondLast(rsiValues)
  let rsiScore = 0
  let rsiSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL'
  if (isValid(rsiNow)) {
    if (rsiNow < 30) { rsiScore = 100; rsiSignal = 'BUY' }
    else if (rsiNow < 40) { rsiScore = 60; rsiSignal = 'BUY' }
    else if (rsiNow > 70) { rsiScore = -100; rsiSignal = 'SELL' }
    else if (rsiNow > 60) { rsiScore = -60; rsiSignal = 'SELL' }
    else { rsiScore = (50 - rsiNow) * 2 }
    // Divergence boost
    if (isValid(rsiPrev) && rsiNow > rsiPrev && rsiNow < 50) rsiScore += 20
    if (isValid(rsiPrev) && rsiNow < rsiPrev && rsiNow > 50) rsiScore -= 20
    rsiScore = Math.max(-100, Math.min(100, rsiScore))
  }
  signals.push({ name: 'RSI(14)', value: rsiNow ?? 50, signal: rsiSignal, score: rsiScore, weight: SIGNAL_WEIGHTS.rsi })

  // ─── MACD ───────────────────────────────────────────────────────────────────
  const { macdLine, signalLine, histogram } = macd(close, 12, 26, 9)
  const macdNow = last(macdLine)
  const macdSig = last(signalLine)
  const histNow = last(histogram)
  const histPrev = secondLast(histogram)
  let macdScore = 0
  let macdSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL'
  if (isValid(macdNow) && isValid(macdSig) && isValid(histNow)) {
    if (macdNow > macdSig) {
      macdScore = Math.min(100, (macdNow - macdSig) / currentPrice * 100000)
      macdSignal = 'BUY'
    } else {
      macdScore = Math.max(-100, (macdNow - macdSig) / currentPrice * 100000)
      macdSignal = 'SELL'
    }
    // Histogram momentum
    if (isValid(histPrev)) {
      if (histNow > histPrev) macdScore += 15
      else macdScore -= 15
    }
    macdScore = Math.max(-100, Math.min(100, macdScore))
  }
  signals.push({ name: 'MACD(12,26,9)', value: histNow ?? 0, signal: macdSignal, score: macdScore, weight: SIGNAL_WEIGHTS.macd })

  // ─── EMA Cross (9/21) ───────────────────────────────────────────────────────
  const ema9 = ema(close, 9)
  const ema21 = ema(close, 21)
  const ema50 = ema(close, 50)
  const ema9Now = last(ema9)
  const ema21Now = last(ema21)
  const ema50Now = last(ema50)
  const ema9Prev = secondLast(ema9)
  const ema21Prev = secondLast(ema21)
  let emaScore = 0
  let emaSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL'
  if (isValid(ema9Now) && isValid(ema21Now)) {
    const diff = (ema9Now - ema21Now) / currentPrice * 100
    emaScore = Math.max(-100, Math.min(100, diff * 20))
    // Golden cross / death cross detection
    if (isValid(ema9Prev) && isValid(ema21Prev)) {
      if (ema9Prev <= ema21Prev && ema9Now > ema21Now) emaScore = 100 // golden cross
      if (ema9Prev >= ema21Prev && ema9Now < ema21Now) emaScore = -100 // death cross
    }
    // Price relative to EMA50 (trend filter)
    if (isValid(ema50Now)) {
      if (currentPrice > ema50Now && emaScore > 0) emaScore = Math.min(100, emaScore * 1.2)
      if (currentPrice < ema50Now && emaScore < 0) emaScore = Math.max(-100, emaScore * 1.2)
    }
    emaSignal = emaScore > 10 ? 'BUY' : emaScore < -10 ? 'SELL' : 'NEUTRAL'
  }
  signals.push({ name: 'EMA Cross(9/21)', value: ema9Now ?? 0, signal: emaSignal, score: emaScore, weight: SIGNAL_WEIGHTS.emaCross })

  // ─── Bollinger Bands ────────────────────────────────────────────────────────
  const { upper, middle, lower } = bollingerBands(close, 20, 2)
  const upperNow = last(upper)
  const middleNow = last(middle)
  const lowerNow = last(lower)
  let bbScore = 0
  let bbSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL'
  if (isValid(upperNow) && isValid(lowerNow) && isValid(middleNow)) {
    const bandwidth = upperNow - lowerNow
    const position = (currentPrice - lowerNow) / bandwidth  // 0..1
    bbScore = normalizeScore(1 - position, 0, 1) // inverted: lower band = buy
    // Squeeze detection (low volatility = breakout potential)
    const avgBandwidth = smaValue(close.map((_, i) =>
      isValid(upper[i]) && isValid(lower[i]) ? upper[i] - lower[i] : NaN
    ), 20)
    if (bandwidth < avgBandwidth * 0.7) {
      // Squeeze — score towards direction of momentum
      const momentum = currentPrice - close[close.length - 5]
      bbScore = momentum > 0 ? 80 : -80
    }
    bbSignal = bbScore > 20 ? 'BUY' : bbScore < -20 ? 'SELL' : 'NEUTRAL'
  }
  signals.push({ name: 'Bollinger(20,2)', value: currentPrice, signal: bbSignal, score: bbScore, weight: SIGNAL_WEIGHTS.bollinger })

  // ─── Stochastic ─────────────────────────────────────────────────────────────
  const { k: stochK, d: stochD } = stochastic(candles, 14, 3, 3)
  const kNow = last(stochK)
  const dNow = last(stochD)
  let stochScore = 0
  let stochSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL'
  if (isValid(kNow) && isValid(dNow)) {
    if (kNow < 20 && dNow < 20) { stochScore = 90; stochSignal = 'BUY' }
    else if (kNow > 80 && dNow > 80) { stochScore = -90; stochSignal = 'SELL' }
    else if (kNow > dNow && kNow < 50) { stochScore = 40; stochSignal = 'BUY' }
    else if (kNow < dNow && kNow > 50) { stochScore = -40; stochSignal = 'SELL' }
    else { stochScore = normalizeScore(50 - kNow, -50, 50) }
  }
  signals.push({ name: 'Stochastic(14,3,3)', value: kNow ?? 50, signal: stochSignal, score: stochScore, weight: SIGNAL_WEIGHTS.stochastic })

  // ─── Williams %R ────────────────────────────────────────────────────────────
  const wrValues = williamsR(candles, 14)
  const wrNow = last(wrValues)
  let wrScore = 0
  let wrSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL'
  if (isValid(wrNow)) {
    if (wrNow < -80) { wrScore = 90; wrSignal = 'BUY' }
    else if (wrNow > -20) { wrScore = -90; wrSignal = 'SELL' }
    else { wrScore = normalizeScore(-wrNow, 0, 100) - 50 }
    wrSignal = wrScore > 20 ? 'BUY' : wrScore < -20 ? 'SELL' : 'NEUTRAL'
  }
  signals.push({ name: 'Williams%R(14)', value: wrNow ?? -50, signal: wrSignal, score: wrScore, weight: SIGNAL_WEIGHTS.williamsR })

  // ─── CCI ────────────────────────────────────────────────────────────────────
  const cciValues = cci(candles, 20)
  const cciNow = last(cciValues)
  let cciScore = 0
  let cciSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL'
  if (isValid(cciNow)) {
    if (cciNow < -100) { cciScore = 80; cciSignal = 'BUY' }
    else if (cciNow > 100) { cciScore = -80; cciSignal = 'SELL' }
    else { cciScore = -cciNow }
    cciScore = Math.max(-100, Math.min(100, cciScore))
    cciSignal = cciScore > 20 ? 'BUY' : cciScore < -20 ? 'SELL' : 'NEUTRAL'
  }
  signals.push({ name: 'CCI(20)', value: cciNow ?? 0, signal: cciSignal, score: cciScore, weight: SIGNAL_WEIGHTS.cci })

  // ─── OBV Trend ──────────────────────────────────────────────────────────────
  const obvValues = obv(candles)
  const obvEma = ema(obvValues, 20)
  const obvNow = last(obvValues)
  const obvEma20 = last(obvEma)
  let obvScore = 0
  let obvSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL'
  if (isValid(obvNow) && isValid(obvEma20)) {
    const diff = (obvNow - obvEma20) / Math.abs(obvEma20) * 100
    obvScore = Math.max(-100, Math.min(100, diff * 10))
    obvSignal = obvScore > 10 ? 'BUY' : obvScore < -10 ? 'SELL' : 'NEUTRAL'
  }
  signals.push({ name: 'OBV Trend', value: obvScore, signal: obvSignal, score: obvScore, weight: SIGNAL_WEIGHTS.obv })

  // ─── VWAP ───────────────────────────────────────────────────────────────────
  const vwapValues = vwap(candles, 20)
  const vwapNow = last(vwapValues)
  let vwapScore = 0
  let vwapSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL'
  if (isValid(vwapNow)) {
    const deviation = (currentPrice - vwapNow) / vwapNow * 100
    vwapScore = Math.max(-100, Math.min(100, -deviation * 20))
    vwapSignal = vwapScore > 20 ? 'BUY' : vwapScore < -20 ? 'SELL' : 'NEUTRAL'
  }
  signals.push({ name: 'VWAP(20)', value: vwapNow ?? currentPrice, signal: vwapSignal, score: vwapScore, weight: SIGNAL_WEIGHTS.vwap })

  // ─── Candlestick Patterns ───────────────────────────────────────────────────
  const patterns = detectPatterns(candles)
  let patternScore = 0
  let patternSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL'
  if (patterns.length > 0) {
    patterns.forEach(p => {
      patternScore += p.bullish ? p.strength * 100 : -p.strength * 100
    })
    patternScore = Math.max(-100, Math.min(100, patternScore / patterns.length))
    patternSignal = patternScore > 20 ? 'BUY' : patternScore < -20 ? 'SELL' : 'NEUTRAL'
  }
  const topPattern = patterns.sort((a, b) => b.strength - a.strength)[0]
  signals.push({ name: topPattern ? topPattern.name : 'No Pattern', value: patterns.length, signal: patternSignal, score: patternScore, weight: SIGNAL_WEIGHTS.patterns })

  // ─── Composite Score ────────────────────────────────────────────────────────
  let compositeScore = 0
  let totalWeight = 0
  for (const sig of signals) {
    compositeScore += sig.score * sig.weight
    totalWeight += sig.weight
  }
  compositeScore = totalWeight > 0 ? compositeScore / totalWeight : 0

  // ─── Direction & Confidence ─────────────────────────────────────────────────
  const absScore = Math.abs(compositeScore)
  const confidence = Math.min(95, 50 + absScore * 0.45)
  const direction: 'UP' | 'DOWN' | 'NEUTRAL' =
    compositeScore > 15 ? 'UP' : compositeScore < -15 ? 'DOWN' : 'NEUTRAL'

  // ─── ATR-based targets ──────────────────────────────────────────────────────
  const atrValues = atr(candles, 14)
  const atrNow = last(atrValues)
  const atrMultiplier = isValid(atrNow) ? atrNow : currentPrice * 0.005

  const stopPrice = direction === 'UP'
    ? currentPrice - atrMultiplier * 1.5
    : currentPrice + atrMultiplier * 1.5
  const targetPrice = direction === 'UP'
    ? currentPrice + atrMultiplier * 2.5
    : currentPrice - atrMultiplier * 2.5

  return {
    direction,
    confidence,
    entryPrice: currentPrice,
    targetPrice,
    stopPrice,
    signals,
    compositeScore,
  }
}

function smaValue(data: number[], period: number): number {
  const valid = data.filter(v => !isNaN(v))
  if (valid.length < period) return valid.reduce((a, b) => a + b, 0) / valid.length || 0
  const slice = valid.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

// Optionally call external ML service for enhanced predictions
export async function getPrediction(candles: Candle[]): Promise<PredictionResult> {
  const mlUrl = process.env.ML_SERVICE_URL
  const mlEnabled = process.env.ML_SERVICE_ENABLED === 'true'

  if (mlEnabled && mlUrl) {
    try {
      const res = await fetch(`${mlUrl}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candles: candles.slice(-100) }),
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        return res.json()
      }
    } catch {
      // Fall through to built-in predictor
    }
  }
  return generatePrediction(candles)
}
