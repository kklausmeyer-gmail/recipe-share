import assert from 'node:assert/strict'
import { buildGroceryList, scaleLine } from '../src/lib/ingredients.ts'

assert.equal(scaleLine('1 Tbsp [2 oz] butter', 2), '2 Tbsp [4 oz] butter')
assert.equal(scaleLine('1 Tbsp [2 oz] butter', 1), '1 Tbsp [2 oz] butter')
assert.equal(scaleLine('1½ cups [180 g] flour, sifted', 2), '3 cups [360 g] flour, sifted')
assert.equal(scaleLine('2-3 cloves [10-15 g] garlic', 2), '4–6 cloves [20–30 g] garlic')
assert.equal(scaleLine('butter [ 2 oz ]', 0.5), 'butter [ 1 oz]')
assert.equal(scaleLine('1 (14-ounce) can tomatoes', 2), '2 (14-ounce) can tomatoes')
assert.equal(scaleLine('salt [to taste]', 2), 'salt [to taste]')
assert.equal(scaleLine('# Sauce [2 cups]', 2), '# Sauce [2 cups]')

const list = buildGroceryList([{ title: 'A', ingredients: ['1 Tbsp [14 g] butter', '2 Tbsp butter'] }])
assert.equal(list.length, 1)
assert.equal(list[0].name, 'butter')
assert.equal(list[0].qty, 3)
console.log('scale-line tests passed')
