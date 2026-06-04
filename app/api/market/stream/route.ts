import { NextRequest } from 'next/server'
import { getCachedTicker } from '@/lib/binance'

export const dynamic = 'force-dynamic'

// Server-Sent Events endpoint for real-time BTC price streaming
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      // Send initial price immediately
      try {
        const ticker = await getCachedTicker()
        send({ type: 'ticker', data: ticker })
      } catch {}

      // Poll every 2 seconds
      const interval = setInterval(async () => {
        try {
          const ticker = await getCachedTicker()
          send({ type: 'ticker', data: ticker })
        } catch {
          send({ type: 'error', message: 'Failed to fetch price' })
        }
      }, 2000)

      // Heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {}
      }, 30000)

      // Cleanup on close
      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        clearInterval(heartbeat)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
