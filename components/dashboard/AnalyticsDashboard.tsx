'use client'

import { useState, useEffect } from 'react'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatPercent } from '@/lib/utils'

type Period = '7d' | '30d' | '90d' | 'all'

interface Props { userId: string }

export default function AnalyticsDashboard({ userId }: Props) {
  const [period, setPeriod] = useState<Period>('30d')
  const [data, setData] = useState<any>(null)
  const [portfolio, setPortfolio] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/analytics?period=${period}`).then(r => r.json()),
      fetch('/api/portfolio').then(r => r.json()),
    ]).then(([analytics, port]) => {
      if (analytics.success) setData(analytics.data)
      if (port.success) setPortfolio(port.data)
    }).finally(() => setLoading(false))
  }, [period])

  const COLORS = ['#00c896', '#ff4d4d', '#6b7280']

  if (loading) return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-secondary animate-pulse rounded" />
      <div className="grid grid-cols-4 gap-4">
        {Array(4).fill(0).map((_, i) => <div key={i} className="h-24 bg-secondary animate-pulse rounded-xl" />)}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <div className="flex gap-1">
          {(['7d', '30d', '90d', 'all'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                period === p ? 'bg-primary/20 text-primary border border-primary/30' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              {p === 'all' ? 'All Time' : p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics Grid */}
      {portfolio && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: 'Win Rate', value: `${portfolio.winRate?.toFixed(1) ?? 0}%`, sub: `${portfolio.totalTrades} trades`, color: 'text-profit' },
            { label: 'Total P&L', value: formatCurrency(portfolio.realizedPnl ?? 0), sub: formatPercent(portfolio.totalReturnPct ?? 0), color: (portfolio.realizedPnl ?? 0) >= 0 ? 'text-profit' : 'text-loss' },
            { label: 'Profit Factor', value: (portfolio.profitFactor ?? 0).toFixed(2), sub: 'Avg Win / Avg Loss', color: 'text-foreground' },
            { label: 'Sharpe Ratio', value: (portfolio.sharpeRatio ?? 0).toFixed(2), sub: `Max DD: ${formatPercent(-(portfolio.maxDrawdown ?? 0))}`, color: 'text-foreground' },
          ].map(m => (
            <div key={m.label} className="card-glass rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{m.label}</p>
              <p className={`text-2xl font-bold mono ${m.color}`}>{m.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* PnL Chart */}
      {data?.pnlHistory?.length > 0 && (
        <div className="card-glass rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-4">Cumulative P&L</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.pnlHistory}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00c896" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00c896" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(215 20% 55%)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(215 20% 55%)' }} tickFormatter={v => `$${v.toFixed(0)}`} />
              <Tooltip
                contentStyle={{ background: 'hsl(222 47% 7%)', border: '1px solid hsl(217 32% 14%)', borderRadius: 8 }}
                formatter={(v: number) => [formatCurrency(v), 'P&L']}
              />
              <Area type="monotone" dataKey="cumulative" stroke="#00c896" fill="url(#pnlGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bottom Row: Distribution + Hourly + Accuracy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trade Distribution */}
        {data?.tradeDistribution && (
          <div className="card-glass rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-4">Trade Outcomes</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Win', value: data.tradeDistribution.win },
                    { name: 'Loss', value: data.tradeDistribution.loss },
                    { name: 'B/E', value: data.tradeDistribution.breakeven },
                  ]}
                  cx="50%" cy="50%"
                  innerRadius={40} outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(222 47% 7%)', border: '1px solid hsl(217 32% 14%)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 text-xs">
              {[
                { label: 'Win', color: '#00c896', value: data.tradeDistribution.win },
                { label: 'Loss', color: '#ff4d4d', value: data.tradeDistribution.loss },
                { label: 'B/E', color: '#6b7280', value: data.tradeDistribution.breakeven },
              ].map(d => (
                <div key={d.label} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-muted-foreground">{d.label}: {d.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hourly Performance */}
        {data?.hourlyPerformance?.length > 0 && (
          <div className="card-glass rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-4">Best Hours (UTC)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.hourlyPerformance}>
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'hsl(215 20% 55%)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215 20% 55%)' }} />
                <Tooltip
                  contentStyle={{ background: 'hsl(222 47% 7%)', border: '1px solid hsl(217 32% 14%)' }}
                  formatter={(v: number) => [formatCurrency(v), 'Avg P&L']}
                />
                <Bar dataKey="avgPnl" radius={[3, 3, 0, 0]}>
                  {data.hourlyPerformance.map((d: any, i: number) => (
                    <Cell key={i} fill={d.avgPnl >= 0 ? '#00c896' : '#ff4d4d'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Prediction Accuracy */}
        {data?.predictionAccuracy && (
          <div className="card-glass rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-4">AI Accuracy</h3>
            <div className="space-y-3">
              {[
                { label: 'Correct', value: data.predictionAccuracy.correct, color: 'bg-profit' },
                { label: 'Incorrect', value: data.predictionAccuracy.incorrect, color: 'bg-loss' },
                { label: 'Expired', value: data.predictionAccuracy.expired, color: 'bg-muted-foreground' },
              ].map(item => {
                const total = data.predictionAccuracy.correct + data.predictionAccuracy.incorrect + data.predictionAccuracy.expired
                const pct = total > 0 ? (item.value / total) * 100 : 0
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium">{item.value} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-border/30">
              <p className="text-xs text-muted-foreground">Overall accuracy</p>
              <p className="text-2xl font-bold mono text-profit mt-1">
                {data.predictionAccuracy.correct + data.predictionAccuracy.incorrect > 0
                  ? `${((data.predictionAccuracy.correct / (data.predictionAccuracy.correct + data.predictionAccuracy.incorrect)) * 100).toFixed(1)}%`
                  : '—'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
