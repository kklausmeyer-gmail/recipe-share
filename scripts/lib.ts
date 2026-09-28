// Shared helpers for the import scripts. These run on your own computer with the
// Supabase *secret* key from .env.local, so they bypass row-level security.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

export const ROOT = resolve(import.meta.dirname, '..')
export const IMPORT_DIR = join(ROOT, 'import')
export const PHOTOS_DIR = join(IMPORT_DIR, 'photos')
export const RECIPES_DIR = join(IMPORT_DIR, 'recipes')
export const QUEUE_DIR = join(IMPORT_DIR, 'queue')
export const STATE_FILE = join(IMPORT_DIR, 'state.json')

export type Kind = 'page' | 'source' | 'ours'

export interface Crop {
  /** Photo file the crop comes from. */
  file: string
  /** Fractions (0 to 1) of the upright image's width and height. */
  x: number
  y: number
  w: number
  h: number
}

/** The format Claude Code writes for each recipe during the import (see docs/IMPORT.md). */
export interface RecipeFile {
  title: string
  description?: string | null
  servings?: string | null
  prep_minutes?: number | null
  cook_minutes?: number | null
  total_minutes?: number | null
  ingredients: string[]
  steps: string[]
  tags?: string[]
  source_type?: 'photo' | 'link' | 'manual'
  source_url?: string | null
  source_book?: string | null
  source_page?: string | null
  /** Photos of the recipe itself, in reading order. */
  pages?: string[]
  /** The finished-dish picture printed on a page, cropped out of that page photo. */
  dish_crops?: Crop[]
  /** Separate photos showing the book's/site's finished dish. */
  dish_photos?: string[]
  /** Our own photos of the dish. */
  our_photos?: string[]
  /** Web images (from link imports). */
  image_urls?: string[]
  /** Handwritten notes on the page, saved as recipe notes. */
  notes?: string[]
}

export function admin(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing SUPABASE_URL / SUPABASE_SECRET_KEY. Copy .env.example to .env.local and fill it in.')
    process.exit(1)
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback
}

export function writeJson(path: string, data: unknown) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'recipe'
  )
}

export function ensureDir(path: string) {
  mkdirSync(path, { recursive: true })
}

/** Problems that would make an upload fail or look wrong. */
export function validate(r: RecipeFile, photosDir = PHOTOS_DIR): string[] {
  const problems: string[] = []
  if (!r.title?.trim()) problems.push('missing title')
  if (!Array.isArray(r.ingredients)) problems.push('ingredients must be a list')
  if (!Array.isArray(r.steps)) problems.push('steps must be a list')
  const files = [...(r.pages ?? []), ...(r.dish_photos ?? []), ...(r.our_photos ?? []), ...(r.dish_crops ?? []).map((c) => c.file)]
  for (const f of files) if (!existsSync(join(photosDir, f))) problems.push(`photo not found: ${f}`)
  for (const c of r.dish_crops ?? []) {
    const bad = [c.x, c.y, c.w, c.h].some((n) => typeof n !== 'number' || n < 0 || n > 1) || c.x + c.w > 1.001 || c.y + c.h > 1.001
    if (bad) problems.push(`crop on ${c.file} is outside the image`)
  }
  if (!r.pages?.length && r.source_type !== 'link' && !r.source_url) problems.push('no pages listed')
  return problems
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export interface Processed {
  lg: Buffer
  sm: Buffer
  width: number
  height: number
}

export async function processImage(input: Buffer, kind: Kind, crop?: Omit<Crop, 'file'>): Promise<Processed> {
  // Apply EXIF rotation first so crops are relative to what you see.
  let upright = await sharp(input).rotate().toBuffer()
  if (crop) {
    const meta = await sharp(upright).metadata()
    const W = meta.width!
    const H = meta.height!
    const left = Math.max(0, Math.round(crop.x * W))
    const top = Math.max(0, Math.round(crop.y * H))
    upright = await sharp(upright)
      .extract({
        left,
        top,
        width: Math.max(1, Math.min(W - left, Math.round(crop.w * W))),
        height: Math.max(1, Math.min(H - top, Math.round(crop.h * H))),
      })
      .toBuffer()
  }
  const maxEdge = kind === 'page' ? 2200 : 1600
  const lg = await sharp(upright)
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true })
  const sm = await sharp(upright)
    .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75, mozjpeg: true })
    .toBuffer()
  return { lg: lg.data, sm, width: lg.info.width, height: lg.info.height }
}

export async function uploadImage(
  db: SupabaseClient,
  recipeId: string,
  input: Buffer,
  kind: Kind,
  opts: { sort?: number; crop?: Omit<Crop, 'file'> } = {},
): Promise<string> {
  const img = await processImage(input, kind, opts.crop)
  const id = randomUUID()
  const path_lg = `recipes/${recipeId}/${id}-lg.jpg`
  const path_sm = `recipes/${recipeId}/${id}-sm.jpg`
  for (const [path, buf] of [
    [path_lg, img.lg],
    [path_sm, img.sm],
  ] as const) {
    const { error } = await db.storage.from('photos').upload(path, buf, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: true })
    if (error) throw new Error(`upload ${path}: ${error.message}`)
  }
  const { error } = await db.from('recipe_photos').insert({
    id,
    recipe_id: recipeId,
    kind,
    path_lg,
    path_sm,
    width: img.width,
    height: img.height,
    sort: opts.sort ?? 0,
  })
  if (error) throw new Error(`recipe_photos: ${error.message}`)
  return id
}

export async function downloadUrl(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (recipe-share import)' } })
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

/** Recipe columns from a RecipeFile. */
export function recipeRow(r: RecipeFile) {
  const ready = r.ingredients.length > 0 && r.steps.length > 0
  return {
    title: r.title.trim(),
    description: r.description ?? null,
    servings: r.servings ?? null,
    prep_minutes: r.prep_minutes ?? null,
    cook_minutes: r.cook_minutes ?? null,
    total_minutes: r.total_minutes ?? null,
    ingredients: r.ingredients,
    steps: r.steps,
    tags: [...new Set((r.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))],
    source_type: r.source_type ?? (r.source_url ? 'link' : 'photo'),
    source_url: r.source_url ?? null,
    source_book: r.source_book ?? null,
    source_page: r.source_page ?? null,
    status: ready ? 'ready' : 'needs_transcription',
  }
}

export async function ensureTags(db: SupabaseClient, tags: string[]) {
  if (!tags.length) return
  await db.from('tags').upsert(
    tags.map((name) => ({ name, grp: 'other' })),
    { onConflict: 'name', ignoreDuplicates: true },
  )
}
