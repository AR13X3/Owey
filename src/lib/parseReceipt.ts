export interface ParsedItem {
  name: string
  quantity: number
  unit_price: number
  total_price: number
}

export interface ParsedReceipt {
  store_name: string | null
  date: string | null        // YYYY-MM-DD
  items: ParsedItem[]
  total: number | null
  errors: string[]
}

export function parseReceipt(raw: string): ParsedReceipt {
  const result: ParsedReceipt = {
    store_name: null,
    date: null,
    items: [],
    total: null,
    errors: [],
  }

  const lines = raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('---') && !l.startsWith('ITEMS:'))

  for (const line of lines) {
    // STORE: Woolworths Parramatta
    const storeMatch = line.match(/^STORE:\s*(.+)$/i)
    if (storeMatch) {
      result.store_name = storeMatch[1].trim()
      continue
    }

    // DATE: 15/01/2025 or 2025-01-15 or 15-01-2025 or Jan 15 2025
    const dateMatch = line.match(/^DATE:\s*(.+)$/i)
    if (dateMatch) {
      result.date = parseDate(dateMatch[1].trim())
      continue
    }

    // TOTAL: 35.60
    const totalMatch = line.match(/^TOTAL:\s*\$?([\d,]+\.?\d*)$/i)
    if (totalMatch) {
      result.total = parseFloat(totalMatch[1].replace(',', ''))
      continue
    }

    // Item line: Name x1 @ 3.50
    const itemMatch = line.match(
      /^(.+?)\s+x\s*(\d+\.?\d*)\s*@\s*\$?([\d,]+\.?\d*)$/i
    )
    if (itemMatch) {
      const name = toTitleCase(itemMatch[1].trim())
      const quantity = parseFloat(itemMatch[2])
      const unit_price = parseFloat(itemMatch[3].replace(',', ''))
      result.items.push({ name, quantity, unit_price, total_price: quantity * unit_price })
      continue
    }

    // Fallback: "Item Name 9.90"
    const simplePriceMatch = line.match(/^(.+?)\s+\$?([\d,]+\.?\d{2})$/)
    if (simplePriceMatch) {
      const name = toTitleCase(simplePriceMatch[1].trim())
      const unit_price = parseFloat(simplePriceMatch[2].replace(',', ''))
      const skipWords = /^(subtotal|gst|tax|savings|discount|change|cash|eftpos|visa|mastercard)/i
      if (!skipWords.test(name)) {
        result.items.push({ name, quantity: 1, unit_price, total_price: unit_price })
      }
      continue
    }
  }

  if (result.items.length === 0) {
    result.errors.push('No items could be parsed. Check the format and try again.')
  }

  if (result.total === null && result.items.length > 0) {
    result.total = result.items.reduce((sum, i) => sum + i.total_price, 0)
  }

  if (result.total !== null && result.items.length > 0) {
    const computed = result.items.reduce((sum, i) => sum + i.total_price, 0)
    const diff = Math.abs(computed - result.total)
    if (diff > result.total * 0.01) {
      result.errors.push(
        `Warning: item totals ($${computed.toFixed(2)}) don't match stated total ($${result.total.toFixed(2)}). Check for missing items.`
      )
    }
  }

  return result
}

function parseDate(raw: string): string | null {
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return raw
  const months: Record<string, string> = {
    jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
    jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'
  }
  const verbal = raw.match(/(\d{1,2})\s+([a-z]{3})\w*\s+(\d{4})/i)
  if (verbal) {
    const [, d, mon, y] = verbal
    const m = months[mon.toLowerCase().slice(0, 3)]
    if (m) return `${y}-${m}-${d.padStart(2, '0')}`
  }
  return null
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\b(Ml|Kg|Gm?|Lb|Oz|Pk|Pkt|Ea)\b/g, m => m.toLowerCase())
}
