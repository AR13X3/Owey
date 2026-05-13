import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { startOfWeek, startOfMonth, startOfQuarter, endOfWeek, endOfMonth, endOfQuarter, format } from 'date-fns'

export async function GET(req: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!profile?.household_id) {
    return NextResponse.json({ error: 'No household' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') ?? 'month'
  const customStart = searchParams.get('start')
  const customEnd = searchParams.get('end')

  const now = new Date()
  let startDate: Date
  let endDate: Date

  if (customStart && customEnd) {
    startDate = new Date(customStart)
    endDate = new Date(customEnd)
  } else if (period === 'week') {
    startDate = startOfWeek(now, { weekStartsOn: 1 })
    endDate = endOfWeek(now, { weekStartsOn: 1 })
  } else if (period === 'quarter') {
    startDate = startOfQuarter(now)
    endDate = endOfQuarter(now)
  } else {
    startDate = startOfMonth(now)
    endDate = endOfMonth(now)
  }

  const fromStr = format(startDate, 'yyyy-MM-dd')
  const toStr = format(endDate, 'yyyy-MM-dd')

  const [{ data: expenses }, { data: receipts }] = await Promise.all([
    supabase
      .from('expenses')
      .select('*')
      .eq('household_id', profile.household_id)
      .gte('expense_date', fromStr)
      .lte('expense_date', toStr),
    supabase
      .from('receipts')
      .select('*, receipt_items(*)')
      .eq('household_id', profile.household_id)
      .gte('receipt_date', fromStr)
      .lte('receipt_date', toStr),
  ])

  return NextResponse.json({
    period: { from: fromStr, to: toStr },
    expenses: expenses ?? [],
    receipts: receipts ?? [],
  })
}
