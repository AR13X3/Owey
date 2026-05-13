import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const from = (page - 1) * limit
  const settled = searchParams.get('settled')

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!profile?.household_id) {
    return NextResponse.json({ error: 'No household' }, { status: 400 })
  }

  const fromDate = searchParams.get('from')
  const toDate = searchParams.get('to')

  let query = supabase
    .from('receipts')
    .select('*, receipt_items(*)', { count: 'exact' })
    .eq('household_id', profile.household_id)
    .order('receipt_date', { ascending: false })
    .range(from, from + limit - 1)

  if (settled === 'false') query = query.eq('is_settled', false)
  if (settled === 'true') query = query.eq('is_settled', true)
  if (fromDate) query = query.gte('receipt_date', fromDate)
  if (toDate) query = query.lte('receipt_date', toDate)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ receipts: data, total: count })
}

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
  const { store_name, receipt_date, raw_text, total_amount, split_mode, items } = body

  const { data: receiptId, error } = await supabase.rpc('create_receipt_with_items', {
    p_household_id: profile.household_id,
    p_store_name: store_name,
    p_receipt_date: receipt_date,
    p_raw_text: raw_text ?? null,
    p_total_amount: total_amount,
    p_split_mode: split_mode ?? 'half',
    p_items: items ?? [],
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: receiptId }, { status: 201 })
}
