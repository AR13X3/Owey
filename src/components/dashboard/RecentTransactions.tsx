import Link from 'next/link'
import { formatCurrency, formatSmartDate } from '@/lib/utils'
import type { Expense, Receipt } from '@/lib/types'
import { ShoppingCart, CheckCircle2 } from 'lucide-react'
import { CategoryIcon } from '@/components/expenses/CategoryIcon'

type Transaction =
  | ({ _type: 'expense' } & Expense)
  | ({ _type: 'receipt' } & Receipt)

interface Props {
  transactions: Transaction[]
  currentUserId: string
}

const EXPENSE_TYPE_LABEL: Record<string, string> = {
  personal: 'Personal',
  shared: 'Shared',
  loan: 'Lent',
}

export function RecentTransactions({ transactions, currentUserId }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="mx-4 mt-2 py-10 text-center bg-white rounded-xl border border-zinc-100">
        <p className="text-muted-foreground text-sm font-medium">No recent activity</p>
        <p className="text-xs text-muted-foreground mt-1">Add an expense or receipt to get started</p>
      </div>
    )
  }

  return (
    <div className="mx-4 mt-2 space-y-1.5">
      {transactions.map((t) => {
        if (t._type === 'receipt') {
          return (
            <Link key={`r-${t.id}`} href={`/groceries/${t.id}`} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-zinc-100 hover:border-indigo-200 transition-colors active:scale-[0.99]">
              <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{t.store_name}</p>
                <p className="text-xs text-muted-foreground">{formatSmartDate(t.receipt_date)}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold">{formatCurrency(t.total_amount)}</p>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  {t.is_settled && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                  <p className="text-[10px] text-muted-foreground">Receipt</p>
                </div>
              </div>
            </Link>
          )
        }

        const isMine = t.paid_by === currentUserId
        return (
          <div key={`e-${t.id}`} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-zinc-100">
            <div className="w-9 h-9 rounded-full bg-zinc-50 flex items-center justify-center flex-shrink-0">
              <CategoryIcon category={t.category} className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{t.description}</p>
              <p className="text-xs text-muted-foreground">{formatSmartDate(t.expense_date)}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`text-sm font-semibold ${isMine ? 'text-zinc-800' : 'text-rose-500'}`}>
                {formatCurrency(t.amount)}
              </p>
              <p className="text-[10px] text-muted-foreground">{EXPENSE_TYPE_LABEL[t.expense_type] ?? t.expense_type}</p>
            </div>
          </div>
        )
      })}
      <div className="flex gap-2 pt-1">
        <Link href="/expenses" className="flex-1 text-center text-sm text-indigo-600 font-medium py-2 rounded-xl border border-zinc-100 bg-white hover:border-indigo-200 transition-colors">
          Expenses →
        </Link>
        <Link href="/groceries" className="flex-1 text-center text-sm text-indigo-600 font-medium py-2 rounded-xl border border-zinc-100 bg-white hover:border-indigo-200 transition-colors">
          Groceries →
        </Link>
      </div>
    </div>
  )
}
