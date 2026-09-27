// Uploads every recipe in import/recipes/*.json (photos + text) to Supabase.
// Safe to re-run: finished recipes are recorded in import/state.json and skipped.
//
//   npm run import:upload                 # everything not yet uploaded
//   npm run import:upload -- --dry-run    # just check
//   npm run import:upload -- --only chicken-marbella.json

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  admin, downloadUrl, ensureTags, PHOTOS_DIR, readJson, recipeRow, RECIPES_DIR, STATE_FILE, uploadImage, validate, writeJson,
  type RecipeFile,
} from './lib.ts'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null

const state = readJson<Record<string, string>>(STATE_FILE, {})
const files = readdirSync(RECIPES_DIR)
  .filter((f) => f.endsWith('.json'))
  .filter((f) => !only || f === only)
  .sort()

const db = dryRun ? null : admin()
let done = 0
let skipped = 0
let failed = 0

for (const file of files) {
  if (state[file]) {
    skipped++
    continue
  }
  let r: RecipeFile
  try {
    r = JSON.parse(readFileSync(join(RECIPES_DIR, file), 'utf8'))
  } catch (e) {
    console.error(`✗ ${file}: invalid JSON (${(e as Error).message})`)
    failed++
    continue
  }
  const problems = validate(r)
  if (problems.length) {
    console.error(`✗ ${file}: ${problems.join('; ')}`)
    failed++
    continue
  }
  if (dryRun) {
    console.log(`✓ ${file}: ${r.title}`)
    continue
  }

  try {
    const row = recipeRow(r)
    await ensureTags(db!, row.tags)
    const { data, error } = await db!.from('recipes').insert(row).select('id').single()
    if (error) throw new Error(error.message)
    const id = data.id as string
    // Record right away so a failure later never creates a duplicate recipe.
    state[file] = id
    writeJson(STATE_FILE, state)

    const read = (f: string) => readFileSync(join(PHOTOS_DIR, f))
    const covers: string[] = []
    for (const [i, c] of (r.dish_crops ?? []).entries()) {
      covers.push(await uploadImage(db!, id, read(c.file), 'source', { sort: i, crop: c }))
    }
    for (const [i, f] of (r.dish_photos ?? []).entries()) {
      covers.push(await uploadImage(db!, id, read(f), 'source', { sort: 10 + i }))
    }
    for (const [i, u] of (r.image_urls ?? []).slice(0, 1).entries()) {
      try {
        covers.push(await uploadImage(db!, id, await downloadUrl(u), 'source', { sort: 20 + i }))
      } catch (e) {
        console.warn(`  ! image ${u}: ${(e as Error).message}`)
      }
    }
    const ours: string[] = []
    for (const [i, f] of (r.our_photos ?? []).entries()) ours.push(await uploadImage(db!, id, read(f), 'ours', { sort: i }))
    const pages: string[] = []
    for (const [i, f] of (r.pages ?? []).entries()) pages.push(await uploadImage(db!, id, read(f), 'page', { sort: i }))

    const hero = covers[0] ?? ours[0] ?? pages[0]
    if (hero) await db!.from('recipes').update({ hero_photo_id: hero }).eq('id', id)
    if (r.notes?.length) {
      await db!.from('recipe_notes').insert(r.notes.map((body) => ({ recipe_id: id, body, author: null })))
    }
    done++
    console.log(`✓ ${r.title}  (${pages.length} pages, ${covers.length + ours.length} dish photos)`)
  } catch (e) {
    failed++
    console.error(`✗ ${file}: ${(e as Error).message}`)
    if (state[file]) console.error(`  The recipe row was created (${state[file]}); fix it in the app or delete it there and remove "${file}" from import/state.json to retry.`)
  }
}

console.log(`\n${dryRun ? 'Checked' : 'Uploaded'} ${dryRun ? files.length - skipped - failed : done}, skipped ${skipped} already uploaded, ${failed} problems.`)
if (failed) process.exitCode = 1
