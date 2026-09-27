// The transcription queue for recipes added in the app as photos only.
//
//   npm run queue:pull   downloads each queued recipe's pages to import/queue/<id>/
//                        with a recipe.json for Claude Code to fill in
//   npm run queue:push   uploads the filled-in recipe.json files and marks them ready

import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { admin, ensureDir, ensureTags, QUEUE_DIR, recipeRow, uploadImage, validate, writeJson, type RecipeFile } from './lib.ts'

const db = admin()
const cmd = process.argv[2]

if (cmd === 'pull') {
  const { data: recipes, error } = await db.from('recipes').select('*').eq('status', 'needs_transcription')
  if (error) throw error
  if (!recipes?.length) console.log('The queue is empty.')
  for (const r of recipes ?? []) {
    const dir = join(QUEUE_DIR, r.id)
    ensureDir(dir)
    const { data: photos } = await db.from('recipe_photos').select('*').eq('recipe_id', r.id).eq('kind', 'page').order('sort')
    const pages: string[] = []
    for (const [i, p] of (photos ?? []).entries()) {
      const name = `page-${i + 1}.jpg`
      const { data: blob, error: e } = await db.storage.from('photos').download(p.path_lg)
      if (e || !blob) throw new Error(`download ${p.path_lg}: ${e?.message}`)
      writeFileSync(join(dir, name), Buffer.from(await blob.arrayBuffer()))
      pages.push(name)
    }
    if (!existsSync(join(dir, 'recipe.json'))) {
      const stub: RecipeFile = {
        title: r.title,
        description: r.description,
        servings: r.servings,
        ingredients: r.ingredients,
        steps: r.steps,
        tags: r.tags,
        source_type: 'photo',
        source_book: r.source_book,
        source_page: r.source_page,
        pages,
        dish_crops: [],
        notes: [],
      }
      writeJson(join(dir, 'recipe.json'), stub)
    }
    console.log(`↓ ${r.title}: ${pages.length} pages → import/queue/${r.id}/`)
  }
} else if (cmd === 'push') {
  ensureDir(QUEUE_DIR)
  const dirs = readdirSync(QUEUE_DIR).filter((d) => d !== 'done' && existsSync(join(QUEUE_DIR, d, 'recipe.json')))
  for (const id of dirs) {
    const dir = join(QUEUE_DIR, id)
    const r = JSON.parse(readFileSync(join(dir, 'recipe.json'), 'utf8')) as RecipeFile
    const problems = validate(r, dir)
    if (!r.ingredients.length || !r.steps.length) problems.push('not transcribed yet')
    if (problems.length) {
      console.log(`… ${r.title}: ${problems.join('; ')}`)
      continue
    }
    const row = recipeRow(r)
    await ensureTags(db, row.tags)
    const { error } = await db.from('recipes').update(row).eq('id', id)
    if (error) throw error
    const { data: current } = await db.from('recipes').select('hero_photo_id').eq('id', id).single()
    for (const [i, c] of (r.dish_crops ?? []).entries()) {
      const photoId = await uploadImage(db, id, readFileSync(join(dir, c.file)), 'source', { sort: i, crop: c })
      if (i === 0 && !current?.hero_photo_id) await db.from('recipes').update({ hero_photo_id: photoId }).eq('id', id)
    }
    if (r.notes?.length) await db.from('recipe_notes').insert(r.notes.map((body) => ({ recipe_id: id, body, author: null })))
    ensureDir(join(QUEUE_DIR, 'done'))
    renameSync(dir, join(QUEUE_DIR, 'done', id))
    console.log(`✓ ${r.title}`)
  }
} else {
  console.log('Usage: npm run queue:pull | npm run queue:push')
}
