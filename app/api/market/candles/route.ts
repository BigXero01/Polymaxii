import { NextRequest } from 'next/server'
import { getCachedCandles } from '@/lib/binance'
import { apiError, apiSuccess } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const interval = searchParams.get('interval') ?? '15m'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '200', 10), 500)

  const allowedIntervals = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d']
  if (!allowedIntervals.includes(interval)) {
    return apiError('Invalid interval')
  }

  try {
    const candles = await getCachedCandles('BTCUSDT', interval, limit)
    return apiSuccess(candles)
  } catch (err) {
    console.error('[Market/Candles]', err)
    return apiError('Failed to fetch candles', 500)
  }
}
