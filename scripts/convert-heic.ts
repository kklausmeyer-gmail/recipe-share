// Converts iPhone HEIC photos in import/photos/ to JPEG (works on Windows and Mac).
// Originals are moved to import/heic-originals/ so nothing is lost.
//
//   npm run import:heic

import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join, parse } from 'node:path'
import convert from 'heic-convert'
import { ensureDir, IMPORT_DIR, PHOTOS_DIR } from './lib.ts'

const originals = join(IMPORT_DIR, 'heic-originals')
const files = readdirSync(PHOTOS_DIR).filter((f) => /\.heic$/i.test(f))
if (!files.length) console.log('No HEIC photos found in import/photos.')
ensureDir(originals)

for (const [i, f] of files.entries()) {
  const out = join(PHOTOS_DIR, `${parse(f).name}.jpg`)
  if (existsSync(out)) {
    console.log(`- ${f}: ${parse(out).base} already exists, skipping`)
    continue
  }
  const jpeg = await convert({ buffer: readFileSync(join(PHOTOS_DIR, f)), format: 'JPEG', quality: 0.9 })
  writeFileSync(out, Buffer.from(jpeg))
  renameSync(join(PHOTOS_DIR, f), join(originals, f))
  console.log(`✓ ${i + 1}/${files.length} ${f}`)
}
