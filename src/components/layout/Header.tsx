'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useHousehold } from '@/context/HouseholdContext'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'
import { ChevronLeft } from 'lucide-react'

const titles: Record<string, string> = {
  '/dashboard': 'Home',
  '/groceries': 'Groceries',
  '/expenses': 'Expenses',
  '/reports': 'Reports',
  '/profile': 'Profile',
}

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { currentUser, household } = useHousehold()

  const title = Object.entries(titles).find(([k]) => pathname.startsWith(k))?.[1] ?? 'SplitMate'
  const isProfile = pathname.startsWith('/profile')

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-zinc-200 px-4 h-14 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {isProfile && (
          <button
            onClick={() => router.back()}
            className="p-1 -ml-1 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-zinc-600" />
          </button>
        )}
        <div>
          <h1 className="font-semibold text-base">{title}</h1>
          {!isProfile && <p className="text-xs text-muted-foreground">{household.name}</p>}
        </div>
      </div>

      {!isProfile && (
        <button
          onClick={() => router.push('/profile')}
          className="rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback
              style={{ backgroundColor: currentUser.avatar_color }}
              className="text-white text-xs font-semibold"
            >
              {getInitials(currentUser.display_name)}
            </AvatarFallback>
          </Avatar>
        </button>
      )}
    </header>
  )
}
