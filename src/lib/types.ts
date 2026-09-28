export type Role = 'owner' | 'editor'
export type PhotoKind = 'page' | 'source' | 'ours'

export interface Member {
  email: string
  display_name: string
  role: Role
  user_id: string | null
}

export interface Recipe {
  id: string
  title: string
  description: string | null
  servings: string | null
  prep_minutes: number | null
  cook_minutes: number | null
  total_minutes: number | null
  ingredients: string[]
  steps: string[]
  tags: string[]
  source_type: 'photo' | 'link' | 'manual'
  source_url: string | null
  source_book: string | null
  source_page: string | null
  status: 'ready' | 'needs_transcription'
  hero_photo_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Photo {
  id: string
  recipe_id: string
  cook_log_id: string | null
  kind: PhotoKind
  path_lg: string
  path_sm: string
  width: number | null
  height: number | null
  sort: number
  created_at: string
}

export interface Rating {
  recipe_id: string
  user_id: string
  stars: number
}

export interface CookEntry {
  id: string
  recipe_id: string
  cooked_on: string
  meal: string
  cooked_by: string | null
  notes: string | null
  created_at: string
}

export interface Note {
  id: string
  recipe_id: string
  author: string | null
  body: string
  created_at: string
}

export interface Tag {
  name: string
  grp: string
  sort: number
}

export interface PlanEntry {
  id: string
  plan_date: string
  meal: string
  recipe_id: string | null
  label: string | null
  status: 'suggested' | 'planned' | 'cooked' | 'skipped'
}

export type RecipeInput = Omit<Recipe, 'id' | 'created_by' | 'created_at' | 'updated_at' | 'hero_photo_id'>
