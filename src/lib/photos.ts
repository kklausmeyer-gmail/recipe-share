import { supabase } from './supabase'
import type { Photo, PhotoKind, Recipe } from './types'

const BUCKET = 'photos'
const EXPIRES_SECONDS = 60 * 60 * 24 * 7
const CACHE_KEY = 'signed-urls-v1'

// ---------------------------------------------------------------------------
// Signed URLs: the bucket is private, so every image needs a signed URL.
// Requests made in the same tick are batched into one call, and URLs are cached
// (in memory and localStorage) until a day before they expire.
// ---------------------------------------------------------------------------

type CacheEntry = { url: string; exp: number }
const cache = new Map<string, CacheEntry>()

try {
  const saved = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, CacheEntry>
  const now = Date.now()
  for (const [k, v] of Object.entries(saved)) if (v.exp > now) cache.set(k, v)
} catch {
  // Storage unavailable; the in-memory cache still works.
}

let persistTimer: number | undefined
function persist() {
  window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(cache)))
    } catch {
      // ignore
    }
  }, 500)
}

let pending = new Map<string, ((url: string | null) => void)[]>()
let flushScheduled = false

async function flush() {
  flushScheduled = false
  const batch = pending
  pending = new Map()
  const paths = [...batch.keys()]
  for (let i = 0; i < paths.length; i += 200) {
    const chunk = paths.slice(i, i + 200)
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(chunk, EXPIRES_SECONDS)
    const exp = Date.now() + (EXPIRES_SECONDS - 86400) * 1000
    const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
    for (const p of chunk) {
      const url = byPath.get(p) ?? null
      if (url) cache.set(p, { url, exp })
      batch.get(p)?.forEach((resolve) => resolve(url))
    }
  }
  persist()
}

export function cachedUrl(path: string): string | null {
  const hit = cache.get(path)
  return hit && hit.exp > Date.now() ? hit.url : null
}

export function signedUrl(path: string): Promise<string | null> {
  const hit = cachedUrl(path)
  if (hit) return Promise.resolve(hit)
  return new Promise((resolve) => {
    const list = pending.get(path) ?? []
    list.push(resolve)
    pending.set(path, list)
    if (!flushScheduled) {
      flushScheduled = true
      window.setTimeout(flush, 10)
    }
  })
}

// ---------------------------------------------------------------------------
// Choosing a cover photo
// ---------------------------------------------------------------------------

const COVER_ORDER: PhotoKind[] = ['source', 'ours', 'page']

export function coverPhoto(recipe: Recipe, photos: Photo[]): Photo | null {
  if (recipe.hero_photo_id) {
    const hero = photos.find((p) => p.id === recipe.hero_photo_id)
    if (hero) return hero
  }
  for (const kind of COVER_ORDER) {
    const list = photos.filter((p) => p.kind === kind)
    if (list.length) {
      // Newest of our own photos, otherwise the first by sort order.
      return kind === 'ours'
        ? list.sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
        : list.sort((a, b) => a.sort - b.sort)[0]
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Uploading: resize in the browser, then store a large and a small JPEG.
// ---------------------------------------------------------------------------

async function resize(file: Blob, maxEdge: number, quality: number): Promise<{ blob: Blob; w: number; h: number }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality),
  )
  return { blob, w, h }
}

export async function uploadPhoto(
  recipeId: string,
  file: Blob,
  kind: PhotoKind,
  opts: { cookLogId?: string | null; sort?: number } = {},
): Promise<Photo> {
  const id = crypto.randomUUID()
  // Recipe pages need to stay legible, so they get a bigger large size.
  const lg = await resize(file, kind === 'page' ? 2200 : 1600, 0.82)
  const sm = await resize(file, 600, 0.75)
  const path_lg = `recipes/${recipeId}/${id}-lg.jpg`
  const path_sm = `recipes/${recipeId}/${id}-sm.jpg`
  const store = supabase.storage.from(BUCKET)
  const up1 = await store.upload(path_lg, lg.blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
  if (up1.error) throw up1.error
  const up2 = await store.upload(path_sm, sm.blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
  if (up2.error) throw up2.error
  const { data, error } = await supabase
    .from('recipe_photos')
    .insert({
      id,
      recipe_id: recipeId,
      kind,
      path_lg,
      path_sm,
      width: lg.w,
      height: lg.h,
      sort: opts.sort ?? 0,
      cook_log_id: opts.cookLogId ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as Photo
}

export async function deletePhoto(photo: Photo): Promise<void> {
  const { error } = await supabase.from('recipe_photos').delete().eq('id', photo.id)
  if (error) throw error
  // Split recipes share photo files, so only remove the files once nothing uses them.
  const { count } = await supabase
    .from('recipe_photos')
    .select('id', { count: 'exact', head: true })
    .eq('path_lg', photo.path_lg)
  if (count === 0) await supabase.storage.from(BUCKET).remove([photo.path_lg, photo.path_sm])
}

/** Adds existing photos to another recipe, sharing the same stored files. Returns old id → new id. */
export async function copyPhotos(photos: Photo[], recipeId: string): Promise<Map<string, string>> {
  const ids = new Map(photos.map((p) => [p.id, crypto.randomUUID()]))
  if (!photos.length) return ids
  const { error } = await supabase.from('recipe_photos').insert(
    photos.map((p) => ({
      id: ids.get(p.id),
      recipe_id: recipeId,
      kind: p.kind,
      path_lg: p.path_lg,
      path_sm: p.path_sm,
      width: p.width,
      height: p.height,
      sort: p.sort,
    })),
  )
  if (error) throw error
  return ids
}

/** Downloads a web image through the Edge Function (browsers can't fetch other sites' images). */
export async function fetchRemoteImage(url: string): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke('import-url', { body: { url, mode: 'image' } })
  if (error) throw error
  if (!(data instanceof Blob)) throw new Error('Unexpected response')
  return data
}
