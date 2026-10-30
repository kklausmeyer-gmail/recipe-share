import { parseISODate } from './dates'

const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export interface ImportedDinner {
  date: string
  label: string
  warning: string | null
}

/** The note is newest first; only a large month jump advances to the preceding year.
 * Keep the written date on weekday typos rather than silently moving a family event. */
export function parseMealHistory(markdown: string, newestYear: number) {
  const rows: ImportedDinner[] = []
  const unparsed: string[] = []
  let year = newestYear
  let previousMonth: number | null = null
  const text = markdown.replace(/\|\s*\n\s*(?=[A-Za-z]+,?\s+\d)/g, '| ')
  for (const match of text.matchAll(/\|\s*([A-Za-z]+),?\s+(\d{1,2})\/(\d{1,2})\s*\|([^|]*)\|/g)) {
    const [, weekday, mm, dd, body] = match
    const month = Number(mm)
    const day = Number(dd)
    if (previousMonth !== null && month - previousMonth > 6) year--
    if (previousMonth !== null && previousMonth - month > 6) year++
    previousMonth = month
    const date = `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    const parsed = parseISODate(date)
    if (parsed.getMonth() + 1 !== month || parsed.getDate() !== day) {
      unparsed.push(match[0])
      continue
    }
    const label = body.replace(/\s+/g, ' ').trim()
    if (!label) continue
    rows.push({ date, label, warning: weekdays[parsed.getDay()] === weekday.toLowerCase() ? null : 'Written weekday does not match date; kept the written date.' })
  }
  // Preserve trailing free-form weeks in the private review instead of inventing dates.
  for (const line of markdown.split(/\r?\n/)) {
    if (/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b.*:/i.test(line.trim())) unparsed.push(line.trim())
  }
  return { rows, unparsed }
}

/** Extract only recognizable dinner text. Never suggest an entire schedule note.
 * Conservative: unknown restaurant names and ambiguous mixed notes stay history only. */
export function dinnerFromLabel(label: string): string | null {
  const normalized = label.replace(/\bchix\b|\bchic\b|\bchick\b/gi, 'chicken').replace(/\btake[ -]?out\b/gi, 'Takeout')
  const food = /\b(chicken|salmon|tofu|steak|dumplings?|nuggets|pasta|spaghetti|burgers?|hamburgers?|tacos?|quesadillas?|kebobs?|kabobs?|rice|noodles?|soup|salad|pizza|leftovers?|takeout|spring rolls|picadillo|carnitas|shrimp|chickpea|lentil|turkey|beef|pork|hot dogs|kimbap|gyoza|japchae|tamales?|rotisserie)\b/i
  const chunks = normalized.split(/[;\n]|\.\s+/).map((s) => s.trim()).filter(Boolean)
  const dinners = chunks.filter((s) => food.test(s) && !/\b(class|practice|soccer|swim|birthday|bday|concert|office|training|game|gone|camping|trip|out of town|no\s+\w+|\w+\s+out|\w+[’']s)\b/i.test(s))
  if (!dinners.length) return null
  const dinner = dinners.join('; ').replace(/\?+/g, '').trim()
  // Personal prefixes or explanatory suffixes are retained in history, not recommendations.
  if (/[:@]/.test(dinner) || dinner.length > 90) return null
  return dinner
}

export function familiarDinners(history: { plan_date: string; label: string | null; status: string }[], date: string) {
  const weekday = parseISODate(date).getDay()
  const meals = new Map<string, { label: string; count: number; weekdayCount: number; last: string }>()
  for (const entry of history) {
    if (entry.plan_date >= date || entry.status === 'suggested' || entry.status === 'skipped' || !entry.label) continue
    const label = dinnerFromLabel(entry.label)
    if (!label) continue
    const key = label.toLowerCase().replace(/\s*&\s*/g, ' and ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
    const meal = meals.get(key) ?? { label, count: 0, weekdayCount: 0, last: '' }
    meal.count++
    if (parseISODate(entry.plan_date).getDay() === weekday) meal.weekdayCount++
    if (entry.plan_date > meal.last) meal.last = entry.plan_date
    meals.set(key, meal)
  }
  return [...meals.values()].sort((a, b) => (b.weekdayCount * 3 + b.count) - (a.weekdayCount * 3 + a.count))
}
