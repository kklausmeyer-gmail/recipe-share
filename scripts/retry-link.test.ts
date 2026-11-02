import assert from 'node:assert/strict'
import { retryLink } from './retry-link.ts'

const url = 'https://example.com/recipe'
const reply = (body: string, status = 200): typeof fetch => async (input, options) => {
  assert.equal(input, url)
  assert.equal(options?.redirect, 'follow')
  assert.ok(options?.signal)
  return new Response(body, { status })
}
await assert.rejects(retryLink(url, reply('Forbidden', 403)), /HTTP 403/)
await assert.rejects(retryLink(url, reply('<html>No recipe here</html>')), /no complete recipe/)
const html = (recipe: object) => `<script type="application/ld+json">${JSON.stringify({ '@type': 'Recipe', name: 'Soup', ...recipe })}</script>`
await assert.rejects(retryLink(url, reply(html({ recipeIngredient: ['1 cup water'] }))), /no complete recipe/)
const draft = await retryLink(url, reply(html({ recipeIngredient: ['1 cup water'], recipeInstructions: ['Boil the water.'] })))
assert.equal(draft.title, 'Soup')
assert.deepEqual(draft.ingredients, ['1 cup water'])
assert.deepEqual(draft.steps, ['Boil the water.'])
assert.equal(draft.source_url, url)
console.log('URL retry checks passed (403, missing data, partial recipe, successful import).')
