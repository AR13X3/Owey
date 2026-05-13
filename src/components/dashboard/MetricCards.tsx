import { formatCurrency } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  totalShared: number
  myPersonal: number
  loansOutstanding: number
}

export function MetricCards({ totalShared, myPersonal, loansOutstanding }: Props) {
  const cards = [
    { label: 'Total Shared', value: totalShared, color: 'text-indigo-600' },
    { label: 'My Personal', value: myPersonal, color: 'text-zinc-700' },
    { label: 'Loans Open', value: loansOutstanding, color: 'text-amber-600' },
  ]

  return (
    <div className="px-4 mt-4 grid grid-cols-3 gap-2">
      {cards.map(({ label, value, color }) => (
        <Card key={label} className="shadow-none border-zinc-100">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide truncate">{label}</p>
            <p className={`text-base font-bold mt-0.5 ${color}`}>{formatCurrency(value)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
