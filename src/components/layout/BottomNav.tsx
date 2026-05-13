'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, ShoppingCart, Receipt, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReceiptWithItems } from '@/lib/types'

const tabs = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { href: '/groceries', icon: ShoppingCart, label: 'Groceries' },
  { href: '/expenses', icon: Receipt, label: 'Expenses' },
  { href: '/reports', icon: BarChart3, label: 'Reports' },
]

export function BottomNav() {
  const pathname = usePathname()
  const queryClient = useQueryClient()

  const receipts = queryClient.getQueryData<ReceiptWithItems[]>(['receipts']) ?? []
  const unsettledCount = receipts.filter(r => !r.is_settled).length

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-200 pb-safe">
      <div className="flex h-16">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          const badge = href === '/groceries' && unsettledCount > 0 ? unsettledCount : null
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors min-h-[44px] relative',
                active ? 'text-indigo-600' : 'text-zinc-500 hover:text-zinc-900'
              )}
            >
              <div className="relative">
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
                {badge && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
