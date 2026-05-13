'use client'

import { useState } from 'react'
import { useHousehold } from '@/context/HouseholdContext'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  netBalance: number
  onSettled: () => void
}

export function SettleUpSheet({ open, onClose, netBalance, onSettled }: Props) {
  const { partner } = useHousehold()
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState(Math.abs(netBalance).toFixed(2))
  const [notes, setNotes] = useState('')

  async function handleSettle() {
    if (!partner) { toast.error('No friend in household yet'); return }
    const num = parseFloat(amount)
    if (isNaN(num) || num <= 0) { toast.error('Enter a valid amount'); return }

    setLoading(true)
    const res = await fetch('/api/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paid_to: partner.id,
        amount: num,
        notes: notes || null,
      }),
    })
    setLoading(false)

    if (!res.ok) {
      toast.error('Failed to record settlement')
      return
    }
    toast.success('Settlement recorded!')
    onSettled()
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="pb-safe">
        <SheetHeader>
          <SheetTitle>Settle Up</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {partner ? (
            <p className="text-sm text-muted-foreground">
              Recording payment to <strong>{partner.display_name}</strong> (your friend)
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No friend in household yet</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="settle-amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="settle-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7 text-lg h-12"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settle-notes">Notes (optional)</Label>
            <Input
              id="settle-notes"
              placeholder="e.g. bank transfer"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button onClick={handleSettle} className="w-full h-12" disabled={loading || !partner}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Mark as Settled
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
