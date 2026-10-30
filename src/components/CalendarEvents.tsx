import { CalendarDays, Pencil } from 'lucide-react'
import { useState } from 'react'
import { eventTimeLabel, validateCalendarEvent } from '../lib/calendar'
import { formatDate, today } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type { CalendarEvent, CalendarEventInput } from '../lib/types'
import Modal from './Modal'

export function EventList({ events, onEdit }: { events: CalendarEvent[]; onEdit: (event: CalendarEvent) => void }) {
  if (!events.length) return null
  return <ul className="mb-3 space-y-2 border-b border-line pb-3">
    {events.map((event) => <li key={event.id}>
      <button className="flex w-full items-start gap-2 text-left text-indigo-700 hover:text-indigo-900" onClick={() => onEdit(event)} aria-label={`Edit event: ${event.title}`}>
        <CalendarDays size={15} className="mt-0.5 shrink-0" />
        <span className="min-w-0 flex-1"><span className="block font-medium">{event.title}</span><span className="block text-xs">{eventTimeLabel(event)}</span>
          {event.notes && <span className="mt-1 block whitespace-pre-wrap text-xs">{event.notes}</span>}
        </span>
        <Pencil size={13} className="mt-1 shrink-0" />
      </button>
    </li>)}
  </ul>
}

export function ManageEvents({ events, onEdit, onAdd, onClose }: { events: CalendarEvent[]; onEdit: (event: CalendarEvent) => void; onAdd: () => void; onClose: () => void }) {
  return <Modal title="Calendar events" onClose={onClose}>
    <button className="btn-primary mb-4" onClick={onAdd}>Add event</button>
    {!events.length && <p className="text-sm text-muted">Add practices, classes, and other events to plan dinners around.</p>}
    <ul className="divide-y divide-line">
      {events.map((event) => <li key={event.id}><button className="w-full py-3 text-left" onClick={() => onEdit(event)}>
        <p className="font-medium text-indigo-700">{event.title}</p>
        <p className="text-sm text-muted">{event.recurrence === 'weekly' ? `Weekly on ${formatDate(event.start_date, { weekday: 'long' })}` : 'Once'} · {eventTimeLabel(event)}</p>
        <p className="text-xs text-muted">From {formatDate(event.start_date)}{event.end_date ? ` through ${formatDate(event.end_date)}` : ''}</p>
      </button></li>)}
    </ul>
  </Modal>
}

export function EventEditor({ event, onSaved, onClose }: { event: CalendarEvent | null; onSaved: () => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<CalendarEventInput>(() => event ? {
    title: event.title, start_date: event.start_date, recurrence: event.recurrence, end_date: event.end_date,
    start_time: event.start_time?.slice(0, 5) ?? null, end_time: event.end_time?.slice(0, 5) ?? null, notes: event.notes,
  } : { title: '', start_date: today(), recurrence: 'weekly', end_date: null, start_time: null, end_time: null, notes: null })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const update = <K extends keyof CalendarEventInput>(key: K, value: CalendarEventInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setError('')
  }

  async function save() {
    const row = { ...form, title: form.title.trim(), notes: form.notes?.trim() || null }
    const validation = validateCalendarEvent(row)
    if (validation) { setError(validation); return }
    setBusy(true)
    setError('')
    try {
      const result = event
        ? await supabase.from('calendar_events').update(row).eq('id', event.id).select('id').single()
        : await supabase.from('calendar_events').insert(row).select('id').single()
      if (result.error) throw result.error
      // The save succeeded even if the follow-up read fails; the parent shows
      // that read error with a Retry action. Do not invite a duplicate insert.
      await onSaved().catch(() => {})
      onClose()
    } catch (e) { setError(e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Could not save event. Please try again.') }
    finally { setBusy(false) }
  }

  async function remove() {
    if (!event) return
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase.from('calendar_events').delete().eq('id', event.id).select('id').single()
      if (error) throw error
      await onSaved().catch(() => {})
      onClose()
    } catch (e) { setError(e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Could not delete event. Please try again.') }
    finally { setBusy(false) }
  }

  return <Modal title={event ? 'Edit calendar event' : 'Add calendar event'} onClose={() => { if (!busy) onClose() }}>
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save() }}>
      <fieldset disabled={busy} className="space-y-4">
        {event?.recurrence === 'weekly' && <p className="text-sm text-muted">Changes apply to the whole recurring event, including earlier occurrences.</p>}
        <label className="block text-sm">Title<input className="mt-1 w-full" autoFocus required maxLength={200} value={form.title} onChange={(e) => update('title', e.target.value)} /></label>
        <label className="block text-sm">Start date<input className="mt-1 w-full" type="date" required value={form.start_date} onInput={(e) => update('start_date', e.currentTarget.value)} /></label>
        <label className="block text-sm">Recurrence<select className="mt-1 w-full" value={form.recurrence} onChange={(e) => update('recurrence', e.target.value as CalendarEventInput['recurrence'])}>
          <option value="none">Does not repeat</option><option value="weekly">Weekly</option>
        </select></label>
        <label className="block text-sm">End date <span className="text-muted">(optional, includes this day)</span><input className="mt-1 w-full" type="date" min={form.start_date} value={form.end_date ?? ''} onInput={(e) => update('end_date', e.currentTarget.value || null)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">Start time<input className="mt-1 w-full" type="time" value={form.start_time ?? ''} onInput={(e) => update('start_time', e.currentTarget.value || null)} /></label>
          <label className="block text-sm">End time<input className="mt-1 w-full" type="time" value={form.end_time ?? ''} onInput={(e) => update('end_time', e.currentTarget.value || null)} /></label>
        </div>
        <p className="text-xs text-muted">Times stay at the entered local time each week. Leave both empty for an all-day event.</p>
        <label className="block text-sm">Notes<textarea className="mt-1 w-full" rows={3} maxLength={5000} value={form.notes ?? ''} onChange={(e) => update('notes', e.target.value || null)} /></label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2"><button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save event'}</button><button type="button" className="btn" disabled={busy} onClick={onClose}>Cancel</button></div>
      {event && <div className="border-t border-line pt-3">
        {confirmDelete ? <div className="space-y-2"><p className="text-sm">Delete this event and all its occurrences?</p><button type="button" className="btn text-red-700" disabled={busy} onClick={() => void remove()}>Delete all occurrences</button><button type="button" className="btn-ghost" disabled={busy} onClick={() => setConfirmDelete(false)}>Keep event</button></div>
          : <button type="button" className="btn-ghost text-red-700" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete event</button>}
      </div>}
    </form>
  </Modal>
}
