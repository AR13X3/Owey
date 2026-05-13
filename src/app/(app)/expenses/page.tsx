'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AddExpenseSheet } from '@/components/expenses/AddExpenseSheet'
import { CategoryIcon, getCategoryLabel } from '@/components/expenses/CategoryIcon'
import { formatCurrency, formatSmartDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Plus, Receipt, Trash2, Search, X, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { useHousehold } from '@/context/HouseholdContext'
import Link from 'next/link'
import type { Expense, ReceiptWithItems } from '@/lib/types'

const TYPE_BADGE: Record<string, { label: string; class: string }> = {
  personal: { label: 'Personal', class: 'bg-zinc-100 text-zinc-600' },
  shared:   { label: 'Shared',   class: 'bg-indigo-100 text-indigo-700' },
  loan:     { label: 'Lent',     class: 'bg-amber-100 text-amber-700' },
}

// Full share of the receipt for the current user
function getMyReceiptShare(r: ReceiptWithItems, uid: string): number {
  const isMine = r.uploaded_by === uid
  if (r.split_mode === 'half') return r.total_amount / 2
  if (r.split_mode === 'all_me') return isMine ? r.total_amount : 0
  if (r.split_mode === 'all_partner') return isMine ? 0 : r.total_amount
  // per_item
  const items = r.receipt_items ?? []
  const myKey = isMine ? 'user1' : 'user2'
  const myItems = items.filter(i => i.assigned_to === myKey).reduce((s, i) => s + i.total_price, 0)
  const sharedHalf = items.filter(i => i.assigned_to === 'shared').reduce((s, i) => s + i.total_price, 0) / 2
  return myItems + sharedHalf
}

// Only my personally assigned items (no shared items)
function getMyPersonalReceiptAmount(r: ReceiptWithItems, uid: string): number {
  const isMine = r.uploaded_by === uid
  if (r.split_mode === 'all_me') return isMine ? r.total_amount : 0
  if (r.split_mode === 'all_partner') return isMine ? 0 : r.total_amount
  if (r.split_mode === 'half') return 0
  // per_item: only items assigned to me
  const items = r.receipt_items ?? []
  const myKey = isMine ? 'user1' : 'user2'
  return items.filter(i => i.assigned_to === myKey).reduce((s, i) => s + i.total_price, 0)
}

// Only my half of shared/split items
function getMySharedReceiptAmount(r: ReceiptWithItems): number {
  if (r.split_mode === 'half') return r.total_amount / 2
  if (r.split_mode === 'all_me' || r.split_mode === 'all_partner') return 0
  // per_item: only half of shared items
  const items = r.receipt_items ?? []
  const sharedTotal = items.filter(i => i.assigned_to === 'shared').reduce((s, i) => s + i.total_price, 0)
  return sharedTotal / 2
}

type UnifiedItem =
  | ({ _kind: 'expense' } & Expense)
  | ({ _kind: 'receipt'; displayAmount: number } & ReceiptWithItems)

function SummaryBar({ count, total }: { count: number; total: number }) {
  if (count === 0) return null
  return (
    <div className="px-4 py-2 flex items-center gap-3 text-xs text-muted-foreground border-b border-zinc-100 bg-zinc-50/50">
      <span>{count} item{count !== 1 ? 's' : ''}</span>
      <span>·</span>
      <span className="font-medium text-zinc-700">{formatCurrency(total)}</span>
    </div>
  )
}

function UnifiedList({ items, currentUserId, onDeleteExpense, searchQuery }: {
  items: UnifiedItem[]
  currentUserId: string
  onDeleteExpense: (id: string) => void
  searchQuery: string
}) {
  const filtered = searchQuery.trim()
    ? items.filter(i => {
        if (i._kind === 'expense') {
          return i.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            getCategoryLabel(i.category).toLowerCase().includes(searchQuery.toLowerCase())
        }
        return i.store_name.toLowerCase().includes(searchQuery.toLowerCase())
      })
    : items

  if (filtered.length === 0) {
    return (
      <div className="py-16 text-center">
        <Receipt className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
        <p className="font-medium text-zinc-600">
          {searchQuery ? 'No matches found' : 'No expenses here'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {searchQuery ? `No results matching "${searchQuery}"` : 'Tap + to add an expense'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2 px-4 mt-2">
      {filtered.map(item => {
        if (item._kind === 'receipt') {
          return (
            <Link
              key={`r-${item.id}`}
              href={`/groceries/${item.id}`}
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-zinc-100 active:scale-[0.99] transition-transform"
            >
              <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.store_name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-muted-foreground">{formatSmartDate(item.receipt_date)}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">Groceries</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <p className="text-sm font-bold text-zinc-800">{formatCurrency(item.displayAmount)}</p>
                <Badge variant="secondary" className="text-[10px] py-0 bg-emerald-100 text-emerald-700">
                  Groceries
                </Badge>
              </div>
              <div className="w-7 flex-shrink-0" />
            </Link>
          )
        }

        const isMine = item.paid_by === currentUserId
        const badge = TYPE_BADGE[item.expense_type]
        return (
          <div key={`e-${item.id}`} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-zinc-100 active:scale-[0.99] transition-transform">
            <div className="w-9 h-9 rounded-full bg-zinc-50 flex items-center justify-center flex-shrink-0">
              <CategoryIcon category={item.category} className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.description}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-xs text-muted-foreground">{formatSmartDate(item.expense_date)}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">{getCategoryLabel(item.category)}</span>
                {!isMine && (
                  <>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-rose-500 font-medium">Friend paid</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <p className={`text-sm font-bold ${isMine ? 'text-zinc-800' : 'text-rose-400'}`}>
                {formatCurrency(item.amount)}
              </p>
              <Badge variant="secondary" className={`text-[10px] py-0 ${badge.class}`}>
                {badge.label}
              </Badge>
            </div>
            <button
              onClick={() => onDeleteExpense(item.id)}
              className="p-1.5 text-zinc-300 hover:text-rose-500 flex-shrink-0 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default function ExpensesPage() {
  const { currentUser } = useHousehold()
  const queryClient = useQueryClient()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { data: expenseData, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const res = await fetch('/api/expenses')
      const json = await res.json()
      return (json.expenses ?? []) as Expense[]
    },
  })

  const { data: receiptData, isLoading: receiptsLoading } = useQuery({
    queryKey: ['receipts'],
    queryFn: async () => {
      const res = await fetch('/api/receipts')
      const json = await res.json()
      return (json.receipts ?? []) as ReceiptWithItems[]
    },
  })

  const isLoading = expensesLoading || receiptsLoading

  async function handleDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/expenses?id=${deleteId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Expense deleted')
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['balance'] })
      queryClient.invalidateQueries({ queryKey: ['recent-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['month-expenses'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    } else {
      toast.error('Failed to delete')
    }
    setDeleteId(null)
  }

  const expenses = useMemo(() => expenseData ?? [], [expenseData])
  const receipts = useMemo(() => receiptData ?? [], [receiptData])

  const uid = currentUser.id

  // Pre-compute receipt amounts once
  const receiptsWithAmounts = useMemo(() => receipts.map(r => ({
    receipt: r,
    total: getMyReceiptShare(r, uid),
    personal: getMyPersonalReceiptAmount(r, uid),
    shared: getMySharedReceiptAmount(r),
  })), [receipts, uid])

  // All tab: expenses + receipts (my full share), sorted by date desc
  const allItems = useMemo((): UnifiedItem[] => {
    const expItems: UnifiedItem[] = expenses.map(e => ({ ...e, _kind: 'expense' as const }))
    const recItems: UnifiedItem[] = receiptsWithAmounts
      .filter(r => r.total > 0)
      .map(r => ({ ...r.receipt, _kind: 'receipt' as const, displayAmount: r.total }))
    return [...expItems, ...recItems].sort((a, b) => {
      const dA = a._kind === 'expense' ? a.expense_date : a.receipt_date
      const dB = b._kind === 'expense' ? b.expense_date : b.receipt_date
      return new Date(dB).getTime() - new Date(dA).getTime()
    })
  }, [expenses, receiptsWithAmounts])

  // Personal tab: personal expenses + receipt rows for my own items
  const personalItems = useMemo((): UnifiedItem[] => {
    const expItems: UnifiedItem[] = expenses
      .filter(e => e.expense_type === 'personal')
      .map(e => ({ ...e, _kind: 'expense' as const }))
    const recItems: UnifiedItem[] = receiptsWithAmounts
      .filter(r => r.personal > 0)
      .map(r => ({ ...r.receipt, _kind: 'receipt' as const, displayAmount: r.personal }))
    return [...expItems, ...recItems].sort((a, b) => {
      const dA = a._kind === 'expense' ? a.expense_date : a.receipt_date
      const dB = b._kind === 'expense' ? b.expense_date : b.receipt_date
      return new Date(dB).getTime() - new Date(dA).getTime()
    })
  }, [expenses, receiptsWithAmounts])

  // Shared tab: shared expenses + receipt rows for my share of shared items
  const sharedItems = useMemo((): UnifiedItem[] => {
    const expItems: UnifiedItem[] = expenses
      .filter(e => e.expense_type === 'shared')
      .map(e => ({ ...e, _kind: 'expense' as const }))
    const recItems: UnifiedItem[] = receiptsWithAmounts
      .filter(r => r.shared > 0)
      .map(r => ({ ...r.receipt, _kind: 'receipt' as const, displayAmount: r.shared }))
    return [...expItems, ...recItems].sort((a, b) => {
      const dA = a._kind === 'expense' ? a.expense_date : a.receipt_date
      const dB = b._kind === 'expense' ? b.expense_date : b.receipt_date
      return new Date(dB).getTime() - new Date(dA).getTime()
    })
  }, [expenses, receiptsWithAmounts])

  // Loans tab: loan expenses only
  const loanItems = useMemo((): UnifiedItem[] =>
    expenses.filter(e => e.expense_type === 'loan').map(e => ({ ...e, _kind: 'expense' as const })),
  [expenses])

  const allTotal = allItems.reduce((s, i) => s + (i._kind === 'expense' ? i.amount : i.displayAmount), 0)
  const personalTotal = personalItems.reduce((s, i) => s + (i._kind === 'expense' ? i.amount : i.displayAmount), 0)
  const sharedTotal = sharedItems.reduce((s, i) => s + (i._kind === 'expense' ? i.amount : i.displayAmount), 0)
  const loanTotal = loanItems.reduce((s, e) => s + (e as { _kind: 'expense' } & Expense).amount, 0)

  const skeleton = (
    <div className="space-y-2 px-4 mt-2">
      {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
    </div>
  )

  return (
    <div className="pb-4">
      {/* Search bar */}
      <div className="px-4 pt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search expenses…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-9 h-10"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <Tabs defaultValue="all" className="mt-3">
        <TabsList className="w-full mx-4 max-w-[calc(100%-2rem)]">
          <TabsTrigger value="all" className="flex-1">
            All {allItems.length > 0 && <span className="ml-1 text-[10px] opacity-60">{allItems.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="personal" className="flex-1">
            Personal {personalItems.length > 0 && <span className="ml-1 text-[10px] opacity-60">{personalItems.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="shared" className="flex-1">
            Shared {sharedItems.length > 0 && <span className="ml-1 text-[10px] opacity-60">{sharedItems.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="loans" className="flex-1">
            Loans {loanItems.length > 0 && <span className="ml-1 text-[10px] opacity-60">{loanItems.length}</span>}
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="mt-2">{skeleton}</div>
        ) : (
          <>
            <TabsContent value="all">
              <SummaryBar count={allItems.length} total={allTotal} />
              <UnifiedList items={allItems} currentUserId={uid} onDeleteExpense={setDeleteId} searchQuery={search} />
            </TabsContent>
            <TabsContent value="personal">
              <SummaryBar count={personalItems.length} total={personalTotal} />
              <UnifiedList items={personalItems} currentUserId={uid} onDeleteExpense={setDeleteId} searchQuery={search} />
            </TabsContent>
            <TabsContent value="shared">
              <SummaryBar count={sharedItems.length} total={sharedTotal} />
              <UnifiedList items={sharedItems} currentUserId={uid} onDeleteExpense={setDeleteId} searchQuery={search} />
            </TabsContent>
            <TabsContent value="loans">
              <SummaryBar count={loanItems.length} total={loanTotal} />
              <UnifiedList items={loanItems} currentUserId={uid} onDeleteExpense={setDeleteId} searchQuery={search} />
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* FAB */}
      <Button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700 p-0"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <AddExpenseSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />

      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
