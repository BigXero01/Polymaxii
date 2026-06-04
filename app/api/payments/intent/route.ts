import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { createPaymentIntent, getOrCreateStripeCustomer } from '@/lib/stripe'
import db from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/utils'

const MIN_DEPOSIT = parseInt(process.env.MIN_DEPOSIT_CENTS ?? '1000', 10)
const MAX_DEPOSIT = parseInt(process.env.MAX_DEPOSIT_CENTS ?? '1000000', 10)

const schema = z.object({
  amountCents: z.number().int().min(MIN_DEPOSIT).max(MAX_DEPOSIT),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return apiError('Unauthorized', 401)
  const userId = (session.user as any).id
  const userEmail = session.user.email!
  const userName = session.user.name ?? undefined

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.errors[0].message)

  try {
    const customerId = await getOrCreateStripeCustomer(userId, userEmail, userName)
    const intent = await createPaymentIntent(parsed.data.amountCents, customerId, userId)

    return apiSuccess({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount: intent.amount,
      currency: intent.currency,
    })
  } catch (err) {
    console.error('[Payments/Intent]', err)
    return apiError('Failed to create payment intent', 500)
  }
}
