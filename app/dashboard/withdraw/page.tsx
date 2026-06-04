import { auth } from '@/lib/auth'
import WithdrawPage from '@/components/payments/WithdrawPage'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function Withdraw() {
  const session = await auth()
  const userId = (session!.user as any).id
  const portfolio = await db.portfolio.findUnique({ where: { userId } })
  return <WithdrawPage btcBalance={portfolio?.btcBalance ?? 0} />
}
