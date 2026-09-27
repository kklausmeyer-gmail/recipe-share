import { Check, ChevronLeft, ChevronRight, Plus, RefreshCw, ShoppingCart, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import LogCookModal from '../components/LogCookModal'
import Modal from '../components/Modal'
import StoredImage from '../components/StoredImage'
import TagChip from '../components/TagChip'
import { addDays, formatDate, today, weekStart } from '../lib/dates'
import { coverPhoto } from '../lib/photos'
import { useData } from '../lib/store'
import { suggestMeals } from '../lib/suggest'
import { supabase } from '../lib/supabase'
import type { PlanEntry, Recipe } from '../lib/types'

export default function Plan() {
  const { recipes, cookLog, tags, stats, recipeById } = useData()
  const [start, setStart] = useState(() => weekStart(today()))
  const [entries, setEntries] = useState<PlanEntry[]>([])
  const [requiredTags, setRequiredTags] = useState<string[]>([])
  const [adventure, setAdventure] = useState(0.35)
  const [picking, setPicking] = useState<string | null>(null)
  const [logging, setLogging] = useState<PlanEntry | null>(null)
  const [busy, setBusy] = useState(false)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start])
  const end = days[6]
  const now = today()

  const load = useCallback(async () => {
    const { data } = await supabase.from('meal_plan').select('*').gte('plan_date', start).lte('plan_date', end).eq('meal', 'dinner')
    setEntries((data as PlanEntry[]) ?? [])
  }, [start, end])
  useEffect(() => {
    load()
  }, [load])

  const dinnersOn = (d: string) => cookLog.filter((c) => c.cooked_on === d && c.meal === 'dinner')
  const dietTags = tags.filter((t) => t.grp === 'diet')

  async function suggest(replaceDate?: string) {
    setBusy(true)
    const keep = entries.filter((e) => e.status !== 'suggested' || (replaceDate && e.plan_date !== replaceDate))
    const openDays = replaceDate
      ? [replaceDate]
      : days.filter((d) => d >= now && !keep.some((e) => e.plan_date === d) && !dinnersOn(d).length)
    const exclude = keep.flatMap((e) => (e.recipe_id ? [e.recipe_id] : []))
    if (replaceDate) {
      const current = entries.find((e) => e.plan_date === replaceDate)?.recipe_id
      if (current) exclude.push(current)
    }
    const picks = suggestMeals({
      recipes,
      stats,
      tags,
      alreadyPlanned: exclude,
      today: now,
      count: openDays.length,
      requiredTags,
      adventure,
    })
    const toReplace = entries.filter((e) => e.status === 'suggested' && openDays.includes(e.plan_date)).map((e) => e.id)
    if (toReplace.length) await supabase.from('meal_plan').delete().in('id', toReplace)
    const rows = picks.map((recipe_id, i) => ({ plan_date: openDays[i], meal: 'dinner', recipe_id, status: 'suggested' }))
    if (rows.length) await supabase.from('meal_plan').insert(rows)
    await load()
    setBusy(false)
  }

  async function setStatus(e: PlanEntry, status: PlanEntry['status']) {
    await supabase.from('meal_plan').update({ status }).eq('id', e.id)
    load()
  }

  async function remove(e: PlanEntry) {
    await supabase.from('meal_plan').delete().eq('id', e.id)
    load()
  }

  async function pick(date: string, recipe: Recipe) {
    await supabase.from('meal_plan').delete().eq('plan_date', date).eq('meal', 'dinner').in('status', ['suggested', 'planned'])
    await supabase.from('meal_plan').insert({ plan_date: date, meal: 'dinner', recipe_id: recipe.id, status: 'planned' })
    setPicking(null)
    load()
  }

  const suggestedCount = entries.filter((e) => e.status === 'suggested').length

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="page-title">Meal plan</h1>
        <div className="flex items-center gap-1">
          <button className="btn !p-2" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week">
            <ChevronLeft size={18} />
          </button>
          <button className="btn" onClick={() => setStart(weekStart(today()))}>
            This week
          </button>
          <button className="btn !p-2" onClick={() => setStart(addDays(start, 7))} aria-label="Next week">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <p className="-mt-3 text-muted">
        {formatDate(start)} – {formatDate(end)}
      </p>

      {end >= now && (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary" onClick={() => suggest()} disabled={busy}>
              <Sparkles size={16} /> {suggestedCount ? 'Re-roll suggestions' : 'Suggest dinners'}
            </button>
            <Link to={`/grocery?from=${start}&to=${end}`} className="btn">
              <ShoppingCart size={16} /> Grocery list
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-sm text-muted">Only:</span>
            {dietTags.map((t) => (
              <TagChip
                key={t.name}
                name={t.name}
                small
                active={requiredTags.includes(t.name)}
                onClick={() =>
                  setRequiredTags(requiredTags.includes(t.name) ? requiredTags.filter((x) => x !== t.name) : [...requiredTags, t.name])
                }
              />
            ))}
          </div>
          <label className="flex items-center gap-3 text-sm text-muted">
            <span>Old favorites</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={adventure}
              onChange={(e) => setAdventure(Number(e.target.value))}
              className="flex-1 accent-accent"
            />
            <span>Try new things</span>
          </label>
        </div>
      )}

      <ul className="space-y-2">
        {days.map((d) => {
          const entry = entries.find((e) => e.plan_date === d)
          const made = dinnersOn(d)
          const recipe = recipeById(entry?.recipe_id ?? undefined)
          const isPast = d < now
          return (
            <li
              key={d}
              className={`card flex items-center gap-3 !p-3 ${d === now ? 'ring-2 ring-accent/40' : ''} ${
                entry?.status === 'suggested' ? 'border border-dashed border-accent/50 !bg-white/60' : ''
              }`}
            >
              <div className="w-14 shrink-0 text-center">
                <p className="text-xs uppercase text-muted">{formatDate(d, { weekday: 'short' })}</p>
                <p className="font-serif text-xl font-semibold">{Number(d.slice(8))}</p>
              </div>

              {made.length > 0 && !(entry && entry.status !== 'cooked') ? (
                <div className="flex flex-1 flex-col gap-1">
                  {made.map((m) => {
                    const r = recipeById(m.recipe_id)
                    return r ? <DayRecipe key={m.id} recipe={r} note="Made it" /> : null
                  })}
                </div>
              ) : recipe && entry ? (
                <>
                  <DayRecipe recipe={recipe} note={entry.status === 'suggested' ? 'Suggestion' : entry.status === 'cooked' ? 'Made it' : undefined} />
                  <div className="flex shrink-0 gap-1">
                    {entry.status === 'suggested' && (
                      <>
                        <button className="btn !p-2" title="Keep" onClick={() => setStatus(entry, 'planned')}>
                          <Check size={16} />
                        </button>
                        <button className="btn !p-2" title="Something else" onClick={() => suggest(d)} disabled={busy}>
                          <RefreshCw size={16} />
                        </button>
                      </>
                    )}
                    {entry.status === 'planned' && d <= now && (
                      <button className="btn !px-3 text-xs" onClick={() => setLogging(entry)}>
                        Made it
                      </button>
                    )}
                    {entry.status !== 'cooked' && (
                      <button className="btn-ghost !p-2" title="Remove" onClick={() => remove(entry)}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </>
              ) : isPast ? (
                <p className="flex-1 text-sm text-muted">Nothing logged</p>
              ) : (
                <button className="btn-ghost flex-1 justify-start" onClick={() => setPicking(d)}>
                  <Plus size={16} /> Pick a recipe
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <History />

      {picking && <PickRecipe date={picking} onPick={(r) => pick(picking, r)} onClose={() => setPicking(null)} />}
      {logging && recipeById(logging.recipe_id ?? undefined) && (
        <LogCookModal
          recipe={recipeById(logging.recipe_id ?? undefined)!}
          defaultDate={logging.plan_date}
          onClose={() => setLogging(null)}
          onLogged={() => setStatus(logging, 'cooked')}
        />
      )}
    </div>
  )
}

function DayRecipe({ recipe, note }: { recipe: Recipe; note?: string }) {
  const { photosByRecipe } = useData()
  const cover = coverPhoto(recipe, photosByRecipe.get(recipe.id) ?? [])
  return (
    <Link to={`/r/${recipe.id}`} className="flex min-w-0 flex-1 items-center gap-3">
      <StoredImage path={cover?.path_sm} alt="" className="h-14 w-14 shrink-0 rounded-xl" />
      <div className="min-w-0">
        <p className="line-clamp-2 font-medium leading-snug">{recipe.title}</p>
        {note && <p className="text-xs text-muted">{note}</p>}
      </div>
    </Link>
  )
}

function History() {
  const { cookLog, recipeById, members } = useData()
  const owners = new Set(members.filter((m) => m.role === 'owner' && m.user_id).map((m) => m.user_id))
  const dinners = cookLog
    .filter((c) => c.meal === 'dinner' && (!c.cooked_by || owners.has(c.cooked_by)))
    .sort((a, b) => b.cooked_on.localeCompare(a.cooked_on))

  const since = addDays(today(), -90)
  const counts = new Map<string, number>()
  for (const c of dinners) if (c.cooked_on >= since) counts.set(c.recipe_id, (counts.get(c.recipe_id) ?? 0) + 1)
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const weeks = new Map<string, typeof dinners>()
  for (const c of dinners.slice(0, 60)) {
    const w = weekStart(c.cooked_on)
    weeks.set(w, [...(weeks.get(w) ?? []), c])
  }

  if (!dinners.length) return null
  return (
    <section className="grid gap-6 pt-4 md:grid-cols-[2fr_1fr]">
      <div>
        <h2 className="section-title">What we've had</h2>
        <div className="space-y-4">
          {[...weeks.entries()].slice(0, 8).map(([w, list]) => (
            <div key={w}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Week of {formatDate(w)}</p>
              <ul className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
                {list.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <Link to={`/r/${c.recipe_id}`} className="line-clamp-1 hover:text-accent">
                      {recipeById(c.recipe_id)?.title ?? 'Deleted recipe'}
                    </Link>
                    <span className="shrink-0 text-muted">{formatDate(c.cooked_on, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      {top.length > 0 && (
        <div>
          <h2 className="section-title">Most made (90 days)</h2>
          <ol className="space-y-2">
            {top.map(([id, n]) => (
              <li key={id} className="flex justify-between gap-3 text-sm">
                <Link to={`/r/${id}`} className="line-clamp-1 hover:text-accent">
                  {recipeById(id)?.title}
                </Link>
                <span className="text-muted">{n}×</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

function PickRecipe({ date, onPick, onClose }: { date: string; onPick: (r: Recipe) => void; onClose: () => void }) {
  const { recipes } = useData()
  const [q, setQ] = useState('')
  const list = recipes.filter((r) => r.title.toLowerCase().includes(q.toLowerCase())).slice(0, 50)
  return (
    <Modal title={`Dinner on ${formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}`} onClose={onClose}>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recipes" />
      <ul className="mt-3 divide-y divide-line">
        {list.map((r) => (
          <li key={r.id}>
            <button className="w-full py-2.5 text-left hover:text-accent" onClick={() => onPick(r)}>
              {r.title}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
