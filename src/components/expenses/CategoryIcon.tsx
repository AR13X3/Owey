import {
  ShoppingCart, UtensilsCrossed, Car, Zap, Home, Tv, Pill,
  ShoppingBag, Plane, Package
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import { cn } from '@/lib/utils'

const CATEGORIES: Record<string, { icon: React.ElementType<LucideProps>; color: string; label: string }> = {
  groceries:     { icon: ShoppingCart,    color: 'text-emerald-600', label: 'Groceries' },
  dining:        { icon: UtensilsCrossed, color: 'text-orange-500',  label: 'Dining' },
  transport:     { icon: Car,             color: 'text-blue-500',    label: 'Transport' },
  utilities:     { icon: Zap,             color: 'text-yellow-500',  label: 'Utilities' },
  rent:          { icon: Home,            color: 'text-indigo-500',  label: 'Rent' },
  entertainment: { icon: Tv,              color: 'text-purple-500',  label: 'Entertainment' },
  health:        { icon: Pill,            color: 'text-rose-500',    label: 'Health' },
  shopping:      { icon: ShoppingBag,     color: 'text-pink-500',    label: 'Shopping' },
  travel:        { icon: Plane,           color: 'text-cyan-500',    label: 'Travel' },
  other:         { icon: Package,         color: 'text-zinc-500',    label: 'Other' },
}

export const CATEGORY_LIST = Object.entries(CATEGORIES).map(([key, val]) => ({ key, ...val }))

interface Props extends LucideProps {
  category: string
}

export function CategoryIcon({ category, className, ...props }: Props) {
  const config = CATEGORIES[category] ?? CATEGORIES.other
  const Icon = config.icon
  return <Icon className={cn(config.color, className)} {...props} />
}

export function getCategoryLabel(category: string): string {
  return CATEGORIES[category]?.label ?? 'Other'
}
