import { daysBetween } from './dates'
import type { Recipe, Tag } from './types'

export interface RecipeStats {
  avgRating: number | null
  lastCooked: string | null
  timesCooked: number
}

export interface SuggestOptions {
  recipes: Recipe[]
  stats: Map<string, RecipeStats>
  tags: Tag[]
  /** Recipes already in the plan (this week); used for variety and excluded. */
  alreadyPlanned: string[]
  /** Recipes eaten in the last couple of weeks are skipped. */
  today: string
  count: number
  requiredTags: string[]
  /** 0 = mostly favorites, 1 = mostly recipes we've never made. */
  adventure: number
}

/**
 * Scores each dinner candidate and samples without replacement, so repeated
 * calls give different but sensible weeks:
 *   - better-rated recipes score higher (unrated counts as 3.5 stars)
 *   - the longer since we last made it, the higher (old favorites come back)
 *   - never-made recipes get a boost that grows with `adventure`
 *   - proteins and cuisines already in the week score lower
 */
export function suggestMeals(o: SuggestOptions): string[] {
  const groupOf = new Map(o.tags.map((t) => [t.name, t.grp]))
  const varietyTags = (r: Recipe) => r.tags.filter((t) => ['protein', 'cuisine'].includes(groupOf.get(t) ?? ''))

  const dinnerTagged = o.recipes.filter((r) => r.tags.includes('dinner'))
  // Until most recipes are tagged, don't restrict to "dinner".
  const pool = (dinnerTagged.length >= 10 ? dinnerTagged : o.recipes).filter(
    (r) =>
      r.status === 'ready' &&
      !o.alreadyPlanned.includes(r.id) &&
      o.requiredTags.every((t) => r.tags.includes(t)) &&
      !['dessert', 'breakfast', 'drink', 'snack', 'sauce'].some((t) => r.tags.includes(t) && !o.requiredTags.includes(t)),
  )

  const base = new Map<string, number>()
  for (const r of pool) {
    const s = o.stats.get(r.id)
    const rating = s?.avgRating ?? 3.5
    let score = Math.pow(rating / 5, 2) * 3
    if (s?.lastCooked) {
      const days = daysBetween(s.lastCooked, o.today)
      if (days < 14) continue
      score *= Math.min(2, 0.6 + days / 60)
    } else {
      score *= 0.7 + o.adventure * 1.6
    }
    if (s && s.timesCooked > 0) score *= 1 + (1 - o.adventure) * Math.min(0.5, s.timesCooked / 10)
    base.set(r.id, score)
  }

  const chosen: string[] = []
  const usedVariety = new Map<string, number>()
  for (const id of o.alreadyPlanned) {
    const r = o.recipes.find((x) => x.id === id)
    r && varietyTags(r).forEach((t) => usedVariety.set(t, (usedVariety.get(t) ?? 0) + 1))
  }

  for (let i = 0; i < o.count; i++) {
    const weighted: [string, number][] = []
    for (const [id, score] of base) {
      if (chosen.includes(id)) continue
      const r = pool.find((x) => x.id === id)!
      const repeats = varietyTags(r).reduce((n, t) => n + (usedVariety.get(t) ?? 0), 0)
      weighted.push([id, score * Math.pow(0.45, repeats)])
    }
    const total = weighted.reduce((n, [, w]) => n + w, 0)
    if (!total) break
    let pick = Math.random() * total
    let picked = weighted[weighted.length - 1][0]
    for (const [id, w] of weighted) {
      pick -= w
      if (pick <= 0) {
        picked = id
        break
      }
    }
    chosen.push(picked)
    const r = pool.find((x) => x.id === picked)!
    varietyTags(r).forEach((t) => usedVariety.set(t, (usedVariety.get(t) ?? 0) + 1))
  }
  return chosen
}
