import assert from 'node:assert/strict'
import { parseRecipeText } from '../src/lib/recipe-text.ts'

const recipe = parseRecipeText(`Lemon chicken
Prep time: 15 minutes
Cook time
1 hour 10 minutes
Total time: 1 hr 25 min
Serves: 4 to 6
Ingredients
• 1½ cups stock
2 chicken breasts
Sauce:
- 1/2 tsp salt
Directions
1. Heat the pan.
Add oil and wait until shimmering.
2. Cook chicken.
350 degrees is the oven temperature.
Recipe notes
Keep refrigerated.
Nutrition Facts
100 calories`)
assert.equal(recipe.title, 'Lemon chicken')
assert.equal(recipe.servings, '4 to 6')
assert.equal(recipe.prep_minutes, 15)
assert.equal(recipe.cook_minutes, 70)
assert.equal(recipe.total_minutes, 85)
assert.deepEqual(recipe.ingredients, ['1½ cups stock', '2 chicken breasts', '# Sauce', '1/2 tsp salt'])
assert.deepEqual(recipe.steps, ['Heat the pan. Add oil and wait until shimmering.', 'Cook chicken. 350 degrees is the oven temperature.'])
const plain = parseRecipeText('Soup\r\nINGREDIENTS:\r\n[ ] 1 cup water\r\nInstructions\r\nBoil water.\r\nAdd salt.')
assert.deepEqual(plain.ingredients, ['1 cup water'])
assert.deepEqual(plain.steps, ['Boil water.', 'Add salt.'])
const copied = parseRecipeText('Ingredients\n1 egg\nMethod\nStep 1\nBeat egg.\nStep 2\nCook egg.')
assert.equal(copied.title, '')
assert.deepEqual(copied.steps, ['Beat egg.', 'Cook egg.'])
assert.deepEqual(parseRecipeText('An article without headings').ingredients, [])
assert.deepEqual(parseRecipeText('Ingredients\n1 egg').steps, [])
assert.deepEqual(parseRecipeText('Ingredients\n1 egg\nSteps\n1.\nBeat.\n2.\nCook.').steps, ['Beat.', 'Cook.'])
console.log('Pasted recipe checks passed: quantities, metadata, sections, wrapped steps, clipboard numbering, incomplete text.')
