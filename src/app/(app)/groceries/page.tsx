'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AddReceiptSheet } from '@/components/receipts/AddReceiptSheet'
import { formatCurrency, formatSmartDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, ShoppingCart, CheckCircle2, Clock, Package } from 'lucide-react'
import Link from 'next/link'
import { useHousehold } from '@/context/HouseholdContext'
import type { ReceiptWithItems } from '@/lib/types'

type Filter = 'all' | 'unsettled' | 'mine' | 'friend'

const SPLIT_LABELS: Record<string, string> = {
  half: '50/50',
  per_item: 'Per Item',
  all_me: 'All Mine',
  all_partner: "All Friend's",
}

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  unsettled: 'Unsettled',
  mine: 'Mine',
  friend: "Friend's",
}

export default function GroceriesPage() {
  const { currentUser } = useHousehold()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['receipts'],
    queryFn: async () => {
      const res = await fetch('/api/receipts?limit=50')
      const json = await res.json()
      return (json.receipts ?? []) as ReceiptWithItems[]
    },
  })

  const all = data ?? []
  const unsettledCount = all.filter(r => !r.is_settled).length

  const filtered = all.filter(r => {
    if (filter === 'unsettled') return !r.is_settled
    if (filter === 'mine') return r.uploaded_by === currentUser.id
    if (filter === 'friend') return r.uploaded_by !== currentUser.id
    return true
  })

  return (
    <div className="pb-4">
      {/* Filter bar */}
      <div className="px-4 pt-4 flex gap-2 overflow-x-auto no-scrollbar">
        {(['all', 'unsettled', 'mine', 'friend'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${filter === f ? 'bg-indigo-600 text-white' : 'bg-white border border-zinc-200 text-zinc-600'}`}
          >
            {FILTER_LABELS[f]}
            {f === 'unsettled' && unsettledCount > 0 && (
              <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none ${filter === 'unsettled' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-600'}`}>
                {unsettledCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Summary bar */}
      {!isLoading && all.length > 0 && (
        <div className="px-4 mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span>{all.length} receipt{all.length !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{formatCurrency(all.reduce((s, r) => s + r.total_amount, 0))} total</span>
          {unsettledCount > 0 && (
            <>
              <span>·</span>
              <span className="text-rose-500 font-medium">{unsettledCount} unsettled</span>
            </>
          )}
        </div>
      )}

      {/* List */}
      <div className="px-4 mt-3 space-y-3">
        {isLoading ? (
          [0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingCart className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
            <p className="font-medium text-zinc-600">
              {filter === 'all' ? 'No receipts yet' : `No ${FILTER_LABELS[filter].toLowerCase()} receipts`}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === 'all' ? 'Tap + to add your first receipt' : 'Try a different filter'}
            </p>
            {filter === 'all' && (
              <Button className="mt-4 bg-indigo-600 hover:bg-indigo-700" onClick={() => setSheetOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Receipt
              </Button>
            )}
          </div>
        ) : (
          filtered.map(receipt => {
            const itemCount = receipt.receipt_items?.length ?? 0
            const isMine = receipt.uploaded_by === currentUser.id
            return (
              <Link key={receipt.id} href={`/groceries/${receipt.id}`}>
                <div className="bg-white border border-zinc-100 rounded-xl p-4 hover:border-indigo-200 transition-colors active:scale-[0.99]">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{receipt.store_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatSmartDate(receipt.receipt_date)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
                      <p className="font-bold text-base">{formatCurrency(receipt.total_amount)}</p>
                      {receipt.is_settled ? (
                        <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Settled
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] bg-rose-50 text-rose-600">
                          <Clock className="h-2.5 w-2.5 mr-0.5" />Unsettled
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">{SPLIT_LABELS[receipt.split_mode]}</Badge>
                    {itemCount > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Package className="h-3 w-3" />
                        {itemCount} item{itemCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {isMine ? 'You uploaded' : 'Friend uploaded'}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* FAB */}
      <Button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700 p-0"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <AddReceiptSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
