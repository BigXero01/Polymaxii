'use client'

import { useState, useEffect } from 'react'
import { formatBTC, formatCurrency, btcToSats, satsToBtc } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Bitcoin, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'

interface Props {
  btcBalance: number
}

interface FeeEstimate {
  feeSats: number
  feeBtc: number
  netAmountBtc: number
  feeUsd: number
  feeRateSatVbyte: number
}

export default function WithdrawPage({ btcBalance }: Props) {
  const [form, setForm] = useState({ amountBtc: '', btcAddress: '' })
  const [estimate, setEstimate] = useState<FeeEstimate | null>(null)
  const [loadingFee, setLoadingFee] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [txid, setTxid] = useState<string | null>(null)

  // Debounced fee estimate
  useEffect(() => {
    const amount = parseFloat(form.amountBtc)
    if (!amount || amount <= 0) { setEstimate(null); return }

    const timer = setTimeout(async () => {
      setLoadingFee(true)
      const res = await fetch(`/api/withdrawals?amountBtc=${amount}`)
      const data = await res.json()
      setLoadingFee(false)
      if (data.success) setEstimate(data.data)
    }, 600)
    return () => clearTimeout(timer)
  }, [form.amountBtc])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(form.amountBtc)
    if (!amount || !form.btcAddress) return

    setSubmitting(true)
    const res = await fetch('/api/withdrawals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountBtc: amount, btcAddress: form.btcAddress }),
    })
    const data = await res.json()
    setSubmitting(false)

    if (data.success) {
      setTxid(data.data.withdrawal.txid)
    } else {
      toast.error(data.error)
    }
  }

  if (txid) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 pt-12">
        <div className="w-16 h-16 rounded-full bg-btc/20 border border-btc/30 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-btc" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Withdrawal Broadcast</h2>
          <p className="text-muted-foreground mt-2">
            Your Bitcoin withdrawal has been broadcast to the network.
          </p>
        </div>
        <div className="card-glass rounded-xl p-4 text-left space-y-2">
          <p className="text-xs text-muted-foreground">Transaction ID</p>
          <a
            href={`https://blockstream.info/tx/${txid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-btc hover:underline font-mono break-all"
          >
            {txid}
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          Typically confirms within 10-30 minutes. Track on{' '}
          <a href={`https://mempool.space/tx/${txid}`} target="_blank" rel="noopener noreferrer" className="text-btc hover:underline">
            mempool.space
          </a>
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Withdraw Bitcoin</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Send BTC profits to any Bitcoin address</p>
      </div>

      {/* Balance */}
      <div className="card-glass rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bitcoin className="w-5 h-5 text-btc" />
          <span className="text-muted-foreground">Available BTC</span>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold mono text-btc">{formatBTC(btcBalance)}</p>
          <button
            onClick={() => setForm(f => ({ ...f, amountBtc: btcBalance.toFixed(8) }))}
            className="text-xs text-muted-foreground hover:text-primary transition"
          >
            Use max
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card-glass rounded-xl p-6 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Amount (BTC)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-btc font-bold">₿</span>
              <input
                type="number"
                step="0.00000001"
                min="0.0005"
                placeholder="0.00000000"
                value={form.amountBtc}
                onChange={e => setForm(f => ({ ...f, amountBtc: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-lg pl-8 pr-3 py-2.5 text-sm mono outline-none focus:border-primary/50 transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Bitcoin Address</label>
            <input
              type="text"
              placeholder="bc1q... or 1... or 3..."
              value={form.btcAddress}
              onChange={e => setForm(f => ({ ...f, btcAddress: e.target.value }))}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm mono outline-none focus:border-primary/50 transition"
              required
            />
          </div>

          {/* Fee Estimate */}
          {(loadingFee || estimate) && (
            <div className="bg-secondary rounded-lg p-3 space-y-2 text-sm">
              {loadingFee ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Estimating fee…</span>
                </div>
              ) : estimate && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Network fee</span>
                    <span className="mono">{estimate.feeSats.toLocaleString()} sats ≈ {formatCurrency(estimate.feeUsd, 'USD', 2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fee rate</span>
                    <span className="mono">{estimate.feeRateSatVbyte} sat/vbyte</span>
                  </div>
                  <div className="flex justify-between font-medium pt-1 border-t border-border">
                    <span>You will receive</span>
                    <span className="text-btc mono">{formatBTC(estimate.netAmountBtc)}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-yellow-500" />
          <span>Bitcoin transactions are irreversible. Double-check the address before sending.</span>
        </div>

        <button
          type="submit"
          disabled={submitting || !form.amountBtc || !form.btcAddress || parseFloat(form.amountBtc) <= 0}
          className="w-full bg-btc text-black font-semibold py-3 rounded-lg hover:bg-btc/90 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Broadcasting…</>
          ) : (
            <><Bitcoin className="w-4 h-4" /> Withdraw Bitcoin</>
          )}
        </button>
      </form>
    </div>
  )
}
