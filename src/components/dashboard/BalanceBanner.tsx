'use client'

import { useState } from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SettleUpSheet } from '@/components/expenses/SettleUpSheet'
import type { HouseholdBalance } from '@/lib/types'
import { ArrowUpRight, ArrowDownLeft, CheckCircle2 } from 'lucide-react'

interface Props {
  balance: HouseholdBalance
  partnerName: string | null
  onSettled: () => void
}

export function BalanceBanner({ balance, partnerName, onSettled }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const { net, you_are_owed, you_owe } = balance

  const isOwed = net > 0
  const isOwing = net < 0
  const isEven = net === 0
  const friendLabel = partnerName ?? 'Friend'

  return (
    <>
      <div
        className={cn(
          'mx-4 mt-4 rounded-2xl p-5 text-white shadow-sm',
          isOwed && 'bg-gradient-to-br from-emerald-500 to-emerald-600',
          isOwing && 'bg-gradient-to-br from-rose-500 to-rose-600',
          isEven && 'bg-gradient-to-br from-indigo-500 to-indigo-600'
        )}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium opacity-90">
              {isEven ? "All settled up!" : isOwed ? 'You are owed' : 'You owe'}
            </p>
            {!isEven && (
              <p className="text-3xl font-bold mt-0.5 tracking-tight">{formatCurrency(Math.abs(net))}</p>
            )}
            {isEven && (
              <div className="flex items-center gap-2 mt-1">
                <CheckCircle2 className="h-5 w-5 opacity-90" />
                <p className="text-sm opacity-90">No outstanding balance</p>
              </div>
            )}
            {!isEven && partnerName && (
              <p className="text-sm opacity-80 mt-0.5">
                {isOwed ? `${friendLabel} owes you` : `You owe ${friendLabel}`}
              </p>
            )}
          </div>
          {!isEven && (
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/20 hover:bg-white/30 text-white border-0 flex-shrink-0"
              onClick={() => setSheetOpen(true)}
            >
              Settle Up
            </Button>
          )}
        </div>

        {/* Breakdown row when both sides exist */}
        {(you_are_owed > 0 || you_owe > 0) && (
          <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 opacity-80" />
              <div>
                <p className="text-[10px] opacity-70 uppercase tracking-wide">Owed to you</p>
                <p className="text-sm font-semibold">{formatCurrency(you_are_owed)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowDownLeft className="h-3.5 w-3.5 opacity-80" />
              <div>
                <p className="text-[10px] opacity-70 uppercase tracking-wide">You owe</p>
                <p className="text-sm font-semibold">{formatCurrency(you_owe)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <SettleUpSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        netBalance={net}
        onSettled={onSettled}
      />
    </>
  )
}
