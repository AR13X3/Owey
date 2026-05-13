'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CategoryIcon, CATEGORY_LIST } from '@/components/expenses/CategoryIcon'
import { useHousehold } from '@/context/HouseholdContext'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { todayISO, cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import type { ExpenseType } from '@/lib/types'

const TYPE_OPTIONS: { value: ExpenseType; label: string; desc: string; emoji: string }[] = [
  { value: 'personal',  label: 'Personal',    desc: 'Just me — no split',       emoji: '👤' },
  { value: 'shared',    label: 'Shared Bill',  desc: 'We split 50/50',            emoji: '🤝' },
  { value: 'loan',      label: 'I Lent',       desc: 'Friend owes me',            emoji: '💸' },
]

const schema = z.object({
  expense_type: z.enum(['personal', 'shared', 'loan']),
  category: z.string().min(1, 'Pick a category'),
  amount: z.coerce.number().min(0.01, 'Amount must be > 0'),
  description: z.string().min(1, 'Enter a description'),
  expense_date: z.string().min(1),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
}

export function AddExpenseSheet({ open, onClose }: Props) {
  const { partner } = useHousehold()
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      expense_type: 'personal',
      category: '',
      amount: undefined,
      description: '',
      expense_date: todayISO(),
      notes: '',
    },
  })

  const expenseType = watch('expense_type')
  const selectedCategory = watch('category')

  function handleClose() {
    reset()
    onClose()
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true)

    const body: Record<string, unknown> = {
      expense_type: values.expense_type,
      category: values.category,
      amount: values.amount,
      description: values.description,
      expense_date: values.expense_date,
      notes: values.notes || null,
    }

    if (values.expense_type === 'shared' && partner) {
      body.split_with = partner.id
    }
    if (values.expense_type === 'loan' && partner) {
      body.loan_to = partner.id
    }

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setSubmitting(false)

    if (!res.ok) {
      toast.error('Failed to save expense')
      return
    }

    toast.success('Expense added!')
    queryClient.invalidateQueries({ queryKey: ['expenses'] })
    queryClient.invalidateQueries({ queryKey: ['balance'] })
    queryClient.invalidateQueries({ queryKey: ['month-expenses'] })
    queryClient.invalidateQueries({ queryKey: ['recent-transactions'] })
    queryClient.invalidateQueries({ queryKey: ['reports'] })
    handleClose()
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="bottom" className="h-[92vh] flex flex-col pb-safe">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>Add Expense</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto mt-4 space-y-5">
          {/* Expense Type */}
          <div>
            <Label className="mb-2 block text-sm font-medium">Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setValue('expense_type', opt.value)}
                  className={cn(
                    'flex flex-col items-center p-3 rounded-xl border-2 text-center transition-colors',
                    expenseType === opt.value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  )}
                >
                  <span className="text-2xl mb-1">{opt.emoji}</span>
                  <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{opt.desc}</span>
                </button>
              ))}
            </div>
            {expenseType === 'loan' && !partner && (
              <p className="text-xs text-amber-600 mt-2">No friend yet — invite a friend to your household first to record loans</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
              <Input
                {...register('amount')}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                className={cn('pl-7 text-xl h-14 font-bold', errors.amount && 'border-rose-400')}
              />
            </div>
            {errors.amount && <p className="text-xs text-rose-500">{errors.amount.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              {...register('description')}
              placeholder="What was this for?"
              className={errors.description ? 'border-rose-400' : ''}
            />
            {errors.description && <p className="text-xs text-rose-500">{errors.description.message}</p>}
          </div>

          {/* Category */}
          <div>
            <Label className="mb-2 block">Category</Label>
            <div className="grid grid-cols-5 gap-2">
              {CATEGORY_LIST.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setValue('category', cat.key)}
                  className={cn(
                    'flex flex-col items-center p-2 rounded-xl border transition-colors',
                    selectedCategory === cat.key
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-zinc-200 bg-white'
                  )}
                >
                  <CategoryIcon category={cat.key} className="h-5 w-5" />
                  <span className="text-[9px] mt-0.5 text-center leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
            {errors.category && <p className="text-xs text-rose-500 mt-1">{errors.category.message}</p>}
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input {...register('expense_date')} type="date" />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea {...register('notes')} placeholder="Any extra details..." className="resize-none" rows={2} />
          </div>

          <Button type="submit" className="w-full h-12 mt-2" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Expense
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
