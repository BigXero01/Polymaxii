/**
 * Standalone prediction + trade monitoring scheduler.
 * Run with: npx tsx workers/prediction-scheduler.ts
 * In production: use PM2 or a separate Kubernetes job.
 */
import cron from 'node-cron'
import db from '../lib/db'
import { runPredictionCycle, monitorOpenTrades } from '../lib/trader'

async function getAllActiveBots(): Promise<string[]> {
  const settings = await db.botSettings.findMany({
    where: { isActive: true },
    select: { userId: true },
  })
  return settings.map(s => s.userId)
}

async function runPredictions() {
  console.log('[Scheduler] Running prediction cycle:', new Date().toISOString())
  const userIds = await getAllActiveBots()
  console.log(`[Scheduler] Active bots: ${userIds.length}`)

  for (const userId of userIds) {
    try {
      const prediction = await runPredictionCycle(userId)
      if (prediction) {
        console.log(`[Scheduler] ${userId}: ${prediction.direction} ${prediction.confidence.toFixed(1)}% confidence`)
      }
    } catch (err) {
      console.error(`[Scheduler] Prediction failed for ${userId}:`, err)
    }
  }
}

async function runMonitoring() {
  const userIds = await getAllActiveBots()
  for (const userId of userIds) {
    try {
      await monitorOpenTrades(userId)
    } catch (err) {
      console.error(`[Scheduler] Monitor failed for ${userId}:`, err)
    }
  }
}

// Run predictions every 15 minutes (aligned to clock boundaries)
cron.schedule('*/15 * * * *', async () => {
  await runPredictions()
})

// Monitor open trades every 30 seconds
cron.schedule('*/30 * * * * *', async () => {
  await runMonitoring()
})

// Mark expired predictions
cron.schedule('*/15 * * * *', async () => {
  await db.prediction.updateMany({
    where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  })
})

console.log('[Scheduler] Started — prediction cycle every 15m, trade monitoring every 30s')

// Run immediately on startup
runPredictions().catch(console.error)
