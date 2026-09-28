// Extracts a recipe from a web page's HTML using its schema.org Recipe JSON-LD,
// which nearly every recipe site publishes. No dependencies, so it runs in both
// the Supabase Edge Function (Deno) and the Node import scripts.

export interface RecipeDraft {
  title: string
  description: string | null
  servings: string | null
  prep_minutes: number | null
  cook_minutes: number | null
  total_minutes: number | null
  ingredients: string[]
  steps: string[]
  tags: string[]
  image_urls: string[]
  source_url: string
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
type Obj = { [key: string]: Json }

const isObj = (v: Json | undefined): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const asArray = (v: Json | undefined): Json[] => (v == null ? [] : Array.isArray(v) ? v : [v])

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&frac12;/g, '½')
    .replace(/&frac14;/g, '¼')
    .replace(/&frac34;/g, '¾')
    .replace(/&amp;/g, '&')
}

function clean(s: Json | undefined): string {
  if (typeof s !== 'string') return ''
  return decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/** ISO 8601 duration (PT1H30M) to minutes. */
export function durationToMinutes(v: Json | undefined): number | null {
  if (typeof v !== 'string') return null
  const m = v.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i)
  if (!m) return null
  const mins = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
  return mins > 0 ? mins : null
}

function hasType(o: Obj, type: string): boolean {
  return asArray(o['@type']).some((t) => typeof t === 'string' && t.toLowerCase() === type.toLowerCase())
}

function findRecipe(node: Json): Obj | null {
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n)
      if (r) return r
    }
    return null
  }
  if (!isObj(node)) return null
  if (hasType(node, 'Recipe')) return node
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement']) {
    const r = findRecipe(node[key] ?? null)
    if (r) return r
  }
  return null
}

function imageUrls(v: Json | undefined): string[] {
  const out: string[] = []
  for (const item of asArray(v)) {
    if (typeof item === 'string') out.push(item)
    else if (isObj(item) && typeof item.url === 'string') out.push(item.url)
  }
  return [...new Set(out)]
}

function instructions(v: Json | undefined): string[] {
  const out: string[] = []
  const walk = (node: Json) => {
    if (typeof node === 'string') {
      // Some sites put all steps in one string separated by newlines.
      for (const line of decodeEntities(node).split(/\n+/)) {
        const t = clean(line)
        if (t) out.push(t)
      }
    } else if (Array.isArray(node)) {
      node.forEach(walk)
    } else if (isObj(node)) {
      if (hasType(node, 'HowToSection')) {
        const name = clean(node.name)
        if (name) out.push(`# ${name}`)
        walk(node.itemListElement ?? null)
      } else {
        const t = clean(node.text ?? node.name ?? null)
        if (t) out.push(t)
      }
    }
  }
  walk(v ?? null)
  return out
}

function yieldText(v: Json | undefined): string | null {
  const values = asArray(v).map((x) => (typeof x === 'number' ? String(x) : clean(x))).filter(Boolean)
  if (!values.length) return null
  // Prefer the more descriptive value ("4 servings" over "4").
  return values.sort((a, b) => b.length - a.length)[0]
}

function keywords(v: Json | undefined): string[] {
  const raw = asArray(v).flatMap((x) => (typeof x === 'string' ? x.split(',') : []))
  return raw.map((s) => s.trim().toLowerCase()).filter((s) => s && s.length < 30)
}

function metaContent(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i')
  const tag = html.match(re)?.[0]
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1]
  return content ? decodeEntities(content) : null
}

export function parseRecipeHtml(html: string, url: string): RecipeDraft | null {
  const scripts = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
  let recipe: Obj | null = null
  for (const [, body] of scripts) {
    try {
      recipe = findRecipe(JSON.parse(body.trim()) as Json)
    } catch {
      // Some sites emit invalid JSON-LD; skip that block.
    }
    if (recipe) break
  }

  const ogTitle = metaContent(html, 'og:title')
  const ogImage = metaContent(html, 'og:image')
  const ogDesc = metaContent(html, 'og:description')

  if (!recipe) {
    if (!ogTitle) return null
    return {
      title: ogTitle,
      description: ogDesc,
      servings: null,
      prep_minutes: null,
      cook_minutes: null,
      total_minutes: null,
      ingredients: [],
      steps: [],
      tags: [],
      image_urls: ogImage ? [absolute(ogImage, url)] : [],
      source_url: url,
    }
  }

  const images = imageUrls(recipe.image).map((u) => absolute(u, url))
  if (!images.length && ogImage) images.push(absolute(ogImage, url))

  const categories = [...asArray(recipe.recipeCategory), ...asArray(recipe.recipeCuisine)]
    .map((c) => clean(c).toLowerCase())
    .filter(Boolean)

  return {
    title: clean(recipe.name) || ogTitle || 'Untitled recipe',
    description: clean(recipe.description) || ogDesc || null,
    servings: yieldText(recipe.recipeYield),
    prep_minutes: durationToMinutes(recipe.prepTime),
    cook_minutes: durationToMinutes(recipe.cookTime),
    total_minutes: durationToMinutes(recipe.totalTime),
    ingredients: asArray(recipe.recipeIngredient ?? recipe.ingredients).map(clean).filter(Boolean),
    steps: instructions(recipe.recipeInstructions),
    tags: [...new Set([...categories, ...keywords(recipe.keywords)])].slice(0, 12),
    image_urls: images,
    source_url: url,
  }
}

function absolute(u: string, base: string): string {
  try {
    return new URL(u, base).toString()
  } catch {
    return u
  }
}

export const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}
