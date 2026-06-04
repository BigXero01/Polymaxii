import { auth } from '@/lib/auth'
import SettingsPage from '@/components/dashboard/SettingsPage'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function Settings() {
  const session = await auth()
  const userId = (session!.user as any).id
  const [settings, apiKeys] = await Promise.all([
    db.botSettings.findUnique({ where: { userId } }),
    db.exchangeApiKey.findMany({ where: { userId }, select: { id: true, label: true, exchange: true, isActive: true } }),
  ])
  return <SettingsPage settings={settings!} apiKeys={apiKeys} />
}
