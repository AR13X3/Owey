'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatCurrency, formatDate, formatSmartDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ChevronLeft, Trash2, CheckCircle2, Clock } from 'lucide-react'
import { useHousehold } from '@/context/HouseholdContext'
import type { ReceiptWithItems } from '@/lib/types'

const SPLIT_LABELS: Record<string, string> = {
  half: 'Split 50/50',
  per_item: 'Per Item',
  all_me: 'All Mine',
  all_partner: "All Friend's",
}

const ASSIGN_LABELS: Record<string, string> = {
  shared: 'Shared',
  user1: 'Mine',
  user2: "Friend's",
}

export default function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { currentUser } = useHousehold()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: receipt, isLoading } = useQuery({
    queryKey: ['receipt', id],
    queryFn: async () => {
      const res = await fetch(`/api/receipts/${id}`)
      if (!res.ok) return null
      return (await res.json()) as ReceiptWithItems
    },
  })

  async function toggleSettled() {
    if (!receipt) return
    const res = await fetch(`/api/receipts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_settled: !receipt.is_settled }),
    })
    if (res.ok) {
      toast.success(receipt.is_settled ? 'Marked as unsettled' : 'Marked as settled')
      queryClient.invalidateQueries({ queryKey: ['receipt', id] })
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['balance'] })
      queryClient.invalidateQueries({ queryKey: ['recent-transactions'] })
    }
  }

  async function handleDelete() {
    const res = await fetch(`/api/receipts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Receipt deleted')
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['balance'] })
      router.push('/groceries')
    } else {
      toast.error('Failed to delete')
    }
    setDeleteOpen(false)
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (!receipt) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Receipt not found</p>
        <Button onClick={() => router.push('/groceries')} variant="ghost" className="mt-2">
          Back to Groceries
        </Button>
      </div>
    )
  }

  const items = receipt.receipt_items ?? []
  const isMine = receipt.uploaded_by === currentUser.id

  // Compute split
  const totalAmount = receipt.total_amount
  let myShare = 0
  let partnerShare = 0

  if (receipt.split_mode === 'half') {
    myShare = totalAmount / 2
    partnerShare = totalAmount / 2
  } else if (receipt.split_mode === 'all_me') {
    myShare = isMine ? totalAmount : 0
    partnerShare = isMine ? 0 : totalAmount
  } else if (receipt.split_mode === 'all_partner') {
    myShare = isMine ? 0 : totalAmount
    partnerShare = isMine ? totalAmount : 0
  } else {
    // per_item
    const sharedTotal = items.filter(i => i.assigned_to === 'shared').reduce((s, i) => s + i.total_price, 0)
    myShare = items.filter(i => i.assigned_to === 'user1').reduce((s, i) => s + i.total_price, 0) + sharedTotal / 2
    partnerShare = items.filter(i => i.assigned_to === 'user2').reduce((s, i) => s + i.total_price, 0) + sharedTotal / 2
  }

  return (
    <div className="pb-4">
      <div className="px-4 pt-4">
        <button onClick={() => router.push('/groceries')} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{receipt.store_name}</h1>
            <p className="text-sm text-muted-foreground">{formatSmartDate(receipt.receipt_date)} · {formatDate(receipt.receipt_date)}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
            <Badge variant="secondary" className="mt-1">{SPLIT_LABELS[receipt.split_mode]}</Badge>
          </div>
        </div>

        {/* Settled toggle */}
        <div className="flex items-center gap-3 mt-4 p-4 bg-white rounded-xl border border-zinc-100">
          {receipt.is_settled ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : (
            <Clock className="h-5 w-5 text-amber-500" />
          )}
          <Label htmlFor="settled" className="flex-1 font-medium">
            {receipt.is_settled ? 'Settled' : 'Unsettled'}
          </Label>
          <Switch id="settled" checked={receipt.is_settled} onCheckedChange={toggleSettled} />
        </div>

        {/* Split summary */}
        <div className="mt-3 bg-white rounded-xl border border-zinc-100 p-4 space-y-2 text-sm">
          <p className="font-semibold">Split Summary</p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Your share</span>
            <span className="font-semibold text-indigo-600">{formatCurrency(myShare)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Friend&apos;s share</span>
            <span className="font-semibold text-amber-600">{formatCurrency(partnerShare)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Uploaded by</span>
            <span>{isMine ? 'You' : 'Friend'}</span>
          </div>
        </div>

        {/* Items */}
        <div className="mt-4">
          <p className="font-semibold mb-2">Items ({items.length})</p>
          <div className="bg-white rounded-xl border border-zinc-100 divide-y divide-zinc-100">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.quantity} × {formatCurrency(item.unit_price)}</p>
                </div>
                <Badge
                  variant="secondary"
                  className={`text-[10px] flex-shrink-0 ${item.assigned_to === 'user1' ? 'bg-indigo-50 text-indigo-700' : item.assigned_to === 'user2' ? 'bg-amber-50 text-amber-700' : ''}`}
                >
                  {ASSIGN_LABELS[item.assigned_to]}
                </Badge>
                <span className="text-sm font-semibold flex-shrink-0">{formatCurrency(item.total_price)}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-4" />

        <Button
          variant="destructive"
          className="w-full"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Receipt
        </Button>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Receipt?</DialogTitle>
            <DialogDescription>
              This will permanently delete the receipt from {receipt.store_name} and all its items. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
