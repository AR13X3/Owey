'use client'

import { useReducer, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, todayISO } from '@/lib/utils'
import { toast } from 'sonner'
import { ChevronLeft, Plus, Trash2, Loader2, ChevronDown, ChevronUp, Copy } from 'lucide-react'
import type { ParsedItem, ParsedReceipt } from '@/lib/parseReceipt'
import type { SplitMode } from '@/lib/types'
import { useQueryClient } from '@tanstack/react-query'

const FORMAT_GUIDE = `STORE: Woolworths Auburn
DATE: 12/05/2026
ITEMS:
WW UHT Full Cream Milk 1L x2 @ 1.85
Coca Cola Zero Sugar 2L x1 @ 3.50
Crumbed Chicken Nuggets 500g x2 @ 3.25
Woolworths Paper Bag x1 @ 0.25
TOTAL: 27.95`

const LLM_PROMPT = `I'm going to give you a grocery receipt. Your job is to reformat it for my expense app.

OUTPUT ONLY the formatted receipt — no explanations, no notes, nothing else.

Use this exact format:

STORE: [store name and suburb]
DATE: [DD/MM/YYYY]
ITEMS:
[Item name] x[quantity] @ [unit price each]
TOTAL: [final dollar amount, no $ symbol]

RULES:
1. One item per line: Name x[qty] @ [unit price]
2. Multi-line items (Woolworths/Coles): combine into one line
3. Item names: remove # prefix, keep store brand prefixes, proper case
4. Include all food/household items and bags
5. Skip: SUBTOTAL, GST, savings lines, payment info, loyalty points, store address
6. TOTAL = final total amount only

Here is the receipt — reformat it now:

[PASTE YOUR RECEIPT TEXT HERE]`

type Assignment = 'user1' | 'user2' | 'shared'

interface EditableItem extends ParsedItem {
  id: string
  assigned_to: Assignment
}

interface ReceiptState {
  step: 1 | 2 | 3
  rawText: string
  storeName: string
  receiptDate: string
  items: EditableItem[]
  splitMode: SplitMode
}

type Action =
  | { type: 'SET_STEP'; payload: 1 | 2 | 3 }
  | { type: 'SET_RAW'; payload: string }
  | { type: 'SET_PARSED'; payload: ParsedReceipt }
  | { type: 'UPDATE_STORE'; payload: string }
  | { type: 'UPDATE_DATE'; payload: string }
  | { type: 'UPDATE_ITEM'; id: string; field: keyof EditableItem; value: string | number }
  | { type: 'DELETE_ITEM'; id: string }
  | { type: 'ADD_ITEM' }
  | { type: 'CYCLE_ASSIGNMENT'; id: string }
  | { type: 'SET_SPLIT_MODE'; payload: SplitMode }
  | { type: 'RESET' }

function nextAssignment(current: Assignment): Assignment {
  if (current === 'shared') return 'user1'
  if (current === 'user1') return 'user2'
  return 'shared'
}

function reducer(state: ReceiptState, action: Action): ReceiptState {
  switch (action.type) {
    case 'SET_STEP': return { ...state, step: action.payload }
    case 'SET_RAW': return { ...state, rawText: action.payload }
    case 'SET_PARSED':
      return {
        ...state,
        step: 2,
        storeName: action.payload.store_name ?? '',
        receiptDate: action.payload.date ?? todayISO(),
        items: action.payload.items.map((item, i) => ({
          ...item,
          id: `item-${i}-${Date.now()}`,
          assigned_to: 'shared',
        })),
      }
    case 'UPDATE_STORE': return { ...state, storeName: action.payload }
    case 'UPDATE_DATE': return { ...state, receiptDate: action.payload }
    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.id
            ? { ...item, [action.field]: action.value, total_price: action.field === 'quantity' ? Number(action.value) * item.unit_price : action.field === 'unit_price' ? item.quantity * Number(action.value) : item.total_price }
            : item
        ),
      }
    case 'DELETE_ITEM':
      return { ...state, items: state.items.filter(i => i.id !== action.id) }
    case 'ADD_ITEM':
      return {
        ...state,
        items: [...state.items, { id: `item-new-${Date.now()}`, name: '', quantity: 1, unit_price: 0, total_price: 0, assigned_to: 'shared' }],
      }
    case 'CYCLE_ASSIGNMENT':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.id
            ? { ...item, assigned_to: nextAssignment(item.assigned_to) }
            : item
        ),
      }
    case 'SET_SPLIT_MODE': return { ...state, splitMode: action.payload }
    case 'RESET':
      return { step: 1, rawText: '', storeName: '', receiptDate: todayISO(), items: [], splitMode: 'half' }
    default: return state
  }
}

interface Props {
  open: boolean
  onClose: () => void
}

export function AddReceiptSheet({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [state, dispatch] = useReducer(reducer, {
    step: 1, rawText: '', storeName: '', receiptDate: todayISO(), items: [], splitMode: 'half',
  })

  function handleClose() {
    dispatch({ type: 'RESET' })
    onClose()
  }

  async function handleParse() {
    if (!state.rawText.trim()) { toast.error('Paste your receipt text first'); return }
    setParsing(true)
    const res = await fetch('/api/parse-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: state.rawText }),
    })
    const data = await res.json()
    setParsing(false)
    if (!res.ok) { toast.error('Parse failed'); return }
    if (data.errors?.length > 0) toast.warning(data.errors[0])
    dispatch({ type: 'SET_PARSED', payload: data })
  }

  async function handleSave() {
    if (!state.storeName.trim()) { toast.error('Enter a store name'); return }
    if (state.items.length === 0) { toast.error('No items to save'); return }

    const total = state.items.reduce((s, i) => s + i.total_price, 0)

    setSaving(true)
    const res = await fetch('/api/receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_name: state.storeName,
        receipt_date: state.receiptDate,
        raw_text: state.rawText || null,
        total_amount: total,
        split_mode: state.splitMode,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        items: state.items.map(({ id: _id, ...rest }) => rest),
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      toast.error(json.error || 'Failed to save receipt')
      return
    }
    toast.success('Receipt saved!')
    queryClient.invalidateQueries({ queryKey: ['receipts'] })
    queryClient.invalidateQueries({ queryKey: ['balance'] })
    queryClient.invalidateQueries({ queryKey: ['recent-transactions'] })
    queryClient.invalidateQueries({ queryKey: ['month-expenses'] })
    handleClose()
  }

  // Compute split totals
  const totalAmount = state.items.reduce((s, i) => s + i.total_price, 0)
  const sharedTotal = state.items.filter(i => i.assigned_to === 'shared').reduce((s, i) => s + i.total_price, 0)
  const user1Total = state.items.filter(i => i.assigned_to === 'user1').reduce((s, i) => s + i.total_price, 0)
  const user2Total = state.items.filter(i => i.assigned_to === 'user2').reduce((s, i) => s + i.total_price, 0)

  const assignmentBadge = (a: Assignment) => {
    if (a === 'shared') return <Badge variant="secondary" className="text-[10px] py-0">Shared</Badge>
    if (a === 'user1') return <Badge className="bg-indigo-100 text-indigo-700 text-[10px] py-0 hover:bg-indigo-100">Mine</Badge>
    return <Badge className="bg-amber-100 text-amber-700 text-[10px] py-0 hover:bg-amber-100">Friend&apos;s</Badge>
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="bottom" className="h-[92vh] flex flex-col pb-safe">
        <SheetHeader className="flex-shrink-0">
          <div className="flex items-center gap-2">
            {state.step > 1 && (
              <button onClick={() => dispatch({ type: 'SET_STEP', payload: (state.step - 1) as 1 | 2 })}>
                <ChevronLeft className="h-5 w-5 text-muted-foreground" />
              </button>
            )}
            <SheetTitle>
              {state.step === 1 && 'Add Receipt'}
              {state.step === 2 && 'Review Items'}
              {state.step === 3 && 'Choose Split'}
            </SheetTitle>
          </div>
          <div className="flex gap-1 mt-2">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full ${state.step >= s ? 'bg-indigo-500' : 'bg-zinc-200'}`} />
            ))}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-4 space-y-4">
          {/* Step 1: Paste */}
          {state.step === 1 && (
            <>
              <Textarea
                placeholder="Paste your formatted receipt here..."
                className="min-h-[200px] font-mono text-sm resize-none"
                value={state.rawText}
                onChange={(e) => dispatch({ type: 'SET_RAW', payload: e.target.value })}
              />
              <button
                onClick={() => setGuideOpen(v => !v)}
                className="flex items-center gap-1 text-sm text-indigo-600 font-medium"
              >
                {guideOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                How to format your receipt
              </button>
              {guideOpen && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs text-muted-foreground">Use an AI assistant to reformat your receipt, then paste here. Copy this prompt:</p>
                  <div className="relative">
                    <pre className="text-[11px] bg-white border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{LLM_PROMPT}</pre>
                    <button
                      onClick={() => { navigator.clipboard.writeText(LLM_PROMPT); toast.success('Prompt copied!') }}
                      className="absolute top-2 right-2 p-1 rounded bg-zinc-100 hover:bg-zinc-200"
                    >
                      <Copy className="h-3.5 w-3.5 text-zinc-500" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">Expected format:</p>
                  <pre className="text-[11px] bg-white border rounded-lg p-3 whitespace-pre-wrap">{FORMAT_GUIDE}</pre>
                </div>
              )}
              <Button onClick={handleParse} className="w-full h-12" disabled={parsing}>
                {parsing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Parse Receipt
              </Button>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-zinc-200" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-zinc-200" />
              </div>
              <Button
                variant="outline"
                className="w-full h-12"
                onClick={() => {
                  dispatch({ type: 'ADD_ITEM' })
                  dispatch({ type: 'SET_STEP', payload: 2 })
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Enter Manually
              </Button>
            </>
          )}

          {/* Step 2: Review Items */}
          {state.step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Store</Label>
                  <Input value={state.storeName} onChange={(e) => dispatch({ type: 'UPDATE_STORE', payload: e.target.value })} placeholder="Store name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={state.receiptDate} onChange={(e) => dispatch({ type: 'UPDATE_DATE', payload: e.target.value })} />
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                {state.items.map(item => (
                  <div key={item.id} className="bg-zinc-50 rounded-xl p-3 space-y-2">
                    {/* Row 1: Name + Assignment + Delete */}
                    <div className="flex items-center gap-2">
                      <Input
                        value={item.name}
                        onChange={(e) => dispatch({ type: 'UPDATE_ITEM', id: item.id, field: 'name', value: e.target.value })}
                        className="flex-1 h-9 text-sm bg-white"
                        placeholder="Item name"
                      />
                      <button onClick={() => dispatch({ type: 'CYCLE_ASSIGNMENT', id: item.id })} className="flex-shrink-0">
                        {assignmentBadge(item.assigned_to)}
                      </button>
                      <button onClick={() => dispatch({ type: 'DELETE_ITEM', id: item.id })} className="flex-shrink-0 p-1 text-zinc-400 hover:text-rose-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {/* Row 2: Qty × Price = Total */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 flex-1">
                        <Input
                          type="number" min="1" step="1"
                          value={item.quantity}
                          onChange={(e) => dispatch({ type: 'UPDATE_ITEM', id: item.id, field: 'quantity', value: parseFloat(e.target.value) || 1 })}
                          className="h-9 w-14 text-sm bg-white text-center"
                        />
                        <span className="text-xs text-muted-foreground">×</span>
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">$</span>
                          <Input
                            type="number" min="0" step="0.01"
                            value={item.unit_price || ''}
                            placeholder="0.00"
                            onChange={(e) => dispatch({ type: 'UPDATE_ITEM', id: item.id, field: 'unit_price', value: parseFloat(e.target.value) || 0 })}
                            className="h-9 text-sm bg-white pl-6"
                          />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-muted-foreground">Total</p>
                        <p className="text-sm font-semibold">{formatCurrency(item.total_price)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => dispatch({ type: 'ADD_ITEM' })}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-indigo-600 border border-dashed border-indigo-300 rounded-xl hover:bg-indigo-50"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </button>
              </div>
              <div className="bg-zinc-50 rounded-xl p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Mine</span><span className="font-medium text-indigo-600">{formatCurrency(user1Total)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Friend&apos;s</span><span className="font-medium text-amber-600">{formatCurrency(user2Total)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Shared</span><span className="font-medium">{formatCurrency(sharedTotal)}</span></div>
                <Separator />
                <div className="flex justify-between font-semibold"><span>Total</span><span>{formatCurrency(totalAmount)}</span></div>
              </div>
              <Button onClick={() => dispatch({ type: 'SET_STEP', payload: 3 })} className="w-full h-12">
                Next: Choose Split
              </Button>
            </>
          )}

          {/* Step 3: Split Mode */}
          {state.step === 3 && (
            <>
              <RadioGroup
                value={state.splitMode}
                onValueChange={(v) => dispatch({ type: 'SET_SPLIT_MODE', payload: v as SplitMode })}
                className="space-y-3"
              >
                {[
                  { value: 'half', label: 'Split 50/50', desc: 'Divide total equally, ignore item assignments' },
                  { value: 'per_item', label: 'Per Item', desc: 'Use item assignments. Shared items split 50/50.' },
                  { value: 'all_me', label: 'All Mine', desc: 'I pay the whole thing' },
                  { value: 'all_partner', label: "All Friend's", desc: 'Friend pays the whole thing' },
                ].map(opt => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${state.splitMode === opt.value ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-200 bg-white'}`}
                  >
                    <RadioGroupItem value={opt.value} className="mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>

              {/* Final breakdown */}
              <div className="bg-zinc-50 rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium">Final Breakdown</p>
                {state.splitMode === 'half' && (
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">You owe</span><span className="font-semibold text-rose-500">{formatCurrency(totalAmount / 2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Friend owes</span><span className="font-semibold">{formatCurrency(totalAmount / 2)}</span></div>
                  </div>
                )}
                {state.splitMode === 'per_item' && (
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Mine</span><span className="font-semibold text-indigo-600">{formatCurrency(user1Total + sharedTotal / 2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Friend&apos;s</span><span className="font-semibold text-amber-600">{formatCurrency(user2Total + sharedTotal / 2)}</span></div>
                  </div>
                )}
                {state.splitMode === 'all_me' && (
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">You pay</span><span className="font-semibold">{formatCurrency(totalAmount)}</span></div>
                )}
                {state.splitMode === 'all_partner' && (
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Friend pays</span><span className="font-semibold">{formatCurrency(totalAmount)}</span></div>
                )}
              </div>

              <Button onClick={handleSave} className="w-full h-12" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Receipt
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
