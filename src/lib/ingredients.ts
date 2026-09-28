// Ingredient lines are stored as plain text ("1 1/2 cups flour, sifted").
// These helpers parse them for scaling and for building grocery lists.

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4,
  '⅕': 1 / 5, '⅖': 2 / 5, '⅗': 3 / 5, '⅘': 4 / 5, '⅙': 1 / 6, '⅚': 5 / 6,
  '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8,
}

// Canonical unit -> spellings. Order matters only for display.
const UNITS: Record<string, string[]> = {
  tsp: ['teaspoons', 'teaspoon', 'tsps', 'tsp', 't'],
  tbsp: ['tablespoons', 'tablespoon', 'tbsps', 'tbsp', 'tbs', 'tbl', 'T'],
  cup: ['cups', 'cup', 'c'],
  oz: ['ounces', 'ounce', 'oz'],
  'fl oz': ['fluid ounces', 'fluid ounce', 'fl oz', 'fl. oz.'],
  lb: ['pounds', 'pound', 'lbs', 'lb'],
  g: ['grams', 'gram', 'g'],
  kg: ['kilograms', 'kilogram', 'kg'],
  ml: ['milliliters', 'millilitres', 'milliliter', 'millilitre', 'ml'],
  l: ['liters', 'litres', 'liter', 'litre', 'l'],
  pint: ['pints', 'pint', 'pt'],
  quart: ['quarts', 'quart', 'qt'],
  clove: ['cloves', 'clove'],
  can: ['cans', 'can'],
  jar: ['jars', 'jar'],
  package: ['packages', 'package', 'pkg'],
  bunch: ['bunches', 'bunch'],
  head: ['heads', 'head'],
  stick: ['sticks', 'stick'],
  slice: ['slices', 'slice'],
  pinch: ['pinches', 'pinch'],
  dash: ['dashes', 'dash'],
  sprig: ['sprigs', 'sprig'],
  handful: ['handfuls', 'handful'],
}

const UNIT_LOOKUP: [string, string][] = Object.entries(UNITS)
  .flatMap(([canon, spellings]) => spellings.map((s) => [s, canon] as [string, string]))
  .sort((a, b) => b[0].length - a[0].length)

export interface ParsedIngredient {
  raw: string
  qty: number | null
  qtyMax: number | null
  unit: string | null
  item: string
  note: string | null
}

export const isHeader = (line: string) => line.startsWith('# ')
export const headerText = (line: string) => line.replace(/^#\s*/, '')

function parseNumber(s: string): number | null {
  s = s.trim()
  if (!s) return null
  let total = 0
  let matched = false
  for (const part of s.split(/\s+/)) {
    if (UNICODE_FRACTIONS[part] != null) {
      total += UNICODE_FRACTIONS[part]
      matched = true
    } else if (/^\d+(\.\d+)?$/.test(part)) {
      total += Number(part)
      matched = true
    } else if (/^\d+\/\d+$/.test(part)) {
      const [n, d] = part.split('/').map(Number)
      if (d) total += n / d
      matched = true
    } else if (/^\d+[½⅓⅔¼¾⅛⅜⅝⅞]$/.test(part)) {
      total += Number(part.slice(0, -1)) + UNICODE_FRACTIONS[part.slice(-1)]
      matched = true
    } else {
      return null
    }
  }
  return matched ? total : null
}

const NUM = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+[½⅓⅔¼¾⅛⅜⅝⅞]|\d+(?:\.\d+)?(?:\s*[½⅓⅔¼¾⅛⅜⅝⅞])?|[½⅓⅔¼¾⅛⅜⅝⅞])`
const QTY_RE = new RegExp(String.raw`^(${NUM})(?:\s*(?:-|–|to)\s*(${NUM}))?\s*`)

export function parseIngredient(raw: string): ParsedIngredient {
  let rest = raw.trim()
  let qty: number | null = null
  let qtyMax: number | null = null
  const m = rest.match(QTY_RE)
  if (m) {
    qty = parseNumber(m[1])
    qtyMax = m[2] ? parseNumber(m[2]) : null
    rest = rest.slice(m[0].length)
  }
  // "(14-ounce) can" style sizes stay part of the item text.
  let unit: string | null = null
  for (const [spelling, canon] of UNIT_LOOKUP) {
    const caseSensitive = spelling === 'T' || spelling === 't'
    const re = new RegExp(`^${spelling.replace(/[.]/g, '\\.')}\\.?(?=\\s|$)`, caseSensitive ? '' : 'i')
    if (qty != null && re.test(rest)) {
      unit = canon
      rest = rest.replace(re, '').trim()
      break
    }
  }
  rest = rest.replace(/^of\s+/i, '')
  let note: string | null = null
  const comma = rest.indexOf(',')
  if (comma > 0) {
    note = rest.slice(comma + 1).trim() || null
    rest = rest.slice(0, comma)
  }
  return { raw, qty, qtyMax, unit, item: rest.trim(), note }
}

const NICE_FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'],
  [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'],
]

export function formatQty(n: number): string {
  const whole = Math.floor(n + 1e-6)
  const frac = n - whole
  if (frac < 0.06) return String(whole)
  if (frac > 0.94) return String(whole + 1)
  if (whole >= 10) return String(Math.round(n))
  let best = NICE_FRACTIONS[0]
  for (const f of NICE_FRACTIONS) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f
  if (Math.abs(best[0] - frac) > 0.07) return String(Math.round(n * 100) / 100)
  return whole ? `${whole}${best[1]}` : best[1]
}

/** Rewrites an ingredient line with its quantity multiplied by `factor`. */
export function scaleLine(raw: string, factor: number): string {
  if (factor === 1 || isHeader(raw)) return raw
  const m = raw.trim().match(QTY_RE)
  if (!m) return raw
  const a = parseNumber(m[1])
  if (a == null) return raw
  const b = m[2] ? parseNumber(m[2]) : null
  const q = formatQty(a * factor) + (b != null ? `–${formatQty(b * factor)}` : '')
  return `${q} ${raw.trim().slice(m[0].length)}`
}

/** First number in a servings string ("Serves 4 to 6" -> 4). */
export function servingsNumber(s: string | null | undefined): number | null {
  const m = s?.match(/\d+/)
  return m ? Number(m[0]) : null
}

// ---------------------------------------------------------------------------
// Grocery list
// ---------------------------------------------------------------------------

export interface GroceryItem {
  key: string
  name: string
  unit: string | null
  qty: number | null
  lines: string[]
  recipes: string[]
}

const DESCRIPTORS =
  /\b(fresh(ly)?|large|medium|small|chopped|minced|diced|sliced|finely|roughly|thinly|grated|ground|peeled|packed|softened|melted|room temperature|to taste|optional|boneless|skinless|extra[- ]virgin|about|plus more.*)\b/gi

export function groceryKey(item: string): string {
  let s = item.toLowerCase().replace(/\(.*?\)/g, ' ').replace(DESCRIPTORS, ' ')
  s = s.replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  // naive singular
  s = s.replace(/(ies)$/, 'y').replace(/(oes)$/, 'o').replace(/([^s])s$/, '$1')
  return s
}

export function buildGroceryList(recipes: { title: string; ingredients: string[] }[]): GroceryItem[] {
  const map = new Map<string, GroceryItem>()
  for (const r of recipes) {
    for (const line of r.ingredients) {
      if (!line.trim() || isHeader(line)) continue
      const p = parseIngredient(line)
      const base = groceryKey(p.item) || p.item.toLowerCase()
      const key = `${base}|${p.unit ?? ''}`
      const existing = map.get(key)
      if (existing) {
        existing.qty = existing.qty != null && p.qty != null ? existing.qty + p.qty : existing.qty ?? p.qty
        existing.lines.push(line)
        if (!existing.recipes.includes(r.title)) existing.recipes.push(r.title)
      } else {
        map.set(key, {
          key,
          name: p.item.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim() || line,
          unit: p.unit,
          qty: p.qty,
          lines: [line],
          recipes: [r.title],
        })
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function groceryLabel(g: GroceryItem): string {
  if (g.qty == null) return g.name
  return `${g.name} (${formatQty(g.qty)}${g.unit ? ' ' + g.unit : ''})`
}
