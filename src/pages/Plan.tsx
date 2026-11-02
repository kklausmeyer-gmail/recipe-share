import { Check, ChevronLeft, ChevronRight, Plus, RefreshCw, ShoppingCart, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EventEditor, EventList, ManageEvents } from '../components/CalendarEvents'
import LogCookModal from '../components/LogCookModal'
import Modal from '../components/Modal'
import StoredImage from '../components/StoredImage'
import TagChip from '../components/TagChip'
import { eventsOn, suggestionDates, visiblePlanDays } from '../lib/calendar'
import { addDays, formatDate, today, weekStart } from '../lib/dates'
import { familiarDinners } from '../lib/meal-history'
import { coverPhoto } from '../lib/photos'
import { useData } from '../lib/store'
import { suggestMeals } from '../lib/suggest'
import { supabase } from '../lib/supabase'
import type { CalendarEvent, PlanEntry, Recipe } from '../lib/types'

export default function Plan() {
  const { recipes, cookLog, tags, stats, recipeById } = useData()
  const [start, setStart] = useState(() => weekStart(today()))
  const [entries, setEntries] = useState<PlanEntry[]>([])
  const [requiredTags, setRequiredTags] = useState<string[]>([])
  const [adventure, setAdventure] = useState(0.35)
  const [editingEntry, setEditingEntry] = useState<PlanEntry | null>(null)
  const [picking, setPicking] = useState<string | null>(null)
  const [logging, setLogging] = useState<PlanEntry | null>(null)
  const [moving, setMoving] = useState<PlanEntry[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<PlanEntry[]>([])
  const [useFamiliar, setUseFamiliar] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [eventsError, setEventsError] = useState('')
  const [eventEditor, setEventEditor] = useState<CalendarEvent | null | undefined>(undefined)
  const [manageEvents, setManageEvents] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadedStart, setLoadedStart] = useState('')
  const loadSequence = useRef(0)

  const days = useMemo(() => visiblePlanDays(start, expanded), [start, expanded])
  const end = days[days.length - 1]
  const queryEnd = addDays(start, 13)
  const now = today()

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    setLoading(true)
    try {
      // Load both weeks before expanding so the suggestion action never misses a saved plan.
      const { data, error } = await supabase.from('meal_plan').select('*').gte('plan_date', start).lte('plan_date', queryEnd).eq('meal', 'dinner')
      if (sequence !== loadSequence.current) return
      if (error) { setError(error.message); return }
      setEntries((data as PlanEntry[]) ?? [])
      setLoadedStart(start)

    } finally { if (sequence === loadSequence.current) setLoading(false) }
  }, [start, queryEnd])
  useEffect(() => {
    void load()
    return () => { loadSequence.current++ }
  }, [load])

  const loadEvents = useCallback(async () => {
    const all: CalendarEvent[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('calendar_events').select('*').order('start_date').order('id').range(from, from + 999)
      if (error) {
        setEventsError(error.code === 'PGRST205' || error.code === '42P01'
          ? 'Calendar events are not available yet. The calendar database update needs to be applied.'
          : `Could not load calendar events: ${error.message}`)
        throw error
      }
      all.push(...(data as CalendarEvent[]))
      if (data.length < 1000) break
    }
    setEvents(all)
    setEventsError('')
  }, [])
  useEffect(() => { void loadEvents().catch(() => {}) }, [loadEvents])

  useEffect(() => {
    let active = true
    supabase.from('meal_plan').select('*').lt('plan_date', now).order('plan_date', { ascending: false }).limit(1000).then(({ data, error }) => {
      if (!active) return
      if (error) setError(error.message)
      else setHistory((data as PlanEntry[]) ?? [])
    })
    return () => { active = false }
  }, [now, entries])

  const dinnersOn = (d: string) => cookLog.filter((c) => c.cooked_on === d && c.meal === 'dinner')
  const dietTags = tags.filter((t) => t.grp === 'diet')

  async function suggest(replaceEntry?: PlanEntry) {
    if (loading || loadedStart !== start) return
    setBusy(true)
    setError('')
    try {
      const visibleEntries = entries.filter((e) => days.includes(e.plan_date))
      const replaceDate = replaceEntry?.plan_date
      const keep = visibleEntries.filter((e) => replaceEntry ? e.id !== replaceEntry.id : e.status !== 'suggested')
      const openDays = replaceDate
        ? [replaceDate]
        : suggestionDates(days, visibleEntries, cookLog.filter((c) => c.meal === 'dinner').map((c) => c.cooked_on), now)
      const exclude = keep.flatMap((e) => (e.recipe_id ? [e.recipe_id] : []))
      if (replaceDate) {
        const current = replaceEntry?.recipe_id
        if (current) exclude.push(current)
      }
      const familiarRows: { plan_date: string; meal: string; label: string; status: string }[] = []
      const used = new Set(keep.flatMap((e) => e.label ? [e.label.toLowerCase()] : []))
      // A familiar dinner is deterministic, so explicitly exclude the suggestion being replaced.
      if (replaceEntry?.label) used.add(replaceEntry.label.toLowerCase())
      if (useFamiliar && !requiredTags.length) {
        for (const date of openDays) {
          const usual = familiarDinners(history, date).find((m) => m.weekdayCount >= 2 && !used.has(m.label.toLowerCase()) && m.last < addDays(now, -6))
          if (usual && (replaceDate || familiarRows.length < Math.ceil(openDays.length / 2))) {
            familiarRows.push({ plan_date: date, meal: 'dinner', label: usual.label, status: 'suggested' })
            used.add(usual.label.toLowerCase())
          }
        }
      }
      const recipeDays = openDays.filter((d) => !familiarRows.some((r) => r.plan_date === d))
      const picks = suggestMeals({
        recipes,
        stats,
        tags,
        alreadyPlanned: exclude,
        today: now,
        count: recipeDays.length,
        requiredTags,
        adventure,
      })
      const rows = [...familiarRows, ...picks.map((recipe_id, i) => ({ plan_date: recipeDays[i], meal: 'dinner', recipe_id, status: 'suggested' }))]
      if (replaceEntry && !rows.length) {
        setError('No different dinner matches these filters right now. Try changing the filters or choose a dish with Edit.')
        return
      }
      const replacedDays = rows.map((row) => row.plan_date)
      const toReplace = visibleEntries.filter((e) => e.status === 'suggested' && replacedDays.includes(e.plan_date) && (!replaceEntry || e.id === replaceEntry.id)).map((e) => e.id)
      // Save replacements before deleting previous suggestions, so a failed save keeps the plan.
      if (rows.length) {
        const { error } = await supabase.from('meal_plan').insert(rows)
        if (error) throw error
        if (toReplace.length) {
          const { error } = await supabase.from('meal_plan').delete().in('id', toReplace)
          if (error) throw error
        }
      }
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save suggestions.') }
    finally { setBusy(false) }
  }

  async function setStatus(e: PlanEntry, status: PlanEntry['status']) {
    const { error } = await supabase.from('meal_plan').update({ status }).eq('id', e.id)
    if (error) { setError(error.message); return }
    load()
  }

  async function remove(e: PlanEntry) {
    const { error } = await supabase.from('meal_plan').delete().eq('id', e.id)
    if (error) { setError(error.message); return }
    load()
  }

  async function pick(date: string, recipe?: Recipe, label?: string) {
    const existing = editingEntry
    const row = { plan_date: date, meal: 'dinner', recipe_id: recipe?.id ?? null, label: label?.trim() || null, status: 'planned' }
    const { error } = existing
      ? await supabase.from('meal_plan').update(row).eq('id', existing.id)
      : await supabase.from('meal_plan').insert(row)
    if (error) { setError(error.message); return }
    setPicking(null)
    setEditingEntry(null)
    await load()
  }

  async function moveDinner(date: string) {
    if (!moving?.length) return
    const { error } = await supabase.from('meal_plan').update({ plan_date: date }).in('id', moving.map((entry) => entry.id))
    if (error) throw error
    setMoving(null)
    if (weekStart(date) === start) await load()
    else setStart(weekStart(date))
  }

  const suggestedCount = entries.filter((e) => days.includes(e.plan_date) && e.status === 'suggested').length

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="page-title">Meal plan</h1>
        <div className="flex items-center gap-1">
          <button className="btn !p-2" onClick={() => setStart(addDays(start, -7))} disabled={busy} aria-label="Previous week">
            <ChevronLeft size={18} />
          </button>
          <button className="btn" disabled={busy} onClick={() => setStart(weekStart(today()))}>
            This week
          </button>
          <button className="btn !p-2" onClick={() => setStart(addDays(start, 7))} disabled={busy} aria-label="Next week">
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
            <button className="btn-primary" onClick={() => suggest()} disabled={busy || loading || loadedStart !== start}>
              <Sparkles size={16} /> {busy ? 'Saving suggestions…' : suggestedCount ? 'Re-roll suggestions' : 'Suggest dinners'}
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

      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => setEventEditor(null)}>Add calendar event</button>
        <button className="btn" onClick={() => setManageEvents(true)}>Manage events</button>
      </div>
      {eventsError && <p role="alert" className="card text-red-700">{eventsError} <button className="underline" onClick={() => void loadEvents().catch(() => {})}>Retry</button></p>}
      {error && <p role="alert" className="card text-red-700">{error}</p>}
      <p className="text-sm text-muted">Private to owners. Past plans are not confirmed cooking logs.</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useFamiliar} onChange={(e) => setUseFamiliar(e.target.checked)} /> Include usual dinners from our history (when no diet filter is selected)</label>
      {loading && <p role="status" className="text-sm text-muted">Loading dinners…</p>}
      <ul id="plan-days" className="space-y-2" aria-busy={loading}>
        {days.map((d, index) => {
          const dayEntries = loadedStart === start ? entries.filter((e) => e.plan_date === d) : []
          const made = dinnersOn(d)
          const isPast = d < now
          return (
            <li
              key={d}
              data-date={d}
              className={`card !p-3 ${index === 7 ? '!mt-6' : ''} ${d === now ? 'ring-2 ring-accent/40' : ''} ${
                dayEntries.some((e) => e.status === 'suggested') ? 'border border-dashed border-accent/50 !bg-white/60' : ''
              }`}
            >
              {index === 7 && <h2 className="mb-3 border-b border-line pb-2 font-serif text-lg">Next week · {formatDate(addDays(start, 7))}–{formatDate(queryEnd)}</h2>}
              <div className="flex items-start gap-3">
              <div className="w-14 shrink-0 text-center">
                <p className="text-xs uppercase text-muted">{formatDate(d, { weekday: 'short' })}</p>
                <p className="font-serif text-xl font-semibold">{Number(d.slice(8))}</p>
              </div>

              <div className="min-w-0 flex-1">
              <EventList events={eventsOn(events, d)} onEdit={setEventEditor} />
              <div className="space-y-3">
                {dayEntries.map((entry) => {
                  const recipe = recipeById(entry.recipe_id ?? undefined)
                  return <div key={entry.id} className="flex flex-wrap items-center gap-2">
                    {recipe ? <DayRecipe recipe={recipe} suggested={entry.status === 'suggested'} note={entry.status === 'suggested' ? 'Suggestion' : entry.status === 'cooked' ? 'Made it' : undefined} />
                      : <button className="min-w-0 flex-1 text-left" onClick={() => { setEditingEntry(entry); setPicking(d) }}>
                        <p className={`whitespace-pre-wrap font-medium ${entry.status === 'suggested' ? 'text-purple-700' : ''}`}>{entry.label ?? 'Dinner'}</p>
                        <p className="text-xs text-muted">{entry.status === 'suggested' ? 'Suggestion from past plans' : entry.status === 'cooked' ? 'Made it' : 'Planned'}</p>
                      </button>}
                    <div className="flex shrink-0 gap-1">
                      {entry.status === 'suggested' && <>
                        <button className="btn !p-2" aria-label="Keep dish" disabled={busy} onClick={() => setStatus(entry, 'planned')}><Check size={16} /></button>
                        <button className="btn !p-2" aria-label="Suggest another dish" disabled={busy} onClick={() => suggest(entry)}><RefreshCw size={16} /></button>
                      </>}
                      {entry.status === 'planned' && d <= now && <button className="btn !px-2 text-xs" onClick={() => recipe ? setLogging(entry) : setStatus(entry, 'cooked')}>Made it</button>}
                      <button className="btn-ghost !p-2" aria-label="Edit dish" disabled={busy} onClick={() => { setEditingEntry(entry); setPicking(d) }}>Edit</button>
                      {entry.status !== 'cooked' && <button className="btn-ghost !p-2" aria-label="Move dish to another day" disabled={busy} onClick={() => setMoving([entry])}>Move</button>}
                      <button className="btn-ghost !p-2" aria-label="Remove dish" disabled={busy} onClick={() => remove(entry)}><Trash2 size={16} /></button>
                    </div>
                  </div>
                })}
                {made.filter((m) => !dayEntries.some((e) => e.recipe_id === m.recipe_id)).map((m) => {
                  const recipe = recipeById(m.recipe_id)
                  return recipe ? <DayRecipe key={m.id} recipe={recipe} note="Made it" /> : null
                })}
                {!dayEntries.length && !made.length && isPast && <p className="text-sm text-muted">Nothing logged</p>}
                <button className="btn-ghost !px-0 text-sm" disabled={loading || loadedStart !== start || busy} onClick={() => { setEditingEntry(null); setPicking(d) }}>
                  <Plus size={16} /> {dayEntries.length || made.length ? 'Add dish or notes' : 'Add dinner or notes'}
                </button>
                {dayEntries.filter((entry) => entry.status !== 'cooked').length > 1 && <button className="btn-ghost text-sm" disabled={busy} onClick={() => setMoving(dayEntries.filter((entry) => entry.status !== 'cooked'))}>Move whole dinner…</button>}
              </div>
              </div>
              </div>
            </li>
          )
        })}
      </ul>

      <button className="btn w-full justify-between" disabled={busy} aria-expanded={expanded} aria-controls="plan-days" onClick={() => setExpanded((value) => !value)}>
        <span>{expanded ? 'Hide next week' : `Show next week · ${formatDate(addDays(start, 7))}–${formatDate(queryEnd)}`}</span>
        <span aria-hidden="true">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && <p className="text-sm text-muted">Suggest dinners fills unplanned days across both visible weeks.</p>}

      {manageEvents && <ManageEvents events={events} onClose={() => setManageEvents(false)} onAdd={() => { setManageEvents(false); setEventEditor(null) }} onEdit={(event) => { setManageEvents(false); setEventEditor(event) }} />}
      {eventEditor !== undefined && <EventEditor key={eventEditor?.id ?? 'new'} event={eventEditor} onSaved={loadEvents} onClose={() => setEventEditor(undefined)} />}

      <PrivateHistory entries={history} onWeek={(date) => setStart(weekStart(date))} />
      <History />

      {picking && <PickRecipe date={picking} history={history} initialLabel={editingEntry?.label ?? ''} onLabel={(label) => pick(picking, undefined, label)} onPick={(r) => pick(picking, r)} onClose={() => { setPicking(null); setEditingEntry(null) }} />}
      {moving && <MoveDinner entries={moving} titleOf={(entry) => recipeById(entry.recipe_id ?? undefined)?.title ?? entry.label ?? 'Dinner'} onMove={moveDinner} onClose={() => setMoving(null)} />}
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

function MoveDinner({ entries, titleOf, onMove, onClose }: {
  entries: PlanEntry[]
  titleOf: (entry: PlanEntry) => string
  onMove: (date: string) => Promise<void>
  onClose: () => void
}) {
  const [date, setDate] = useState(entries[0].plan_date)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  return <Modal title={entries.length > 1 ? 'Move whole dinner' : 'Move dish'} onClose={() => { if (!saving) onClose() }}>
    <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault()
      if (!date || date === entries[0].plan_date || saving) return
      setSaving(true)
      setError('')
      try { await onMove(date) }
      catch (error) { setError((error as Error).message); setSaving(false) }
    }}>
      <p className="text-sm text-muted">Moving from {formatDate(entries[0].plan_date, { weekday: 'long', month: 'short', day: 'numeric' })}:</p>
      <ul className="list-disc space-y-1 pl-5">{entries.map((entry) => <li key={entry.id}>{titleOf(entry)}</li>)}</ul>
      <label className="field"><span>New dinner date</span><input className="compact-date" type="date" required disabled={saving} value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <p className="text-sm text-muted">Choose any date, including another week. These dishes and notes will join any dinner already planned there.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full" disabled={saving || !date || date === entries[0].plan_date}>{saving ? 'Moving…' : 'Move to this date'}</button>
    </form>
  </Modal>
}

function DayRecipe({ recipe, note, suggested = false }: { recipe: Recipe; note?: string; suggested?: boolean }) {
  const { photosByRecipe } = useData()
  const cover = coverPhoto(recipe, photosByRecipe.get(recipe.id) ?? [])
  return (
    <Link to={`/r/${recipe.id}`} className="flex min-w-0 flex-1 items-center gap-3">
      <StoredImage path={cover?.path_sm} alt="" className="h-14 w-14 shrink-0 rounded-xl" />
      <div className="min-w-0">
        <p className={`line-clamp-2 font-medium leading-snug ${suggested ? 'text-purple-700' : ''}`}>{recipe.title}</p>
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

function PickRecipe({ date, history, initialLabel, onLabel, onPick, onClose }: { date: string; history: PlanEntry[]; initialLabel: string; onLabel: (label: string) => void; onPick: (r: Recipe) => void; onClose: () => void }) {
  const { recipes, photosByRecipe } = useData()
  const [q, setQ] = useState('')
  const [label, setLabel] = useState(initialLabel)
  const list = recipes.filter((r) => r.title.toLowerCase().includes(q.toLowerCase())).slice(0, 50)
  return (
    <Modal title={`Dinner & notes for ${formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}`} onClose={onClose}>
      <form className="space-y-3 mb-5" onSubmit={(e) => { e.preventDefault(); if (label.trim()) onLabel(label) }}>
        <label className="field"><span>Dinner or day notes</span><textarea rows={3} className="block w-full resize-y !leading-6" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Chicken thighs and broccoli; late practice, so keep dinner quick" maxLength={1000} /></label>
        <p className="text-xs text-muted">Add a meal without a recipe, notes about the day, or both. You can also add recipes below.</p>
        <button className="btn-primary" disabled={!label.trim()}>Save dinner or notes</button>
      </form>
      <div className="mb-5 space-y-2">
        <h3 className="font-medium">Our usual dinners</h3>
        {familiarDinners(history, date).slice(0, 8).map((m) => <button key={m.label} className="btn w-full justify-between text-left" onClick={() => onLabel(m.label)}><span>{m.label}</span><span className="text-xs text-muted">{m.weekdayCount ? `${m.weekdayCount} on this weekday` : `${m.count} past plans`}</span></button>)}
      </div>
      <input aria-label="Search recipes" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recipes" />
      <ul className="mt-3 divide-y divide-line">
        {list.map((r) => (
          <li key={r.id}>
            <button className="flex w-full items-center gap-3 py-2.5 text-left hover:text-accent" onClick={() => onPick(r)}>
              <StoredImage path={coverPhoto(r, photosByRecipe.get(r.id) ?? [])?.path_sm} alt="" className="h-14 w-14 shrink-0 rounded-xl" />
              <span>{r.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

function PrivateHistory({ entries, onWeek }: { entries: PlanEntry[]; onWeek: (date: string) => void }) {
  const [visible, setVisible] = useState(14)
  const list = entries.filter((e) => e.label)
  if (!list.length) return null
  return <section className="space-y-3">
    <h2 className="section-title">Our past plans</h2>
    <p className="text-sm text-muted">Original meal notes, including schedule context. Visible only to owners.</p>
    <ul className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
      {list.slice(0, visible).map((e) => <li key={e.id} className="px-4 py-3"><button className="text-left" onClick={() => onWeek(e.plan_date)}><span className="text-xs text-muted">{formatDate(e.plan_date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span><p className="whitespace-pre-wrap text-sm">{e.label}</p></button></li>)}
    </ul>
    {visible < list.length && <button className="btn" onClick={() => setVisible(visible + 28)}>Show more history</button>}
  </section>
}
