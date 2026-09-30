import { useMemo, useState } from 'react'
import { copyPhotos } from '../lib/photos'
import { saveRecipe } from '../lib/recipes'
import { buildVariations, toSections, type Section } from '../lib/split'
import { useData } from '../lib/store'
import { supabase } from '../lib/supabase'
import type { Photo, Recipe } from '../lib/types'
import Modal from './Modal'

interface Props {
  recipe: Recipe
  photos: Photo[]
  onClose: () => void
  /** Called with the new recipes' ids once they're created. */
  onDone: (newIds: string[]) => void
}

/**
 * Turns one recipe with variations (sections of add-ins) into one recipe per
 * variation. Each new recipe gets the shared ingredients and steps, its own
 * section, and the original's tags, source and photos.
 */
export default function SplitRecipeModal({ recipe, photos, onClose, onDone }: Props) {
  const { tags } = useData()
  const sections = useMemo(() => toSections(recipe.ingredients), [recipe.ingredients])
  const titled = sections.filter((s): s is Section & { title: string } => s.title !== null)
  // Guess: every headed section is a variation, unless its name sounds like the shared base.
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(titled.filter((s) => !/\b(base|basic|main|for the|all)\b/i.test(s.title)).map((s) => s.title)),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const names = titled.map((s) => s.title).filter((t) => chosen.has(t))
  const variations = buildVariations(recipe.title, recipe.ingredients, recipe.steps, names)

  const toggle = (t: string) => {
    const next = new Set(chosen)
    next.has(t) ? next.delete(t) : next.add(t)
    setChosen(next)
  }

  async function split() {
    setBusy(true)
    setError(null)
    try {
      const shared = photos.filter((p) => p.kind !== 'ours')
      const ids: string[] = []
      for (const v of variations) {
        const saved = await saveRecipe({ ...recipe, title: v.title, ingredients: v.ingredients, steps: v.steps }, tags)
        const newIds = await copyPhotos(shared, saved.id)
        const hero = recipe.hero_photo_id && newIds.get(recipe.hero_photo_id)
        if (hero) await supabase.from('recipes').update({ hero_photo_id: hero }).eq('id', saved.id)
        ids.push(saved.id)
      }
      onDone(ids)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  if (titled.length < 2) {
    return (
      <Modal title="Split into separate recipes" onClose={onClose}>
        <p className="text-muted">
          To split a recipe, first give each variation its own heading in the ingredients, with a line starting with #, for example
          <b> #Almond Joy</b>. Ingredients before the first heading are shared by all of them.
        </p>
      </Modal>
    )
  }

  return (
    <Modal title="Split into separate recipes" onClose={onClose} wide>
      <div className="space-y-5">
        <p className="text-muted">
          Tick the sections that are variations. Each one becomes its own recipe with the shared ingredients, the steps, tags and photos.
          Unticked sections are shared by every recipe.
        </p>
        <ul className="space-y-2">
          {titled.map((s) => (
            <li key={s.title}>
              <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-3">
                <input type="checkbox" className="mt-1" checked={chosen.has(s.title)} onChange={() => toggle(s.title)} />
                <span>
                  <span className="font-medium">{s.title}</span>
                  <span className="block text-sm text-muted">
                    {chosen.has(s.title) ? 'Variation' : 'Shared'} · {s.lines.length} ingredient{s.lines.length === 1 ? '' : 's'}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        {variations.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-muted">This creates {variations.length} recipes:</p>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {variations.map((v) => (
                <li key={v.name}>{v.title}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-sm text-muted">
          This uses the last saved version, so save any edits first. "{recipe.title}" stays until you decide what to do with it on the
          next step.
        </p>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={split} disabled={busy || variations.length < 2}>
            {busy ? 'Creating…' : `Create ${variations.length} recipes`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
