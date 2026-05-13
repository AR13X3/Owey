import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format, parseISO, differenceInCalendarDays } from 'date-fns'
import type { Expense } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  return formatDistanceToNow(date, { addSuffix: true })
}

export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'dd MMM yyyy')
}

export function formatSmartDate(dateStr: string): string {
  const date = parseISO(dateStr)
  const diff = differenceInCalendarDays(new Date(), date)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return format(date, 'EEEE')
  if (diff < 365) return format(date, 'd MMM')
  return format(date, 'd MMM yyyy')
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function calculateBalance(
  expenses: Expense[],
  userId: string
): { youOwe: number; theyOwe: number; net: number } {
  let youOwe = 0
  let theyOwe = 0

  for (const e of expenses) {
    if (e.is_settled) continue

    if (e.expense_type === 'shared') {
      if (e.paid_by === userId && e.split_with) {
        theyOwe += e.amount / 2
      } else if (e.paid_by !== userId && e.split_with === userId) {
        youOwe += e.amount / 2
      }
    } else if (e.expense_type === 'loan') {
      if (e.paid_by === userId && e.loan_to !== userId) {
        theyOwe += e.amount
      } else if (e.paid_by !== userId && e.loan_to === userId) {
        youOwe += e.amount
      }
    }
  }

  return { youOwe, theyOwe, net: theyOwe - youOwe }
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}
