import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
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

  const body = await req.json()
  const { paid_to, amount, notes } = body

  // Record settlement
  const { error: settleError } = await supabase.from('settlements').insert({
    household_id: profile.household_id,
    paid_by: user.id,
    paid_to,
    amount,
    notes: notes ?? null,
  })

  if (settleError) return NextResponse.json({ error: settleError.message }, { status: 500 })

  // Mark shared expenses as settled
  await supabase
    .from('expenses')
    .update({ is_settled: true })
    .eq('household_id', profile.household_id)
    .eq('is_settled', false)
    .in('expense_type', ['shared', 'loan'])

  // Mark receipts as settled
  await supabase
    .from('receipts')
    .update({ is_settled: true })
    .eq('household_id', profile.household_id)
    .eq('is_settled', false)

  return NextResponse.json({ success: true }, { status: 201 })
}
