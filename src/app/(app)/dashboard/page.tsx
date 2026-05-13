'use client'

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useHousehold } from '@/context/HouseholdContext'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { BalanceBanner } from '@/components/dashboard/BalanceBanner'
import { MetricCards } from '@/components/dashboard/MetricCards'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { getInitials, formatCurrency } from '@/lib/utils'
import { startOfMonth, endOfMonth, format, getDaysInMonth, getDate } from 'date-fns'
import type { HouseholdBalance, Expense, Receipt, ReceiptWithItems } from '@/lib/types'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

function MonthProgressBar({ spent, daysElapsed, daysTotal }: { spent: number; daysElapsed: number; daysTotal: number }) {
  const progress = Math.round((daysElapsed / daysTotal) * 100)
  const projectedMonthly = daysElapsed > 0 ? (spent / daysElapsed) * daysTotal : 0
  const pace = daysElapsed > 0 ? spent / daysElapsed : 0
  const isAhead = projectedMonthly > spent * 1.1
  const isBehind = projectedMonthly < spent * 0.9

  return (
    <div className="mx-4 mt-3 p-4 bg-white rounded-xl border border-zinc-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Month Progress</p>
        <p className="text-xs text-muted-foreground">Day {daysElapsed} of {daysTotal}</p>
      </div>
      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <div>
          <p className="text-sm font-semibold">{formatCurrency(spent)} spent</p>
          {daysElapsed > 0 && (
            <p className="text-xs text-muted-foreground">{formatCurrency(pace)}/day</p>
          )}
        </div>
        {daysElapsed > 2 && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
            isAhead ? 'bg-amber-50 text-amber-700' : isBehind ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-50 text-zinc-600'
          }`}>
            {isAhead ? <TrendingUp className="h-3 w-3" /> : isBehind ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {formatCurrency(projectedMonthly)} projected
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { currentUser, partner, household } = useHousehold()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()
  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')
  const daysTotal = getDaysInMonth(now)
  const daysElapsed = getDate(now)

  const fetchBalance = useCallback(async (): Promise<HouseholdBalance> => {
    const { data } = await supabase.rpc('get_household_balance', {
      p_household_id: household.id,
      p_user_id: currentUser.id,
    })
    return (data as HouseholdBalance) ?? { you_are_owed: 0, you_owe: 0, net: 0 }
  }, [supabase, household.id, currentUser.id])

  const fetchMonthExpenses = useCallback(async () => {
    const res = await fetch(`/api/expenses?from=${monthStart}&to=${monthEnd}`)
    const json = await res.json()
    return (json.expenses ?? []) as Expense[]
  }, [monthStart, monthEnd])

  const fetchMonthReceipts = useCallback(async () => {
    const res = await fetch(`/api/receipts?from=${monthStart}&to=${monthEnd}&limit=100`)
    const json = await res.json()
    return (json.receipts ?? []) as ReceiptWithItems[]
  }, [monthStart, monthEnd])

  const fetchRecent = useCallback(async () => {
    const [expRes, recRes] = await Promise.all([
      fetch('/api/expenses'),
      fetch('/api/receipts?limit=5'),
    ])
    const [expJson, recJson] = await Promise.all([expRes.json(), recRes.json()])
    const expenses = ((expJson.expenses ?? []) as Expense[]).slice(0, 3).map(e => ({ ...e, _type: 'expense' as const }))
    const receipts = ((recJson.receipts ?? []) as Receipt[]).slice(0, 2).map(r => ({ ...r, _type: 'receipt' as const }))
    return [...expenses, ...receipts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, 5)
  }, [])

  const { data: balance, refetch: refetchBalance } = useQuery({ queryKey: ['balance'], queryFn: fetchBalance })
  const { data: monthExpenses } = useQuery({ queryKey: ['month-expenses', monthStart], queryFn: fetchMonthExpenses })
  const { data: monthReceipts } = useQuery({ queryKey: ['month-receipts', monthStart], queryFn: fetchMonthReceipts })
  const { data: recent } = useQuery({ queryKey: ['recent-transactions'], queryFn: fetchRecent })

  function handleSettled() {
    refetchBalance()
    queryClient.invalidateQueries({ queryKey: ['recent-transactions'] })
    queryClient.invalidateQueries({ queryKey: ['month-expenses'] })
    queryClient.invalidateQueries({ queryKey: ['month-receipts'] })
  }

  const uid = currentUser.id
  const myMonthExpenses = monthExpenses?.filter(e => e.paid_by === uid) ?? []

  // Receipt metric helpers
  const receipts = monthReceipts ?? []
  const receiptSharedTotal = receipts.reduce((s, r) => {
    if (r.split_mode === 'half') return s + r.total_amount
    if (r.split_mode === 'per_item') {
      const items = r.receipt_items ?? []
      return s + items.filter(i => i.assigned_to === 'shared').reduce((a, i) => a + i.total_price, 0)
    }
    return s
  }, 0)

  const myReceiptPersonal = receipts.reduce((s, r) => {
    const isMine = r.uploaded_by === uid
    if (r.split_mode === 'all_me') return s + (isMine ? r.total_amount : 0)
    if (r.split_mode === 'all_partner') return s + (isMine ? 0 : r.total_amount)
    if (r.split_mode === 'per_item') {
      const items = r.receipt_items ?? []
      const myKey = isMine ? 'user1' : 'user2'
      return s + items.filter(i => i.assigned_to === myKey).reduce((a, i) => a + i.total_price, 0)
    }
    return s
  }, 0)

  const myReceiptShare = receipts.reduce((s, r) => {
    const isMine = r.uploaded_by === uid
    if (r.split_mode === 'half') return s + r.total_amount / 2
    if (r.split_mode === 'all_me') return s + (isMine ? r.total_amount : 0)
    if (r.split_mode === 'all_partner') return s + (isMine ? 0 : r.total_amount)
    // per_item
    const items = r.receipt_items ?? []
    const myKey = isMine ? 'user1' : 'user2'
    const myItems = items.filter(i => i.assigned_to === myKey).reduce((a, i) => a + i.total_price, 0)
    const shared = items.filter(i => i.assigned_to === 'shared').reduce((a, i) => a + i.total_price, 0)
    return s + myItems + shared / 2
  }, 0)

  const totalShared = (monthExpenses?.filter(e => e.expense_type === 'shared').reduce((s, e) => s + e.amount, 0) ?? 0) + receiptSharedTotal
  const myPersonal = myMonthExpenses.filter(e => e.expense_type === 'personal').reduce((s, e) => s + e.amount, 0) + myReceiptPersonal
  const loansOut = monthExpenses?.filter(e => e.expense_type === 'loan' && !e.is_settled).reduce((s, e) => s + e.amount, 0) ?? 0
  const myTotalSpent = myMonthExpenses.reduce((s, e) => s + e.amount, 0) + myReceiptShare

  return (
    <div className="pb-4">
      {/* Household Badge */}
      <div className="px-4 pt-4 flex items-center gap-3">
        <div className="flex -space-x-2">
          <Avatar className="h-8 w-8 border-2 border-white">
            <AvatarFallback style={{ backgroundColor: currentUser.avatar_color }} className="text-white text-xs font-semibold">
              {getInitials(currentUser.display_name)}
            </AvatarFallback>
          </Avatar>
          {partner && (
            <Avatar className="h-8 w-8 border-2 border-white">
              <AvatarFallback style={{ backgroundColor: partner.avatar_color }} className="text-white text-xs font-semibold">
                {getInitials(partner.display_name)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        <div>
          <p className="text-sm font-medium">
            {currentUser.display_name}{partner ? ` & ${partner.display_name}` : ''}
          </p>
          <p className="text-xs text-muted-foreground">{format(now, 'MMMM yyyy')}</p>
        </div>
      </div>

      {/* Balance Banner */}
      {balance ? (
        <BalanceBanner
          balance={balance}
          partnerName={partner?.display_name ?? null}
          onSettled={handleSettled}
        />
      ) : (
        <div className="mx-4 mt-4">
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      )}

      {/* No friend yet nudge */}
      {!partner && (
        <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm text-amber-800 font-medium">Invite your friend</p>
          <p className="text-xs text-amber-700 mt-0.5">Tap your avatar above to copy the invite code</p>
        </div>
      )}

      {/* Month Progress */}
      {monthExpenses && myTotalSpent > 0 && (
        <MonthProgressBar spent={myTotalSpent} daysElapsed={daysElapsed} daysTotal={daysTotal} />
      )}

      {/* Metric Cards */}
      {monthExpenses ? (
        <MetricCards totalShared={totalShared} myPersonal={myPersonal} loansOutstanding={loansOut} />
      ) : (
        <div className="px-4 mt-4 grid grid-cols-3 gap-2">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      )}

      {/* Recent Activity */}
      <div className="px-4 mt-5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-700">Recent Activity</h2>
        {recent && recent.length > 0 && (
          <span className="text-xs text-muted-foreground">{recent.length} items</span>
        )}
      </div>
      {recent ? (
        <RecentTransactions transactions={recent} currentUserId={currentUser.id} />
      ) : (
        <div className="mx-4 space-y-2">
          {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      )}
    </div>
  )
}
