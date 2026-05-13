'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Profile, Household } from '@/lib/types'

interface HouseholdContextValue {
  currentUser: Profile
  partner: Profile | null
  household: Household
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null)

export function HouseholdProvider({
  children,
  value,
}: {
  children: ReactNode
  value: HouseholdContextValue
}) {
  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold(): HouseholdContextValue {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used inside HouseholdProvider')
  return ctx
}
