export interface BTCTicker {
  symbol: string
  price: number
  change24h: number
  changePct24h: number
  volume24h: number
  high24h: number
  low24h: number
  timestamp: number
}

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface TechnicalSignal {
  name: string
  value: number
  signal: 'BUY' | 'SELL' | 'NEUTRAL'
  score: number  // -100 to +100
  weight: number
}

export interface PredictionResult {
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
  confidence: number  // 0-100
  entryPrice: number
  targetPrice: number
  stopPrice: number
  signals: TechnicalSignal[]
  compositeScore: number  // -100 to +100
}

export interface TradePosition {
  id: string
  symbol: string
  side: 'LONG' | 'SHORT'
  entryPrice: number
  currentPrice: number
  quantity: number
  notional: number
  stopLoss: number
  takeProfit: number
  unrealizedPnl: number
  unrealizedPnlPct: number
  openedAt: Date
  tradingMode: 'PAPER' | 'LIVE'
}

export interface PortfolioStats {
  usdBalance: number
  btcBalance: number
  totalDeposited: number
  totalWithdrawn: number
  realizedPnl: number
  unrealizedPnl: number
  totalReturn: number
  totalReturnPct: number
  winRate: number
  profitFactor: number
  sharpeRatio: number
  maxDrawdown: number
  totalTrades: number
  openTrades: number
  avgWin: number
  avgLoss: number
}

export interface BotStatus {
  isActive: boolean
  tradingMode: 'PAPER' | 'LIVE'
  openPositions: number
  lastPrediction: PredictionResult | null
  lastPredictionAt: Date | null
  nextPredictionAt: Date | null
  sessionPnl: number
  sessionTrades: number
}

export interface MarketStreamEvent {
  type: 'ticker' | 'candle' | 'prediction' | 'trade_opened' | 'trade_closed'
  data: unknown
  timestamp: number
}

export interface DepositIntent {
  clientSecret: string
  amount: number
  currency: string
}

export interface WithdrawalRequest {
  amountBtc: number
  btcAddress: string
}

export interface AnalyticsData {
  period: '7d' | '30d' | '90d' | 'all'
  pnlHistory: { date: string; pnl: number; cumulative: number }[]
  tradeDistribution: { win: number; loss: number; breakeven: number }
  hourlyPerformance: { hour: number; avgPnl: number; trades: number }[]
  predictionAccuracy: { correct: number; incorrect: number; expired: number }
  topMetrics: PortfolioStats
}

export type ApiResponse<T> = {
  success: true
  data: T
} | {
  success: false
  error: string
  code?: string
}
