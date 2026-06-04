'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  Settings,
  CreditCard,
  Bitcoin,
  Zap,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/trades', label: 'Trades', icon: TrendingUp },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/deposit', label: 'Deposit', icon: CreditCard },
  { href: '/dashboard/withdraw', label: 'Withdraw', icon: Bitcoin },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-16 lg:w-56 flex-shrink-0 flex flex-col bg-card border-r border-border/50 py-4">
      {/* Logo */}
      <div className="px-4 mb-8 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-btc" />
        </div>
        <span className="hidden lg:block font-bold text-lg tracking-tight">Polymaxii</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary/15 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="hidden lg:block">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Version */}
      <div className="px-4 py-2 hidden lg:block">
        <p className="text-xs text-muted-foreground/50 mono">v1.0.0</p>
      </div>
    </aside>
  )
}
