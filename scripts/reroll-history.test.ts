import assert from 'node:assert/strict'
import { RerollHistory } from '../src/lib/reroll-history.ts'
import { suggestMeals } from '../src/lib/suggest.ts'
import type { Recipe } from '../src/lib/types.ts'

const history = new RerollHistory()
const date = '2026-11-04'
history.remember(date, [{ label: 'Tacos' }, { label: 'Soup' }])
assert.deepEqual([...history.get(date)!.labels], ['tacos', 'soup'])
history.remember(date, [{ label: 'Pizza' }])
assert.equal(history.get(date)!.labels.size, 3)
assert.equal(history.get('2026-11-05'), undefined)

const recipes = ['a', 'b', 'c', 'd'].map((id) => ({ id, title: id, tags: ['dinner'], status: 'ready' } as Recipe))
const shown: string[] = []
for (let i = 0; i < 5; i++) {
  const picks = suggestMeals({ recipes, stats: new Map(), tags: [], alreadyPlanned: [...history.get(date)!.recipes], today: '2026-11-01', count: 1, requiredTags: [], adventure: 0.35 })
  if (i === 4) assert.deepEqual(picks, [])
  else {
    assert.equal(picks.length, 1)
    assert.ok(!shown.includes(picks[0]))
    shown.push(picks[0])
    history.remember(date, [{ recipe_id: picks[0] }])
  }
}
assert.equal(shown.length, 4)
assert.equal(history.get('2026-11-05'), undefined)
console.log('Repeated rerolls preserve prior choices, exhaust alternatives without cycling, and keep days independent.')
