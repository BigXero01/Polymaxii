import { NextRequest } from 'next/server'
import { getCachedTicker } from '@/lib/binance'
import { apiError, apiSuccess } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const ticker = await getCachedTicker()
    return apiSuccess(ticker)
  } catch (err) {
    console.error('[Market/Price]', err)
    return apiError('Failed to fetch price', 500)
  }
}
