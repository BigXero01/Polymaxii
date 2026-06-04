'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import { CreditCard, Shield, DollarSign } from 'lucide-react'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const PRESET_AMOUNTS = [50, 100, 250, 500, 1000]

function CheckoutForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setProcessing(true)

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/dashboard` },
      redirect: 'if_required',
    })

    setProcessing(false)
    if (error) {
      toast.error(error.message ?? 'Payment failed')
    } else if (paymentIntent?.status === 'succeeded') {
      toast.success('Deposit successful! Balance will update shortly.')
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
          wallets: { applePay: 'auto', googlePay: 'auto' },
        }}
      />
      <button
        type="submit"
        disabled={processing || !stripe}
        className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-lg hover:bg-primary/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {processing ? 'Processing…' : 'Deposit Now'}
      </button>
    </form>
  )
}

export default function DepositPage() {
  const [amount, setAmount] = useState(100)
  const [customAmount, setCustomAmount] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [step, setStep] = useState<'amount' | 'payment' | 'success'>('amount')

  const finalAmount = customAmount ? parseFloat(customAmount) : amount

  async function createIntent() {
    if (finalAmount < 10) { toast.error('Minimum deposit is $10'); return }
    if (finalAmount > 10000) { toast.error('Maximum deposit is $10,000'); return }

    const res = await fetch('/api/payments/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: Math.round(finalAmount * 100) }),
    })
    const data = await res.json()
    if (data.success) {
      setClientSecret(data.data.clientSecret)
      setStep('payment')
    } else {
      toast.error(data.error)
    }
  }

  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 pt-12">
        <div className="w-16 h-16 rounded-full bg-profit/20 border border-profit/30 flex items-center justify-center mx-auto">
          <DollarSign className="w-8 h-8 text-profit" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Deposit Successful</h2>
          <p className="text-muted-foreground mt-2">
            {formatCurrency(finalAmount)} has been added to your account. Your balance will update within seconds.
          </p>
        </div>
        <button
          onClick={() => { setStep('amount'); setClientSecret('') }}
          className="bg-secondary text-foreground px-6 py-2.5 rounded-lg hover:bg-accent transition font-medium"
        >
          Make Another Deposit
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deposit Funds</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Add USD to your trading account</p>
      </div>

      {step === 'amount' && (
        <div className="space-y-6">
          <div className="card-glass rounded-xl p-6 space-y-4">
            <h2 className="font-semibold">Select Amount</h2>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_AMOUNTS.map(a => (
                <button
                  key={a}
                  onClick={() => { setAmount(a); setCustomAmount('') }}
                  className={`py-2 rounded-lg text-sm font-medium transition ${
                    amount === a && !customAmount
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent border border-border'
                  }`}
                >
                  ${a}
                </button>
              ))}
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Custom amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <input
                  type="number"
                  min="10"
                  max="10000"
                  placeholder="Enter amount"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg pl-7 pr-3 py-2.5 text-sm outline-none focus:border-primary/50 transition"
                />
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="card-glass rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <CreditCard className="w-4 h-4 text-primary flex-shrink-0" />
              <span>Apple Pay, Google Pay, and all major credit cards accepted</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Shield className="w-4 h-4 text-profit flex-shrink-0" />
              <span>256-bit SSL encryption · Powered by Stripe</span>
            </div>
          </div>

          <div className="card-glass rounded-xl p-4 flex items-center justify-between">
            <span className="text-muted-foreground">You will deposit</span>
            <span className="text-2xl font-bold mono text-btc">
              {formatCurrency(finalAmount || 0)}
            </span>
          </div>

          <button
            onClick={createIntent}
            disabled={finalAmount < 10}
            className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-lg hover:bg-primary/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Continue to Payment
          </button>
        </div>
      )}

      {step === 'payment' && clientSecret && (
        <div className="space-y-4">
          <div className="card-glass rounded-xl p-4 flex items-center justify-between">
            <span className="text-muted-foreground">Depositing</span>
            <span className="text-2xl font-bold mono text-btc">{formatCurrency(finalAmount)}</span>
          </div>

          <div className="card-glass rounded-xl p-6">
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'night',
                  variables: {
                    colorPrimary: '#f7931a',
                    colorBackground: 'hsl(222 47% 7%)',
                    colorText: 'hsl(210 40% 98%)',
                    colorDanger: '#ff4d4d',
                    borderRadius: '8px',
                  },
                },
              }}
            >
              <CheckoutForm onSuccess={() => setStep('success')} />
            </Elements>
          </div>

          <button
            onClick={() => setStep('amount')}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition"
          >
            ← Change amount
          </button>
        </div>
      )}
    </div>
  )
}
