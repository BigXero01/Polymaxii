import { NextRequest } from 'next/server'
import { constructWebhookEvent } from '@/lib/stripe'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

// IMPORTANT: must use raw body, not parsed JSON
export async function POST(req: NextRequest) {
  const payload = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return new Response('Missing signature', { status: 400 })
  }

  let event
  try {
    event = constructWebhookEvent(payload, sig)
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as any
        const userId = intent.metadata?.userId
        if (!userId) break

        const amountCents = intent.amount
        const amountUsd = amountCents / 100

        // Idempotency check
        const existing = await db.deposit.findUnique({
          where: { stripePaymentId: intent.id },
        })
        if (existing?.status === 'COMPLETED') break

        await db.$transaction([
          db.deposit.upsert({
            where: { stripePaymentId: intent.id },
            create: {
              userId,
              amountCents,
              stripePaymentId: intent.id,
              status: 'COMPLETED',
              completedAt: new Date(),
            },
            update: { status: 'COMPLETED', completedAt: new Date() },
          }),
          db.portfolio.upsert({
            where: { userId },
            create: { userId, usdBalance: amountUsd, totalDeposited: amountUsd },
            update: {
              usdBalance: { increment: amountUsd },
              totalDeposited: { increment: amountUsd },
            },
          }),
        ])
        break
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as any
        const existing = await db.deposit.findUnique({
          where: { stripePaymentId: intent.id },
        })
        if (existing) {
          await db.deposit.update({
            where: { stripePaymentId: intent.id },
            data: { status: 'FAILED' },
          })
        }
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as any
        const paymentIntentId = charge.payment_intent
        if (!paymentIntentId) break

        const deposit = await db.deposit.findUnique({
          where: { stripePaymentId: paymentIntentId },
        })
        if (!deposit || deposit.status !== 'COMPLETED') break

        const amountUsd = deposit.amountCents / 100
        await db.$transaction([
          db.deposit.update({
            where: { stripePaymentId: paymentIntentId },
            data: { status: 'REFUNDED' },
          }),
          db.portfolio.update({
            where: { userId: deposit.userId },
            data: { usdBalance: { decrement: amountUsd } },
          }),
        ])
        break
      }
    }
  } catch (err) {
    console.error('[Webhook] Handler error:', err)
    // Still return 200 to acknowledge receipt — retry won't help data errors
  }

  return new Response('OK', { status: 200 })
}
