import { useState, type FormEvent, type ReactNode } from 'react'
import { useData } from '../lib/store'
import type { RecipeInput } from '../lib/types'
import TagChip from './TagChip'

export type Draft = RecipeInput

export const emptyDraft = (): Draft => ({
  title: '',
  description: null,
  servings: null,
  prep_minutes: null,
  cook_minutes: null,
  total_minutes: null,
  ingredients: [],
  steps: [],
  tags: [],
  source_type: 'manual',
  source_url: null,
  source_book: null,
  source_page: null,
  status: 'ready',
})

const toLines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
const toInt = (s: string) => (s.trim() && !Number.isNaN(Number(s)) ? Math.round(Number(s)) : null)
const orNull = (s: string) => s.trim() || null

interface Props {
  initial: Draft
  submitLabel: string
  onSubmit: (d: Draft) => Promise<void>
  children?: ReactNode
}

export default function RecipeForm({ initial, submitLabel, onSubmit, children }: Props) {
  const { tags: allTags } = useData()
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description ?? '')
  const [servings, setServings] = useState(initial.servings ?? '')
  const [prep, setPrep] = useState(initial.prep_minutes?.toString() ?? '')
  const [cook, setCook] = useState(initial.cook_minutes?.toString() ?? '')
  const [total, setTotal] = useState(initial.total_minutes?.toString() ?? '')
  const [ingredients, setIngredients] = useState(initial.ingredients.join('\n'))
  const [steps, setSteps] = useState(initial.steps.join('\n'))
  const [tags, setTags] = useState<string[]>(initial.tags)
  const [newTag, setNewTag] = useState('')
  const [sourceUrl, setSourceUrl] = useState(initial.source_url ?? '')
  const [book, setBook] = useState(initial.source_book ?? '')
  const [page, setPage] = useState(initial.source_page ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const known = new Set(allTags.map((t) => t.name))
  const extraTags = tags.filter((t) => !known.has(t))
  const groups = [...new Set(allTags.map((t) => t.grp))]
  const toggle = (t: string) => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError('Give it a title')
    setSaving(true)
    setError(null)
    const ing = toLines(ingredients)
    const st = toLines(steps)
    try {
      await onSubmit({
        ...initial,
        title: title.trim(),
        description: orNull(description),
        servings: orNull(servings),
        prep_minutes: toInt(prep),
        cook_minutes: toInt(cook),
        total_minutes: toInt(total),
        ingredients: ing,
        steps: st,
        tags,
        source_url: orNull(sourceUrl),
        source_book: orNull(book),
        source_page: orNull(page),
        status: initial.status === 'needs_transcription' && ing.length && st.length ? 'ready' : initial.status,
      })
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="field">
        <span>Short description</span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="field">
          <span>Servings</span>
          <input value={servings} onChange={(e) => setServings(e.target.value)} placeholder="4" />
        </label>
        <label className="field">
          <span>Prep (min)</span>
          <input inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value)} />
        </label>
        <label className="field">
          <span>Cook (min)</span>
          <input inputMode="numeric" value={cook} onChange={(e) => setCook(e.target.value)} />
        </label>
        <label className="field">
          <span>Total (min)</span>
          <input inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Ingredients, one per line. Start a line with # for a section heading (e.g. #Sauce).</span>
        <textarea rows={10} value={ingredients} onChange={(e) => setIngredients(e.target.value)} className="font-mono text-sm" />
      </label>
      <label className="field">
        <span>Steps, one per line. # works for headings here too.</span>
        <textarea rows={10} value={steps} onChange={(e) => setSteps(e.target.value)} />
      </label>

      <div className="field">
        <span>Tags</span>
        <div className="space-y-2">
          {groups.map((g) => (
            <div key={g} className="flex flex-wrap gap-1.5">
              {allTags
                .filter((t) => t.grp === g)
                .map((t) => (
                  <TagChip key={t.name} name={t.name} small active={tags.includes(t.name)} onClick={() => toggle(t.name)} />
                ))}
            </div>
          ))}
          {extraTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {extraTags.map((t) => (
                <TagChip key={t} name={t} small active onClick={() => toggle(t)} />
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="New tag"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const t = newTag.trim().toLowerCase()
                  if (t && !tags.includes(t)) setTags([...tags, t])
                  setNewTag('')
                }
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="field">
          <span>Web link</span>
          <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" />
        </label>
        <label className="field">
          <span>Cookbook</span>
          <input value={book} onChange={(e) => setBook(e.target.value)} />
        </label>
        <label className="field">
          <span>Page</span>
          <input value={page} onChange={(e) => setPage(e.target.value)} />
        </label>
      </div>

      {children}

      {error && <p className="text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full sm:w-auto" disabled={saving}>
        {saving ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}
