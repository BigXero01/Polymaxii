import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getCachedCandles } from '@/lib/binance'
import { getPrediction } from '@/lib/predictor'
import { redis } from '@/lib/redis'
import db from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// GET /api/predictions — get latest prediction for authenticated user
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return apiError('Unauthorized', 401)
  const userId = (session.user as any).id

  const { searchParams } = req.nextUrl
  const type = searchParams.get('type') ?? 'latest'

  if (type === 'history') {
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
    const skip = (page - 1) * limit

    const [predictions, total] = await Promise.all([
      db.prediction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.prediction.count({ where: { userId } }),
    ])
    return apiSuccess({ predictions, total, page, limit })
  }

  // Latest prediction
  try {
    const cached = await redis.get(`prediction:${userId}:latest`)
    if (cached) {
      const prediction = JSON.parse(cached)
      return apiSuccess({ prediction, fromCache: true })
    }
  } catch {}

  // Generate fresh prediction
  try {
    const candles = await getCachedCandles('BTCUSDT', '15m', 200)
    const prediction = await getPrediction(candles)

    // Persist
    await db.prediction.create({
      data: {
        userId,
        direction: prediction.direction as 'UP' | 'DOWN' | 'NEUTRAL',
        confidence: prediction.confidence,
        entryPrice: prediction.entryPrice,
        targetPrice: prediction.targetPrice,
        stopPrice: prediction.stopPrice,
        signals: prediction.signals as object,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    })

    await redis.setex(`prediction:${userId}:latest`, 900, JSON.stringify(prediction))

    return apiSuccess({ prediction, fromCache: false })
  } catch (err) {
    console.error('[Predictions GET]', err)
    return apiError('Failed to generate prediction', 500)
  }
}

// POST /api/predictions — manually trigger a new prediction
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return apiError('Unauthorized', 401)
  const userId = (session.user as any).id

  try {
    const candles = await getCachedCandles('BTCUSDT', '15m', 200)
    const prediction = await getPrediction(candles)

    const record = await db.prediction.create({
      data: {
        userId,
        direction: prediction.direction as 'UP' | 'DOWN' | 'NEUTRAL',
        confidence: prediction.confidence,
        entryPrice: prediction.entryPrice,
        targetPrice: prediction.targetPrice,
        stopPrice: prediction.stopPrice,
        signals: prediction.signals as object,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    })

    await redis.setex(`prediction:${userId}:latest`, 900, JSON.stringify(prediction))

    return apiSuccess({ prediction, id: record.id })
  } catch (err) {
    console.error('[Predictions POST]', err)
    return apiError('Failed to generate prediction', 500)
  }
}
