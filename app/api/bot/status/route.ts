import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getBotStatusData, runPredictionCycle, monitorOpenTrades } from '@/lib/trader'
import { apiError, apiSuccess } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return apiError('Unauthorized', 401)
  const userId = (session.user as any).id

  const status = await getBotStatusData(userId)
  return apiSuccess(status)
}

// POST — manually trigger a prediction cycle
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return apiError('Unauthorized', 401)
  const userId = (session.user as any).id

  const body = await req.json().catch(() => ({}))
  const action = body.action

  if (action === 'trigger_prediction') {
    const prediction = await runPredictionCycle(userId)
    return apiSuccess({ prediction })
  }

  if (action === 'monitor_trades') {
    await monitorOpenTrades(userId)
    return apiSuccess({ message: 'Trade monitoring cycle complete' })
  }

  return apiError('Unknown action')
}
