import { supabase } from './supabase'
import type { Recipe, RecipeInput, Tag } from './types'

const FIELDS = [
  'title', 'description', 'servings', 'prep_minutes', 'cook_minutes', 'total_minutes', 'ingredients', 'steps',
  'tags', 'source_type', 'source_url', 'source_book', 'source_page', 'status',
] as const satisfies readonly (keyof RecipeInput)[]

/** Inserts or updates a recipe, adding any brand-new tags to the tag list. */
export async function saveRecipe(input: RecipeInput, knownTags: Tag[], id?: string): Promise<Recipe> {
  const known = new Set(knownTags.map((t) => t.name))
  const fresh = input.tags.filter((t) => !known.has(t))
  if (fresh.length) {
    await supabase.from('tags').upsert(fresh.map((name) => ({ name, grp: 'other' })), { onConflict: 'name', ignoreDuplicates: true })
  }
  const row = Object.fromEntries(FIELDS.map((f) => [f, input[f]]))
  const q = id
    ? supabase.from('recipes').update(row).eq('id', id).select().single()
    : supabase.from('recipes').insert(row).select().single()
  const { data, error } = await q
  if (error) throw error
  return data as Recipe
}
