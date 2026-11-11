import assert from 'node:assert/strict'
import { usesIngredient } from '../src/lib/use-up.ts'
import { suggestMeals } from '../src/lib/suggest.ts'
import type { Recipe } from '../src/lib/types.ts'

assert.ok(usesIngredient(['1 cup Greek yogurt', '2 bunches Swiss chard, chopped'], 'swiss chard'))
assert.ok(usesIngredient(['2 tomatoes, diced'], 'tomato'))
assert.ok(usesIngredient(['2 carrots'], 'carrot'))
assert.ok(!usesIngredient(['# Yogurt sauce', '1 cup milk'], 'yogurt'))
assert.ok(!usesIngredient(['1 tsp cardamom'], 'chard'))
assert.ok(!usesIngredient(['1 cup yogurt'], ''))

const recipes = [
  { id: 'both', ingredients: ['1 cup yogurt', '1 bunch swiss chard'] },
  { id: 'yogurt', ingredients: ['1 cup yogurt'] },
  { id: 'carrot', ingredients: ['2 carrots'] },
  { id: 'other', ingredients: ['1 cup rice'] },
].map((r) => ({ ...r, tags: ['dinner'], status: 'ready' } as Recipe))
const options = { recipes, stats: new Map(), tags: [], alreadyPlanned: [], today: '2026-11-10', count: 2, requiredTags: [], adventure: 0.35, useUp: ['yogurt', 'swiss chard', 'carrot'] }
for (let i = 0; i < 20; i++) {
  assert.deepEqual(suggestMeals(options), ['both', 'carrot'])
}
assert.equal(suggestMeals({ ...options, alreadyPlanned: ['both'], useUp: ['yogurt'], count: 1 })[0], 'yogurt')
assert.deepEqual(suggestMeals({ ...options, requiredTags: ['vegan'] }), [])
console.log('Use-up matching, coverage priority, exclusions, and diet filters passed.')
