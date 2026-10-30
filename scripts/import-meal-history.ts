// Private note data and review artifacts belong only under ignored import/.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { parseMealHistory } from '../src/lib/meal-history.ts'

const args = process.argv.slice(2)
const source = args[0]
if (!source) throw new Error('Usage: tsx --env-file=.env.local scripts/import-meal-history.ts <note.md> <newest-year> [--apply]')
const newestYear = Number(args[1])
if (!Number.isInteger(newestYear) || newestYear < 2000 || newestYear > 2100) throw new Error('Supply the newest year explicitly.')
const parsed = parseMealHistory(readFileSync(source, 'utf8'), newestYear)
const rows = parsed.rows.map((r) => {
  const hash = createHash('sha256').update(`meal-note-v1:${r.date}:${r.label}`).digest('hex')
  return { id: `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`, plan_date: r.date, meal: 'dinner', label: r.label, status: 'planned' }
})
mkdirSync('import/meal-history', { recursive: true })
writeFileSync('import/meal-history/review.json', JSON.stringify(parsed, null, 2))
writeFileSync('import/meal-history/rows.json', JSON.stringify(rows, null, 2))
console.log(JSON.stringify({ rows: rows.length, warnings: parsed.rows.filter((r) => r.warning).length, undatedLines: parsed.unparsed.length, first: rows.at(-1)?.plan_date, last: rows[0]?.plan_date }))
if (args.includes('--apply')) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase URL or secret key')
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { count: owners, error: ownerError } = await db.from('members').select('email', { count: 'exact', head: true }).eq('role', 'owner')
  if (ownerError) throw ownerError
  if (owners !== 2) throw new Error(`Expected exactly two owner accounts for private planning; found ${owners}. No history was imported.`)
  const publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!publicKey) throw new Error('Missing public key for anonymous access check')
  const anonymous = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const anonymousRead = await anonymous.from('meal_plan').select('id').limit(1)
  if (anonymousRead.data?.length) throw new Error('Anonymous access to meal plans detected. No history was imported.')
  const { data: existing, error: readError } = await db.from('meal_plan').select('id,plan_date').eq('meal', 'dinner')
  if (readError) throw readError
  const ids = new Set(existing.map((r) => r.id))
  const occupied = new Set(existing.filter((r) => !rows.some((x) => x.id === r.id)).map((r) => r.plan_date))
  const pending = rows.filter((r) => !ids.has(r.id) && !occupied.has(r.plan_date))
  writeFileSync('import/meal-history/conflicts.json', JSON.stringify(rows.filter((r) => occupied.has(r.plan_date)), null, 2))
  if (pending.length) {
    const { error } = await db.from('meal_plan').upsert(pending, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
  }
  console.log(JSON.stringify({ imported: pending.length, alreadyImported: rows.filter((r) => ids.has(r.id)).length, conflictingDates: occupied.size }))
  let verified = 0
  for (let offset = 0; offset < rows.length; offset += 50) {
    const verification = await db.from('meal_plan').select('id', { count: 'exact', head: true }).in('id', rows.slice(offset, offset + 50).map((r) => r.id))
    if (verification.error) throw verification.error
    verified += verification.count ?? 0
  }
  const afterAnonymous = await anonymous.from('meal_plan').select('id').limit(1)
  if (afterAnonymous.data?.length) throw new Error('Anonymous access check failed after import')
  console.log(JSON.stringify({ verifiedImportedRows: verified, ownerAccounts: owners, anonymousRead: afterAnonymous.error ? 'denied' : 'no rows' }))
}
