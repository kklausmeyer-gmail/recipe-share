// Dates are handled as local 'YYYY-MM-DD' strings to avoid timezone surprises.

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = () => toISODate(new Date())

export function addDays(s: string, n: number): string {
  const d = parseISODate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Monday of the week containing `s`. */
export function weekStart(s: string): string {
  const d = parseISODate(s)
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return toISODate(d)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86400000)
}

export function formatDate(s: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  const d = parseISODate(s)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, sameYear ? opts : { ...opts, year: 'numeric' })
}

export function relativeDays(s: string): string {
  const n = daysBetween(s, today())
  if (n === 0) return 'today'
  if (n === 1) return 'yesterday'
  if (n < 14) return `${n} days ago`
  if (n < 60) return `${Math.round(n / 7)} weeks ago`
  if (n < 365) return `${Math.round(n / 30)} months ago`
  const years = Math.round(n / 365)
  return years === 1 ? 'a year ago' : `${years} years ago`
}

export function minutesLabel(m: number | null | undefined): string | null {
  if (!m) return null
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} hr ${r} min` : `${h} hr`
}
