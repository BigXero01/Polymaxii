import { auth } from '@/lib/auth'
import TradesPage from '@/components/trading/TradesPage'

export const dynamic = 'force-dynamic'

export default async function TradesDashboard() {
  const session = await auth()
  const userId = (session!.user as any).id
  return <TradesPage userId={userId} />
}
