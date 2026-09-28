// Builds import/review.html: a visual checklist of every transcribed recipe,
// its pages, the cropped dish photo, and any photos no recipe uses yet.
//
//   npm run import:review   then open import/review.html in a browser

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { IMPORT_DIR, PHOTOS_DIR, readJson, RECIPES_DIR, STATE_FILE, validate, type RecipeFile } from './lib.ts'

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const img = (f: string) => `photos/${encodeURIComponent(f)}`

/** Upright pixel size, so crop previews get the right shape. */
async function uprightSize(file: string): Promise<[number, number]> {
  try {
    const m = await sharp(join(PHOTOS_DIR, file)).metadata()
    const swap = (m.orientation ?? 1) >= 5
    return swap ? [m.height!, m.width!] : [m.width!, m.height!]
  } catch {
    return [1, 1]
  }
}

const photos = existsSync(PHOTOS_DIR) ? readdirSync(PHOTOS_DIR).filter((f) => /\.(jpe?g|png|webp|heic)$/i.test(f)).sort() : []
const state = readJson<Record<string, string>>(STATE_FILE, {})
const files = existsSync(RECIPES_DIR) ? readdirSync(RECIPES_DIR).filter((f) => f.endsWith('.json')).sort() : []

const used = new Map<string, string[]>()
const cards: string[] = []
let problemCount = 0

for (const file of files) {
  let r: RecipeFile
  try {
    r = JSON.parse(readFileSync(join(RECIPES_DIR, file), 'utf8'))
  } catch (e) {
    problemCount++
    cards.push(`<div class="card bad"><h3>${esc(file)}</h3><p class="warn">Invalid JSON: ${esc((e as Error).message)}</p></div>`)
    continue
  }
  const refs = [...(r.pages ?? []), ...(r.dish_photos ?? []), ...(r.our_photos ?? []), ...(r.dish_crops ?? []).map((c) => c.file)]
  for (const f of new Set(refs)) used.set(f, [...(used.get(f) ?? []), r.title])
  const problems = validate(r)
  if (!r.ingredients?.length) problems.push('no ingredients')
  if (!r.steps?.length) problems.push('no steps')
  if (problems.length) problemCount++

  const cropHtml: string[] = []
  for (const c of r.dish_crops ?? []) {
    const [W, H] = await uprightSize(c.file)
    cropHtml.push(`<div class="crop" style="aspect-ratio:${W * c.w}/${H * c.h}">
        <img src="${img(c.file)}" style="width:${100 / c.w}%;left:${(-c.x / c.w) * 100}%;top:${(-c.y / c.h) * 100}%">
      </div>`)
  }
  const crops = cropHtml.join('')
  const dish = [...(r.dish_photos ?? []), ...(r.our_photos ?? [])].map((f) => `<img class="thumb" src="${img(f)}" title="${esc(f)}">`).join('')
  const web = (r.image_urls ?? []).slice(0, 1).map((u) => `<img class="thumb" src="${esc(u)}">`).join('')
  const pages = (r.pages ?? []).map((f) => `<a href="${img(f)}" target="_blank"><img class="page" src="${img(f)}" title="${esc(f)}"></a>`).join('')

  cards.push(`<div class="card ${problems.length ? 'bad' : ''}">
    <div class="head"><h3>${esc(r.title)}</h3><span class="file">${esc(file)}${state[file] ? ' · uploaded' : ''}</span></div>
    ${problems.length ? `<p class="warn">⚠ ${esc(problems.join(' · '))}</p>` : ''}
    <p class="meta">${esc([r.source_book, r.source_page && `p. ${r.source_page}`, r.source_url, r.servings && `serves ${r.servings}`].filter(Boolean).join(' · '))}</p>
    <p class="tags">${(r.tags ?? []).map((t) => `<span>${esc(t)}</span>`).join('')}</p>
    <div class="row">${crops}${dish}${web}</div>
    <div class="row">${pages}</div>
    <details><summary>${r.ingredients?.length ?? 0} ingredients, ${r.steps?.length ?? 0} steps</summary>
      <ul>${(r.ingredients ?? []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      <ol>${(r.steps ?? []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      ${r.notes?.length ? `<p><b>Notes:</b> ${esc(r.notes.join(' / '))}</p>` : ''}
    </details>
  </div>`)
}

const unused = photos.filter((p) => !used.has(p))
const shared = [...used.entries()].filter(([, t]) => t.length > 1)

const html = `<!doctype html><meta charset="utf-8"><title>Import review</title>
<style>
  body{font:15px system-ui;margin:24px;background:#faf6f0;color:#2b2622}
  h1{font-family:Georgia,serif} .summary{margin-bottom:24px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:16px}
  .card{background:#fff;border-radius:14px;padding:14px;box-shadow:0 1px 3px #0001}
  .card.bad{outline:2px solid #e0a040}
  .head{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
  h3{margin:0;font-family:Georgia,serif} .file{color:#998;font-size:12px}
  .warn{color:#a4540a;margin:6px 0} .meta{color:#7a6f66;margin:4px 0;word-break:break-all}
  .tags span{display:inline-block;background:#f6e3d9;border-radius:99px;padding:1px 8px;margin:2px;font-size:12px}
  .row{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
  .crop{position:relative;overflow:hidden;width:180px;border-radius:8px;background:#eee}
  .crop img{position:absolute;max-width:none}
  .thumb{width:180px;height:135px;object-fit:cover;border-radius:8px}
  .page{height:120px;border-radius:6px;border:1px solid #e8dfd4}
  .unused img{height:140px;border-radius:6px} .unused figure{display:inline-block;margin:4px;text-align:center;font-size:11px}
</style>
<h1>Import review</h1>
<p class="summary">${files.length} recipes · ${photos.length} photos · ${unused.length} photos not used by any recipe · ${problemCount} recipes with warnings${
  shared.length ? ` · ${shared.length} photos used by more than one recipe (fine when two recipes share a page)` : ''
}</p>
${unused.length ? `<h2>Photos not in any recipe</h2><div class="unused">${unused.map((p) => `<figure><a href="${img(p)}" target="_blank"><img src="${img(p)}" loading="lazy"></a><figcaption>${esc(p)}</figcaption></figure>`).join('')}</div>` : ''}
<h2>Recipes</h2>
<div class="grid">${cards.join('\n')}</div>`

writeFileSync(join(IMPORT_DIR, 'review.html'), html)
console.log(`Wrote import/review.html (${files.length} recipes, ${unused.length} unused photos, ${problemCount} with warnings).`)
