import { Candle, BTCTicker } from '@/types'
import { redis, KEYS } from './redis'

const BASE_URL = process.env.BINANCE_BASE_URL ?? 'https://api.binance.com'

interface BinanceKline {
  0: number   // open time
  1: string   // open
  2: string   // high
  3: string   // low
  4: string   // close
  5: string   // volume
  6: number   // close time
  8: number   // number of trades
}

interface Binance24hTicker {
  symbol: string
  lastPrice: string
  priceChange: string
  priceChangePercent: string
  volume: string
  highPrice: string
  lowPrice: string
}

async function binanceFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  const res = await fetch(url.toString(), { next: { revalidate: 0 } })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Binance API ${res.status}: ${text}`)
  }
  return res.json()
}

export async function getBTCTicker(symbol = 'BTCUSDT'): Promise<BTCTicker> {
  const data = await binanceFetch<Binance24hTicker>('/api/v3/ticker/24hr', { symbol })
  return {
    symbol: data.symbol,
    price: parseFloat(data.lastPrice),
    change24h: parseFloat(data.priceChange),
    changePct24h: parseFloat(data.priceChangePercent),
    volume24h: parseFloat(data.volume),
    high24h: parseFloat(data.highPrice),
    low24h: parseFloat(data.lowPrice),
    timestamp: Date.now(),
  }
}

export async function getCandles(
  symbol = 'BTCUSDT',
  interval = '15m',
  limit = 200
): Promise<Candle[]> {
  const data = await binanceFetch<BinanceKline[]>('/api/v3/klines', {
    symbol,
    interval,
    limit: String(limit),
  })
  return data.map((k) => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }))
}

export async function getCurrentPrice(symbol = 'BTCUSDT'): Promise<number> {
  const data = await binanceFetch<{ price: string }>('/api/v3/ticker/price', { symbol })
  return parseFloat(data.price)
}

export async function getCachedTicker(symbol = 'BTCUSDT'): Promise<BTCTicker> {
  try {
    const cached = await redis.get(KEYS.btcTicker)
    if (cached) return JSON.parse(cached)
  } catch {}
  const ticker = await getBTCTicker(symbol)
  try {
    await redis.setex(KEYS.btcTicker, 5, JSON.stringify(ticker))
  } catch {}
  return ticker
}

export async function getCachedCandles(
  symbol = 'BTCUSDT',
  interval = '15m',
  limit = 200
): Promise<Candle[]> {
  const key = KEYS.candles(interval)
  try {
    const cached = await redis.get(key)
    if (cached) return JSON.parse(cached)
  } catch {}
  const candles = await getCandles(symbol, interval, limit)
  try {
    // Cache for 30 seconds (candles don't change that fast)
    await redis.setex(key, 30, JSON.stringify(candles))
  } catch {}
  return candles
}

// Signed request for trading endpoints
export async function binanceSignedRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params: Record<string, string>,
  apiKey: string,
  secretKey: string
): Promise<T> {
  const crypto = await import('crypto')
  const timestamp = Date.now().toString()
  const allParams = { ...params, timestamp }
  const query = new URLSearchParams(allParams).toString()
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(query)
    .digest('hex')

  const url = `${BASE_URL}${path}?${query}&signature=${signature}`
  const res = await fetch(url, {
    method,
    headers: { 'X-MBX-APIKEY': apiKey },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Binance signed ${res.status}: ${text}`)
  }
  return res.json()
}

export interface BinanceOrderResult {
  orderId: number
  symbol: string
  status: string
  executedQty: string
  cummulativeQuoteQty: string
  fills?: { price: string; qty: string; commission: string }[]
}

export async function placeBinanceOrder(
  apiKey: string,
  secretKey: string,
  symbol: string,
  side: 'BUY' | 'SELL',
  quantity: string,
  type: 'MARKET' | 'LIMIT' = 'MARKET',
  price?: string
): Promise<BinanceOrderResult> {
  const params: Record<string, string> = { symbol, side, type, quantity }
  if (type === 'LIMIT' && price) {
    params.price = price
    params.timeInForce = 'GTC'
  }
  return binanceSignedRequest<BinanceOrderResult>(
    'POST',
    '/api/v3/order',
    params,
    apiKey,
    secretKey
  )
}

export async function cancelBinanceOrder(
  apiKey: string,
  secretKey: string,
  symbol: string,
  orderId: number
): Promise<void> {
  await binanceSignedRequest(
    'DELETE',
    '/api/v3/order',
    { symbol, orderId: String(orderId) },
    apiKey,
    secretKey
  )
}

export async function getBinanceAccountBalance(
  apiKey: string,
  secretKey: string
): Promise<{ asset: string; free: string; locked: string }[]> {
  const data = await binanceSignedRequest<{ balances: { asset: string; free: string; locked: string }[] }>(
    'GET',
    '/api/v3/account',
    {},
    apiKey,
    secretKey
  )
  return data.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
}
