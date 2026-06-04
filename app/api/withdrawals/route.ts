import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import {
  validateBTCAddress,
  estimateWithdrawalFee,
  buildAndBroadcastWithdrawal,
  fetchCurrentFeeRate,
} from '@/lib/bitcoin'
import { btcToSats, satsToBtc } from '@/lib/utils'
import db from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/utils'

const MIN_BTC = satsToBtc(parseInt(process.env.BTC_MIN_WITHDRAWAL_SATS ?? '50000', 10))

export const dynamic = 'force-dynamic'

const withdrawalSchema = z.object({
  amountBtc: z.number().positive(),
  btcAddress: z.string().min(25).max(90),
})

// GET /api/withdrawals — list user withdrawals or get fee estimate
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return apiError('Unauthorized', 401)
  const userId = (session.user as any).id

  const { searchParams } = req.nextUrl
  const amountBtc = parseFloat(searchParams.get('amountBtc') ?? '0')

  if (amountBtc > 0) {
    // Fee estimate request
    const { fastest } = await fetchCurrentFeeRate()
    const estimate = estimateWithdrawalFee(amountBtc, fastest)
    const btcPrice = (await import('@/lib/binance').then(m => m.getCurrentPrice()))
    return apiSuccess({
      ...estimate,
      feeUsd: estimate.feeBtc * btcPrice,
      feeRateSatVbyte: fastest,
    })
  }

  const withdrawals = await db.withdrawal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return apiSuccess(withdrawals)
}

// POST /api/withdrawals — submit withdrawal
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return apiError('Unauthorized', 401)
  const userId = (session.user as any).id

  const body = await req.json().catch(() => ({}))
  const parsed = withdrawalSchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.errors[0].message)

  const { amountBtc, btcAddress } = parsed.data

  if (amountBtc < MIN_BTC) {
    return apiError(`Minimum withdrawal is ${MIN_BTC} BTC`)
  }

  if (!validateBTCAddress(btcAddress)) {
    return apiError('Invalid Bitcoin address')
  }

  // Check balance
  const portfolio = await db.portfolio.findUnique({ where: { userId } })
  if (!portfolio) return apiError('Portfolio not found', 404)

  const { fastest } = await fetchCurrentFeeRate()
  const { feeSats, feeBtc, netAmountBtc } = estimateWithdrawalFee(amountBtc, fastest)

  if (portfolio.btcBalance < amountBtc + feeBtc) {
    return apiError(`Insufficient BTC balance. Required: ${(amountBtc + feeBtc).toFixed(8)} BTC`)
  }

  if (netAmountBtc <= 0) {
    return apiError('Amount is too small to cover fees')
  }

  // Rate limit: max 3 withdrawals per 24h
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentCount = await db.withdrawal.count({
    where: { userId, createdAt: { gte: yesterday } },
  })
  if (recentCount >= 3) {
    return apiError('Maximum 3 withdrawals per 24 hours', 429)
  }

  // Create withdrawal record
  const withdrawal = await db.withdrawal.create({
    data: {
      userId,
      amountBtc,
      amountSats: btcToSats(amountBtc),
      btcAddress,
      feeRateSatVbyte: fastest,
      status: 'PROCESSING',
    },
  })

  // Deduct balance immediately
  await db.portfolio.update({
    where: { userId },
    data: {
      btcBalance: { decrement: amountBtc },
      totalWithdrawn: { increment: amountBtc },
    },
  })

  // Broadcast transaction asynchronously
  try {
    const { txid, feeSats: actualFee } = await buildAndBroadcastWithdrawal(
      btcAddress,
      btcToSats(amountBtc),
      fastest
    )

    await db.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        txid,
        feeSats: actualFee,
        status: 'BROADCAST',
        broadcastAt: new Date(),
      },
    })

    return apiSuccess({ withdrawal: { ...withdrawal, txid, status: 'BROADCAST' } }, 201)
  } catch (err: any) {
    // Refund on failure
    await db.$transaction([
      db.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: 'FAILED' },
      }),
      db.portfolio.update({
        where: { userId },
        data: {
          btcBalance: { increment: amountBtc },
          totalWithdrawn: { decrement: amountBtc },
        },
      }),
    ])

    console.error('[Withdrawals] Broadcast failed:', err.message)
    return apiError(`Withdrawal failed: ${err.message}`, 500)
  }
}
