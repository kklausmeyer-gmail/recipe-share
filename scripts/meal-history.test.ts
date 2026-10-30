import assert from 'node:assert/strict'
import { dinnerFromLabel, familiarDinners, parseMealHistory } from '../src/lib/meal-history.ts'

const result = parseMealHistory(`
| Monday, 1/5 | Salmon |
| Sunday, 12/28 | Soup |
| Thursday, 1/1 | Tofu |
| Friday, 12/26 | Take out |
|\nSaturday, 12/27 | Chicken\nand rice |
| Friday, 2/30 | Invalid |
Monday: undated dinner
`, 2026)
assert.deepEqual(result.rows.map((r) => r.date), ['2026-01-05', '2025-12-28', '2026-01-01', '2025-12-26', '2025-12-27'])
assert.equal(result.rows[4].label, 'Chicken and rice')
assert.equal(result.unparsed.length, 2)
assert.equal(parseMealHistory('| Friday, 3/7 | Takeout |', 2026).rows[0].warning !== null, true)
assert.equal(dinnerFromLabel('Swim class; chix nuggets?'), 'chicken nuggets')
assert.equal(dinnerFromLabel('Soccer practice'), null)
assert.equal(dinnerFromLabel('Someone out; Salmon & broccoli'), 'Salmon & broccoli')
assert.equal(dinnerFromLabel('Someone’s birthday; pizza'), 'pizza')
const history = [
  { plan_date: '2026-10-20', label: 'Swim class; Dumplings', status: 'planned' },
  { plan_date: '2026-10-19', label: 'Salmon', status: 'planned' },
  { plan_date: '2026-10-13', label: 'Dumplings', status: 'planned' },
  { plan_date: '2026-10-27', label: 'Pizza', status: 'suggested' },
]
assert.equal(familiarDinners(history, '2026-11-03')[0].label, 'Dumplings')
assert.equal(familiarDinners(history, '2026-11-03')[0].weekdayCount, 2)
assert.equal(familiarDinners(history, '2026-10-01').length, 0)
console.log('Meal history checks passed')
