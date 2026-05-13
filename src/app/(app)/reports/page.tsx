'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useHousehold } from '@/context/HouseholdContext'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Download } from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts'
import type { Expense, ReceiptWithItems } from '@/lib/types'
import { getCategoryLabel } from '@/components/expenses/CategoryIcon'
import { format, eachDayOfInterval, parseISO } from 'date-fns'

type Period = 'week' | 'month' | 'quarter'

const CHART_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6b7280',
]

function getMyReceiptShare(receipt: ReceiptWithItems, currentUserId: string): number {
  const isMine = receipt.uploaded_by === currentUserId
  if (receipt.split_mode === 'half') return receipt.total_amount / 2
  if (receipt.split_mode === 'all_me') return isMine ? receipt.total_amount : 0
  if (receipt.split_mode === 'all_partner') return isMine ? 0 : receipt.total_amount
  // per_item
  const items = receipt.receipt_items ?? []
  const sharedTotal = items.filter(i => i.assigned_to === 'shared').reduce((s, i) => s + i.total_price, 0)
  if (isMine) {
    return items.filter(i => i.assigned_to === 'user1').reduce((s, i) => s + i.total_price, 0) + sharedTotal / 2
  }
  return items.filter(i => i.assigned_to === 'user2').reduce((s, i) => s + i.total_price, 0) + sharedTotal / 2
}

type SpendingEntry = { date: string; amount: number; category: string; expense_type: string }

function groupByCategory(items: SpendingEntry[]) {
  const map: Record<string, number> = {}
  for (const e of items) {
    const label = getCategoryLabel(e.category)
    map[label] = (map[label] ?? 0) + e.amount
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

function buildTimeline(items: SpendingEntry[], from: string, to: string) {
  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) })
  return days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const total = items
      .filter(e => e.date === dateStr)
      .reduce((s, e) => s + e.amount, 0)
    return { date: format(day, 'dd/MM'), total }
  })
}

export default function ReportsPage() {
  const { currentUser } = useHousehold()
  const [period, setPeriod] = useState<Period>('month')

  const { data, isLoading } = useQuery({
    queryKey: ['reports', period, currentUser.id],
    queryFn: async () => {
      const res = await fetch(`/api/reports?period=${period}`)
      return res.json() as Promise<{
        period: { from: string; to: string }
        expenses: Expense[]
        receipts: ReceiptWithItems[]
      }>
    },
  })

  const allExpenses = data?.expenses ?? []
  const allReceipts = data?.receipts ?? []
  const from = data?.period.from ?? ''
  const to = data?.period.to ?? ''

  const myExpenses = allExpenses.filter(e => e.paid_by === currentUser.id)

  // Convert receipts to spending entries (only where my share > 0)
  const receiptEntries: SpendingEntry[] = allReceipts
    .map(r => ({ date: r.receipt_date, amount: getMyReceiptShare(r, currentUser.id), category: 'groceries', expense_type: 'groceries' }))
    .filter(r => r.amount > 0)

  const expenseEntries: SpendingEntry[] = myExpenses.map(e => ({
    date: e.expense_date,
    amount: e.amount,
    category: e.category,
    expense_type: e.expense_type,
  }))

  const allItems = [...expenseEntries, ...receiptEntries]

  const myTotal = allItems.reduce((s, e) => s + e.amount, 0)
  const myPersonal = expenseEntries.filter(e => e.expense_type === 'personal').reduce((s, e) => s + e.amount, 0)
  const myShared = expenseEntries.filter(e => e.expense_type === 'shared').reduce((s, e) => s + e.amount, 0)
  const myLoans = expenseEntries.filter(e => e.expense_type === 'loan').reduce((s, e) => s + e.amount, 0)
  const myGroceries = receiptEntries.reduce((s, e) => s + e.amount, 0)

  const categoryData = groupByCategory(allItems)
  const timelineData = from && to ? buildTimeline(allItems, from, to) : []

  function exportCSV() {
    const expenseRows = myExpenses.map(e => [
      e.expense_date, e.description, getCategoryLabel(e.category),
      e.amount.toFixed(2), e.expense_type,
    ])
    const receiptRows = allReceipts
      .filter(r => getMyReceiptShare(r, currentUser.id) > 0)
      .map(r => [
        r.receipt_date, r.store_name, 'Groceries',
        getMyReceiptShare(r, currentUser.id).toFixed(2), 'receipt',
      ])
    const rows = [
      ['Date', 'Description', 'Category', 'My Amount', 'Type'],
      ...expenseRows,
      ...receiptRows,
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `my-spending-${period}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalItems = myExpenses.length + receiptEntries.length

  return (
    <div className="pb-4 space-y-4">
      <div className="px-4 pt-4">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList className="w-full">
            <TabsTrigger value="week" className="flex-1">Week</TabsTrigger>
            <TabsTrigger value="month" className="flex-1">Month</TabsTrigger>
            <TabsTrigger value="quarter" className="flex-1">Quarter</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="px-4 space-y-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="px-4 grid grid-cols-2 gap-2">
            {[
              { label: 'My Total', value: myTotal, color: 'text-indigo-600' },
              { label: 'Transactions', value: totalItems, color: 'text-zinc-600', noFormat: true },
              { label: 'Groceries', value: myGroceries, color: 'text-emerald-600' },
              { label: 'Expenses', value: myPersonal + myShared + myLoans, color: 'text-amber-600' },
            ].map(({ label, value, color, noFormat }) => (
              <Card key={label} className="shadow-none border-zinc-100">
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                  <p className={`text-lg font-bold mt-0.5 ${color}`}>
                    {noFormat ? value : formatCurrency(value as number)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Category Donut */}
          {categoryData.length > 0 && (
            <div className="px-4">
              <Card className="shadow-none border-zinc-100">
                <CardContent className="p-4">
                  <p className="font-semibold text-sm mb-3">Spending by Category</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {categoryData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Spending Timeline */}
          {timelineData.length > 0 && timelineData.some(d => d.total > 0) && (
            <div className="px-4">
              <Card className="shadow-none border-zinc-100">
                <CardContent className="p-4">
                  <p className="font-semibold text-sm mb-3">Daily Spending</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(timelineData.length / 5)} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} width={40} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} dot={false} name="My Spending" isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Spending Breakdown Bar */}
          {allItems.length > 0 && (
            <div className="px-4">
              <Card className="shadow-none border-zinc-100">
                <CardContent className="p-4">
                  <p className="font-semibold text-sm mb-3">Spending Breakdown</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={[{
                      name: 'This Period',
                      Personal: myPersonal,
                      Shared: myShared,
                      Loans: myLoans,
                      Groceries: myGroceries,
                    }]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} width={40} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="Groceries" fill="#10b981" isAnimationActive={false} />
                      <Bar dataKey="Personal" fill="#6b7280" isAnimationActive={false} />
                      <Bar dataKey="Shared" fill="#6366f1" isAnimationActive={false} />
                      <Bar dataKey="Loans" fill="#f59e0b" isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Export */}
          {allItems.length > 0 && (
            <div className="px-4">
              <Button variant="outline" className="w-full" onClick={exportCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export My Spending (CSV)
              </Button>
            </div>
          )}

          {allItems.length === 0 && (
            <div className="py-16 text-center px-4">
              <p className="font-medium text-zinc-600">No data for this period</p>
              <p className="text-sm text-muted-foreground mt-1">Add expenses or grocery receipts to see your reports</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
