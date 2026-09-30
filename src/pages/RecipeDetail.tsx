import {
  BookOpen,
  CalendarPlus,
  ChefHat,
  ChevronLeft,
  Clock,
  ExternalLink,
  Minus,
  Pencil,
  Plus,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useConfirm } from '../components/Confirm'
import EditableNote from '../components/EditableNote'
import Lightbox from '../components/Lightbox'
import LogCookModal from '../components/LogCookModal'
import Modal from '../components/Modal'
import Stars from '../components/Stars'
import StoredImage from '../components/StoredImage'
import TagChip from '../components/TagChip'
import { addDays, formatDate, minutesLabel, relativeDays, today } from '../lib/dates'
import { headerText, isHeader, scaleLine, servingsNumber } from '../lib/ingredients'
import { coverPhoto } from '../lib/photos'
import { useAuth, useData } from '../lib/store'
import { supabase } from '../lib/supabase'
import type { Note, Photo } from '../lib/types'

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session, isOwner } = useAuth()
  const { recipeById, photosByRecipe, ratings, cookLog, nameOf, stats, refresh } = useData()
  const recipe = recipeById(id)
  const photos = useMemo(() => photosByRecipe.get(id ?? '') ?? [], [photosByRecipe, id])

  const confirm = useConfirm()
  const [notes, setNotes] = useState<Note[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [newNote, setNewNote] = useState('')
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; start: number } | null>(null)
  const [logging, setLogging] = useState(false)
  const [planning, setPlanning] = useState(false)
  const baseServings = servingsNumber(recipe?.servings)
  const [servings, setServings] = useState<number | null>(baseServings)
  useEffect(() => setServings(baseServings), [baseServings])

  useEffect(() => {
    if (!id) return
    supabase
      .from('recipe_notes')
      .select('*')
      .eq('recipe_id', id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setNotes((data as Note[]) ?? []))
  }, [id])

  if (!recipe) {
    return (
      <div className="py-20 text-center text-muted">
        Recipe not found. <Link to="/" className="text-accent underline">Back to recipes</Link>
      </div>
    )
  }

  const cover = coverPhoto(recipe, photos)
  const pages = photos.filter((p) => p.kind === 'page').sort((a, b) => a.sort - b.sort)
  const ours = photos.filter((p) => p.kind === 'ours').sort((a, b) => b.created_at.localeCompare(a.created_at))
  const sourceShots = photos.filter((p) => p.kind === 'source')
  const history = cookLog.filter((c) => c.recipe_id === recipe.id).sort((a, b) => b.cooked_on.localeCompare(a.cooked_on))
  const recipeRatings = ratings.filter((r) => r.recipe_id === recipe.id)
  const myRating = stats.get(recipe.id)?.myRating ?? null
  const factor = baseServings && servings ? servings / baseServings : 1

  async function rate(stars: number) {
    await supabase
      .from('ratings')
      .upsert({ recipe_id: recipe!.id, user_id: session!.user.id, stars, updated_at: new Date().toISOString() })
    refresh()
  }

  async function addNote() {
    const body = newNote.trim()
    if (!body) return
    const { data } = await supabase.from('recipe_notes').insert({ recipe_id: recipe!.id, body }).select().single()
    if (data) setNotes([data as Note, ...notes])
    setNewNote('')
  }

  async function saveNote(n: Note, body: string) {
    if (!body) return deleteNote(n)
    const { error } = await supabase.from('recipe_notes').update({ body }).eq('id', n.id)
    if (error) throw error
    setNotes((list) => list.map((x) => (x.id === n.id ? { ...x, body } : x)))
  }

  async function deleteNote(n: Note) {
    if (!(await confirm({ title: 'Delete this note?', message: n.body }))) return
    const { error } = await supabase.from('recipe_notes').delete().eq('id', n.id)
    if (error) return setActionError(`Couldn't delete the note: ${error.message}`)
    setNotes((list) => list.filter((x) => x.id !== n.id))
  }

  async function saveEntryNotes(entryId: string, text: string) {
    const { error } = await supabase.from('cook_log').update({ notes: text || null }).eq('id', entryId)
    if (error) throw error
    await refresh()
  }

  async function deleteEntry(entryId: string) {
    const ok = await confirm({
      title: 'Remove from cooking history?',
      message: 'This removes this entry and its notes. Photos stay in the recipe.',
      confirmLabel: 'Remove',
    })
    if (!ok) return
    const { error } = await supabase.from('cook_log').delete().eq('id', entryId)
    if (error) return setActionError(`Couldn't remove the entry: ${error.message}`)
    refresh()
  }

  const times = [
    ['Prep', minutesLabel(recipe.prep_minutes)],
    ['Cook', minutesLabel(recipe.cook_minutes)],
    ['Total', minutesLabel(recipe.total_minutes)],
  ].filter(([, v]) => v)

  return (
    <article className="pb-12">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="btn-ghost -ml-3">
          <ChevronLeft size={18} /> Back
        </button>
        <Link to={`/r/${recipe.id}/edit`} className="btn-ghost">
          <Pencil size={16} /> Edit
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.1fr_1fr] md:items-start">
        <button
          className="overflow-hidden rounded-3xl shadow-sm ring-1 ring-line"
          onClick={() => cover && setLightbox({ photos: [cover], start: 0 })}
        >
          <StoredImage path={cover?.path_lg} alt={recipe.title} className="aspect-[4/3] w-full" />
        </button>

        <div className="space-y-4">
          <h1 className="font-serif text-3xl font-semibold leading-tight md:text-4xl">{recipe.title}</h1>
          {recipe.description && <p className="text-muted">{recipe.description}</p>}

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            {recipe.servings && (
              <span className="flex items-center gap-1.5">
                <Users size={16} /> {recipe.servings}
              </span>
            )}
            {times.map(([label, v]) => (
              <span key={label} className="flex items-center gap-1.5">
                <Clock size={16} /> {label} {v}
              </span>
            ))}
            {recipe.source_book && (
              <span className="flex items-center gap-1.5">
                <BookOpen size={16} /> {recipe.source_book}
                {recipe.source_page && `, p. ${recipe.source_page}`}
              </span>
            )}
            {recipe.source_url && (
              <a href={recipe.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-accent hover:underline">
                <ExternalLink size={16} /> {new URL(recipe.source_url).hostname.replace(/^www\./, '')}
              </a>
            )}
          </div>

          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recipe.tags.map((t) => (
                <Link key={t} to={`/?tag=${encodeURIComponent(t)}`}>
                  <TagChip name={t} small />
                </Link>
              ))}
            </div>
          )}

          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Your rating</span>
              <Stars value={myRating} onChange={rate} size={24} />
            </div>
            {recipeRatings
              .filter((r) => r.user_id !== session?.user.id)
              .map((r) => (
                <div key={r.user_id} className="flex items-center justify-between text-sm text-muted">
                  <span>{nameOf(r.user_id)}</span>
                  <Stars value={r.stars} size={16} />
                </div>
              ))}
            <p className="border-t border-line pt-2 text-sm text-muted">
              {history.length
                ? `Made ${history.length} time${history.length > 1 ? 's' : ''}, last ${relativeDays(history[0].cooked_on)}`
                : "We haven't made this yet"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to={`/r/${recipe.id}/cook${factor !== 1 ? `?x=${factor}` : ''}`} className="btn-primary">
              <ChefHat size={18} /> Cook mode
            </Link>
            <button className="btn" onClick={() => setLogging(true)}>
              <UtensilsCrossed size={16} /> We made this
            </button>
            {isOwner && (
              <button className="btn" onClick={() => setPlanning(true)}>
                <CalendarPlus size={16} /> Plan it
              </button>
            )}
          </div>
        </div>
      </div>

      {recipe.status === 'needs_transcription' && (
        <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          This recipe is saved as photos only and is waiting to be typed up. You can read the original pages below, or type it in
          yourself with <Link to={`/r/${recipe.id}/edit`} className="underline">Edit</Link>.
        </div>
      )}

      {(pages.length > 0 || sourceShots.length > 0) && (
        <section className="mt-8">
          <h2 className="section-title">Original recipe</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[...pages, ...sourceShots].map((p, i, all) => (
              <button key={p.id} onClick={() => setLightbox({ photos: all, start: i })} className="shrink-0">
                <StoredImage path={p.path_sm} alt={`Page ${i + 1}`} className="h-44 w-32 rounded-xl ring-1 ring-line" />
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_1.4fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title !mb-0">Ingredients</h2>
            {baseServings && servings && (
              <div className="flex items-center gap-2 text-sm">
                <button className="btn !p-1.5" onClick={() => setServings(Math.max(1, servings - 1))} aria-label="Fewer servings">
                  <Minus size={14} />
                </button>
                <span className="w-16 text-center">{servings} serv.</span>
                <button className="btn !p-1.5" onClick={() => setServings(servings + 1)} aria-label="More servings">
                  <Plus size={14} />
                </button>
              </div>
            )}
          </div>
          {recipe.ingredients.length ? (
            <ul className="space-y-2">
              {recipe.ingredients.map((line, i) =>
                isHeader(line) ? (
                  <li key={i} className="pt-3 text-sm font-semibold uppercase tracking-wide text-accent-dark">
                    {headerText(line)}
                  </li>
                ) : (
                  <li key={i} className="flex gap-3 border-b border-line/70 pb-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                    <span>{scaleLine(line, factor)}</span>
                  </li>
                ),
              )}
            </ul>
          ) : (
            <p className="text-muted">No ingredients typed in yet.</p>
          )}
        </section>

        <section>
          <h2 className="section-title">Steps</h2>
          {recipe.steps.length ? (
            <ol className="space-y-4">
              {(() => {
                let n = 0
                return recipe.steps.map((step, i) =>
                  isHeader(step) ? (
                    <li key={i} className="pt-2 text-sm font-semibold uppercase tracking-wide text-accent-dark">
                      {headerText(step)}
                    </li>
                  ) : (
                    <li key={i} className="flex gap-4">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-serif text-sm font-semibold text-accent-dark">
                        {++n}
                      </span>
                      <p className="leading-relaxed">{step}</p>
                    </li>
                  ),
                )
              })()}
            </ol>
          ) : (
            <p className="text-muted">No steps typed in yet.</p>
          )}
        </section>
      </div>

      <section className="mt-10">
        <h2 className="section-title">Our notes</h2>
        <div className="flex gap-2">
          <input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNote()}
            placeholder="e.g. Use 1 tsp salt, not 2. Double the sauce."
          />
          <button className="btn shrink-0" onClick={addNote} disabled={!newNote.trim()}>
            Add
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="card !py-3">
              <EditableNote
                text={n.body}
                onSave={(body) => saveNote(n, body)}
                onDelete={() => deleteNote(n)}
                deleteLabel="Delete note"
              >
                <p className="mt-1 text-xs text-muted">
                  {nameOf(n.author)} · {formatDate(n.created_at.slice(0, 10))}
                </p>
              </EditableNote>
            </li>
          ))}
        </ul>
      </section>

      {ours.length > 0 && (
        <section className="mt-10">
          <h2 className="section-title">Our photos</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {ours.map((p, i) => (
              <button key={p.id} onClick={() => setLightbox({ photos: ours, start: i })}>
                <StoredImage path={p.path_sm} alt="" className="aspect-square rounded-xl" />
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="section-title">Cooking history</h2>
        {history.length ? (
          <ul className="space-y-2">
            {history.map((c) => {
              const shots = photos.filter((p) => p.cook_log_id === c.id)
              return (
                <li key={c.id} className="card !py-3">
                  <EditableNote
                    text={c.notes}
                    meta={
                      <p className="font-medium">
                        {formatDate(c.cooked_on, { weekday: 'short', month: 'short', day: 'numeric' })}
                        <span className="font-normal text-muted"> · {c.meal} · {nameOf(c.cooked_by)}</span>
                      </p>
                    }
                    placeholder="What did you change? How did it turn out?"
                    onSave={(text) => saveEntryNotes(c.id, text)}
                    onDelete={() => deleteEntry(c.id)}
                    deleteLabel="Remove entry"
                  />
                  {shots.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      {shots.map((p, i) => (
                        <button key={p.id} onClick={() => setLightbox({ photos: shots, start: i })}>
                          <StoredImage path={p.path_sm} alt="" className="h-16 w-16 rounded-lg" />
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-muted">Tap "We made this" after you cook it to start its history.</p>
        )}
      </section>

      {actionError && (
        <button
          onClick={() => setActionError(null)}
          className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 rounded-2xl bg-red-700 px-4 py-3 text-left text-sm text-white shadow-lg md:inset-x-auto md:right-6 md:max-w-sm"
        >
          {actionError} <span className="opacity-70">(tap to dismiss)</span>
        </button>
      )}
      {lightbox && <Lightbox photos={lightbox.photos} start={lightbox.start} onClose={() => setLightbox(null)} />}
      {logging && <LogCookModal recipe={recipe} onClose={() => setLogging(false)} />}
      {planning && <PlanItModal recipeId={recipe.id} onClose={() => setPlanning(false)} />}
    </article>
  )
}

function PlanItModal({ recipeId, onClose }: { recipeId: string; onClose: () => void }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today(), i))
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  async function pick(date: string) {
    setSaving(true)
    await supabase.from('meal_plan').delete().eq('plan_date', date).eq('meal', 'dinner').eq('status', 'suggested')
    await supabase.from('meal_plan').insert({ plan_date: date, meal: 'dinner', recipe_id: recipeId, status: 'planned' })
    onClose()
    navigate('/plan')
  }

  return (
    <Modal title="Plan it for dinner on…" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        {days.map((d, i) => (
          <button key={d} className="btn justify-start" disabled={saving} onClick={() => pick(d)}>
            {i === 0 ? 'Tonight' : i === 1 ? 'Tomorrow' : formatDate(d, { weekday: 'short', month: 'short', day: 'numeric' })}
          </button>
        ))}
      </div>
    </Modal>
  )
}
