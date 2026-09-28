// Reads recipe links from a text export of the Google Doc and turns each one
// into import/recipes/link-<name>.json using the page's schema.org recipe data.
//
//   npm run import:links                  # reads import/links.txt
//   npm run import:links -- path/to/doc.txt

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { FETCH_HEADERS, parseRecipeHtml } from '../supabase/functions/_shared/recipe-parse.ts'
import { ensureDir, IMPORT_DIR, RECIPES_DIR, slugify, writeJson, type RecipeFile } from './lib.ts'

// Map common website categories onto our starter tags.
const TAG_MAP: Record<string, string> = {
  'main course': 'dinner', 'main dish': 'dinner', main: 'dinner', entree: 'dinner', dinner: 'dinner', supper: 'dinner',
  breakfast: 'breakfast', brunch: 'breakfast', lunch: 'lunch', dessert: 'dessert', desserts: 'dessert',
  'side dish': 'side', side: 'side', sides: 'side', appetizer: 'snack', snack: 'snack', drinks: 'drink', drink: 'drink',
  soup: 'soup', salad: 'salad', 'gluten free': 'gluten free', 'gluten-free': 'gluten free', 'dairy free': 'dairy free',
  'dairy-free': 'dairy free', paleo: 'paleo', whole30: 'paleo', vegetarian: 'vegetarian', vegan: 'vegan',
  italian: 'italian', mexican: 'mexican', indian: 'indian', mediterranean: 'mediterranean', asian: 'asian',
  chinese: 'asian', thai: 'asian', japanese: 'asian', korean: 'asian', vietnamese: 'asian', american: 'american',
}

const input = process.argv[2] ?? join(IMPORT_DIR, 'links.txt')
if (!existsSync(input)) {
  console.error(`Couldn't find ${input}. Export the Google Doc (File > Download > Web page, or Plain text) and pass its path.`)
  process.exit(1)
}

// Works with a plain-text export (raw URLs) or an HTML export (linked text).
// Google Docs HTML wraps links as https://www.google.com/url?q=<real url>&...
function unwrap(raw: string): string | null {
  let u = raw.replace(/&amp;/g, '&').replace(/[.,;]+$/, '')
  try {
    const parsed = new URL(u)
    if (/(^|\.)google\.com$/.test(parsed.hostname) && parsed.pathname === '/url') u = parsed.searchParams.get('q') ?? u
    const host = new URL(u).hostname
    if (/(^|\.)((google|googleusercontent|gstatic|googleapis)\.com|w3\.org)$/.test(host)) return null
    return u
  } catch {
    return null
  }
}
const found = readFileSync(input, 'utf8').match(/https?:\/\/[^\s<>"')\]]+/g) ?? []
const urls = [...new Set(found.map(unwrap).filter((u): u is string => !!u))]
ensureDir(RECIPES_DIR)

const already = new Set<string>()
for (const f of readdirSync(RECIPES_DIR).filter((f) => f.endsWith('.json'))) {
  try {
    const r = JSON.parse(readFileSync(join(RECIPES_DIR, f), 'utf8')) as RecipeFile
    if (r.source_url) already.add(r.source_url)
  } catch {
    // ignore
  }
}

const failures: string[] = []
let ok = 0
for (const url of urls) {
  if (already.has(url)) continue
  process.stdout.write(`${url} … `)
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const draft = parseRecipeHtml(await res.text(), url)
    if (!draft) throw new Error('no recipe data on the page')
    const tags = [...new Set(draft.tags.map((t) => TAG_MAP[t]).filter(Boolean))]
    const recipe: RecipeFile = {
      title: draft.title,
      description: draft.description,
      servings: draft.servings,
      prep_minutes: draft.prep_minutes,
      cook_minutes: draft.cook_minutes,
      total_minutes: draft.total_minutes,
      ingredients: draft.ingredients,
      steps: draft.steps,
      tags,
      source_type: 'link',
      source_url: url,
      image_urls: draft.image_urls.slice(0, 1),
    }
    let name = `link-${slugify(draft.title)}.json`
    for (let n = 2; existsSync(join(RECIPES_DIR, name)); n++) name = `link-${slugify(draft.title)}-${n}.json`
    writeJson(join(RECIPES_DIR, name), recipe)
    const incomplete = !draft.ingredients.length || !draft.steps.length
    console.log(incomplete ? `saved, but incomplete (${name})` : `✓ ${draft.title}`)
    if (incomplete) failures.push(`${url}\tpartial: saved as ${name} without full ingredients/steps`)
    ok++
  } catch (e) {
    console.log(`✗ ${(e as Error).message}`)
    failures.push(`${url}\t${(e as Error).message}`)
  }
  await new Promise((r) => setTimeout(r, 800))
}

const failFile = join(IMPORT_DIR, 'link-failures.txt')
writeFileSync(failFile, failures.join('\n') + (failures.length ? '\n' : ''))
console.log(`\n${urls.length} links found, ${ok} saved, ${failures.length} need a look (listed in import/link-failures.txt).`)
