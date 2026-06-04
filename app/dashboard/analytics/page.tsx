import { auth } from '@/lib/auth'
import AnalyticsDashboard from '@/components/dashboard/AnalyticsDashboard'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const session = await auth()
  const userId = (session!.user as any).id
  return <AnalyticsDashboard userId={userId} />
}
