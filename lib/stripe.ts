import Stripe from 'stripe'

const globalForStripe = globalThis as unknown as { stripe: Stripe }

export const stripe = globalForStripe.stripe ?? new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
})

if (process.env.NODE_ENV !== 'production') {
  globalForStripe.stripe = stripe
}

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<string> {
  const { db } = await import('./db')

  // Check if already stored (could extend User model with stripeCustomerId field)
  // For now, search Stripe by metadata
  const existing = await stripe.customers.search({
    query: `metadata["userId"]:"${userId}"`,
    limit: 1,
  })

  if (existing.data.length > 0) {
    return existing.data[0].id
  }

  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { userId },
  })

  return customer.id
}

export async function createPaymentIntent(
  amountCents: number,
  customerId: string,
  userId: string
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    customer: customerId,
    payment_method_types: ['card'],
    // Apple Pay is surfaced automatically when customer is in Safari with Apple Pay configured
    // Enable additional methods via Stripe Dashboard > Payment methods
    metadata: {
      userId,
      platform: 'polymaxii',
    },
    description: 'Polymaxii deposit',
  })
}

export function constructWebhookEvent(
  payload: string,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  )
}

export default stripe
