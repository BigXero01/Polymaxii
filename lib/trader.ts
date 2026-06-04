import db from './db'
import { redis } from './redis'
import { PredictionResult } from '@/types'
import { getCachedCandles, getCachedTicker, placeBinanceOrder, getBinanceAccountBalance } from './binance'
import { getPrediction } from './predictor'
import { calculatePnl, btcToSats } from './utils'

interface TraderConfig {
  userId: string
  tradingMode: 'PAPER' | 'LIVE'
  minConfidence: number
  maxPositionSizePct: number
  stopLossPct: number
  takeProfitPct: number
  maxConcurrentTrades: number
}

export async function runPredictionCycle(userId: string): Promise<PredictionResult | null> {
  const settings = await db.botSettings.findUnique({ where: { userId } })
  if (!settings?.isActive) return null

  const candles = await getCachedCandles('BTCUSDT', '15m', 200)
  if (candles.length < 50) return null

  const prediction = await getPrediction(candles)

  // Persist prediction
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

  // Cache latest prediction
  await redis.setex(`prediction:${userId}:latest`, 900, JSON.stringify(prediction))

  // Execute trade if confidence is sufficient
  if (prediction.direction !== 'NEUTRAL' && prediction.confidence >= settings.minConfidence) {
    await executeTradeFromPrediction(userId, prediction, {
      userId,
      tradingMode: settings.tradingMode as 'PAPER' | 'LIVE',
      minConfidence: settings.minConfidence,
      maxPositionSizePct: settings.maxPositionSizePct,
      stopLossPct: settings.stopLossPct,
      takeProfitPct: settings.takeProfitPct,
      maxConcurrentTrades: settings.maxConcurrentTrades,
    })
  }

  return prediction
}

export async function executeTradeFromPrediction(
  userId: string,
  prediction: PredictionResult,
  config: TraderConfig
): Promise<void> {
  // Check concurrent trade limit
  const openTrades = await db.trade.count({
    where: { userId, status: 'OPEN' },
  })
  if (openTrades >= config.maxConcurrentTrades) return

  const portfolio = await db.portfolio.findUnique({ where: { userId } })
  if (!portfolio) return

  const ticker = await getCachedTicker()
  const currentPrice = ticker.price

  // Position sizing: confidence-scaled percentage of USD balance
  const confidenceMultiplier = (prediction.confidence - config.minConfidence) / (100 - config.minConfidence)
  const positionSizePct = config.maxPositionSizePct * Math.max(0.1, confidenceMultiplier)
  const notional = portfolio.usdBalance * (positionSizePct / 100)

  if (notional < 10) return // Minimum $10 trade

  const quantity = notional / currentPrice

  const stopLoss = prediction.direction === 'UP'
    ? currentPrice * (1 - config.stopLossPct / 100)
    : currentPrice * (1 + config.stopLossPct / 100)
  const takeProfit = prediction.direction === 'UP'
    ? currentPrice * (1 + config.takeProfitPct / 100)
    : currentPrice * (1 - config.takeProfitPct / 100)

  if (config.tradingMode === 'PAPER') {
    // Paper trade: reserve USD
    await db.$transaction([
      db.trade.create({
        data: {
          userId,
          predictionId: undefined,
          side: prediction.direction === 'UP' ? 'LONG' : 'SHORT',
          tradingMode: 'PAPER',
          entryPrice: currentPrice,
          quantity,
          notional,
          stopLoss,
          takeProfit,
          fee: notional * 0.001, // 0.1% simulated fee
        },
      }),
      db.portfolio.update({
        where: { userId },
        data: { usdBalance: { decrement: notional } },
      }),
    ])
  } else {
    // Live trade: execute on Binance
    const apiKey = await db.exchangeApiKey.findFirst({
      where: { userId, isActive: true, exchange: 'binance' },
    })
    if (!apiKey) return

    try {
      const order = await placeBinanceOrder(
        apiKey.apiKey,
        apiKey.secretKey,
        'BTCUSDT',
        prediction.direction === 'UP' ? 'BUY' : 'SELL',
        quantity.toFixed(6)
      )
      const fillPrice = order.fills?.length
        ? order.fills.reduce((acc, f) => acc + parseFloat(f.price) * parseFloat(f.qty), 0) /
          order.fills.reduce((acc, f) => acc + parseFloat(f.qty), 0)
        : currentPrice

      await db.trade.create({
        data: {
          userId,
          side: prediction.direction === 'UP' ? 'LONG' : 'SHORT',
          tradingMode: 'LIVE',
          entryPrice: fillPrice,
          quantity,
          notional,
          stopLoss,
          takeProfit,
          exchangeOrderId: String(order.orderId),
          fee: notional * 0.001,
        },
      })
    } catch (err) {
      console.error('[Trader] Live order failed:', err)
    }
  }
}

export async function monitorOpenTrades(userId: string): Promise<void> {
  const openTrades = await db.trade.findMany({
    where: { userId, status: 'OPEN' },
  })
  if (openTrades.length === 0) return

  const ticker = await getCachedTicker()
  const currentPrice = ticker.price

  for (const trade of openTrades) {
    let shouldClose = false
    let closeReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TIME_EXPIRY' | null = null

    // Check stop loss
    if (trade.side === 'LONG' && currentPrice <= trade.stopLoss) {
      shouldClose = true; closeReason = 'STOP_LOSS'
    } else if (trade.side === 'SHORT' && currentPrice >= trade.stopLoss) {
      shouldClose = true; closeReason = 'STOP_LOSS'
    }
    // Check take profit
    else if (trade.side === 'LONG' && currentPrice >= trade.takeProfit) {
      shouldClose = true; closeReason = 'TAKE_PROFIT'
    } else if (trade.side === 'SHORT' && currentPrice <= trade.takeProfit) {
      shouldClose = true; closeReason = 'TAKE_PROFIT'
    }
    // Time expiry: close after 2 intervals (30 min) if no SL/TP hit
    else if (Date.now() - trade.openedAt.getTime() > 30 * 60 * 1000) {
      shouldClose = true; closeReason = 'TIME_EXPIRY'
    }

    if (shouldClose && closeReason) {
      await closeTrade(userId, trade.id, currentPrice, closeReason)
    }
  }
}

export async function closeTrade(
  userId: string,
  tradeId: string,
  exitPrice: number,
  reason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | 'PREDICTION_REVERSAL' | 'TIME_EXPIRY'
): Promise<void> {
  const trade = await db.trade.findUnique({ where: { id: tradeId } })
  if (!trade || trade.status !== 'OPEN') return

  const { pnl, pnlPct } = calculatePnl(
    trade.side as 'LONG' | 'SHORT',
    trade.entryPrice,
    exitPrice,
    trade.quantity
  )
  const netPnl = pnl - trade.fee

  await db.$transaction([
    db.trade.update({
      where: { id: tradeId },
      data: {
        exitPrice,
        status: 'CLOSED',
        closeReason: reason,
        pnl: netPnl,
        pnlPct,
        closedAt: new Date(),
      },
    }),
    db.portfolio.update({
      where: { userId },
      data: {
        usdBalance: { increment: trade.notional + netPnl },
        realizedPnl: { increment: netPnl },
      },
    }),
  ])

  // Update prediction status
  if (trade.predictionId) {
    const prediction = await db.prediction.findUnique({ where: { id: trade.predictionId } })
    if (prediction) {
      const isCorrect =
        (prediction.direction === 'UP' && exitPrice > trade.entryPrice) ||
        (prediction.direction === 'DOWN' && exitPrice < trade.entryPrice)
      await db.prediction.update({
        where: { id: prediction.id },
        data: { status: isCorrect ? 'CORRECT' : 'INCORRECT', actualPrice: exitPrice },
      })
    }
  }

  // Update high water mark and max drawdown
  const portfolio = await db.portfolio.findUnique({ where: { userId } })
  if (portfolio) {
    const totalValue = portfolio.usdBalance + portfolio.btcBalance * exitPrice
    const newHWM = Math.max(portfolio.highWaterMark, totalValue)
    const drawdown = newHWM > 0 ? ((newHWM - totalValue) / newHWM) * 100 : 0
    await db.portfolio.update({
      where: { userId },
      data: {
        highWaterMark: newHWM,
        maxDrawdown: Math.max(portfolio.maxDrawdown, drawdown),
      },
    })
  }
}

export async function getBotStatusData(userId: string) {
  const settings = await db.botSettings.findUnique({ where: { userId } })
  const openTrades = await db.trade.count({ where: { userId, status: 'OPEN' } })

  let lastPrediction = null
  try {
    const cached = await redis.get(`prediction:${userId}:latest`)
    if (cached) lastPrediction = JSON.parse(cached)
  } catch {}

  // Get session PnL (today)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayTrades = await db.trade.findMany({
    where: { userId, status: 'CLOSED', closedAt: { gte: todayStart } },
    select: { pnl: true },
  })
  const sessionPnl = todayTrades.reduce((acc, t) => acc + (t.pnl ?? 0), 0)
  const sessionTrades = todayTrades.length

  return {
    isActive: settings?.isActive ?? false,
    tradingMode: settings?.tradingMode ?? 'PAPER',
    openPositions: openTrades,
    lastPrediction,
    lastPredictionAt: lastPrediction ? new Date() : null,
    nextPredictionAt: settings?.isActive
      ? new Date(Date.now() + 15 * 60 * 1000)
      : null,
    sessionPnl,
    sessionTrades,
  }
}
