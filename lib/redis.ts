import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as { redis: Redis }

function createRedis(): Redis {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    enableOfflineQueue: true,
    lazyConnect: true,
  })
  redis.on('error', (err) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[Redis] error:', err.message)
    }
  })
  return redis
}

export const redis = globalForRedis.redis ?? createRedis()

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis
}

export const KEYS = {
  btcTicker: 'btc:ticker',
  candles: (interval: string) => `btc:candles:${interval}`,
  prediction: (userId: string) => `prediction:${userId}:latest`,
  botStatus: (userId: string) => `bot:${userId}:status`,
  priceStream: 'btc:price:stream',
} as const

export async function getOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  try {
    const cached = await redis.get(key)
    if (cached) return JSON.parse(cached) as T
  } catch {}
  const value = await fetcher()
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value))
  } catch {}
  return value
}

export default redis
