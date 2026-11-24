import { StickyNote } from 'lucide-react'
import { formatDate } from '../lib/dates'
import type { CookEntry, Note } from '../lib/types'

/** Read-only reminder of our notes and cooking-history notes, shown before the ingredients. */
export default function NotesSummary({
  notes,
  history,
  nameOf,
  className = '',
}: {
  notes: Note[]
  history: CookEntry[]
  nameOf: (id: string | null) => string
  className?: string
}) {
  const cooked = history.filter((c) => c.notes?.trim())
  if (!notes.length && !cooked.length) return null
  return (
    <section aria-label="Notes before you cook" className={`rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 ${className}`}>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-900">
        <StickyNote size={16} /> Before you cook
      </h2>
      <ul className="space-y-2 text-amber-950">
        {notes.map((n) => (
          <li key={n.id}>
            <p className="whitespace-pre-line">{n.body}</p>
            <p className="text-xs text-amber-800/80">
              {nameOf(n.author)} · {formatDate(n.created_at.slice(0, 10))}
            </p>
          </li>
        ))}
        {cooked.map((c) => (
          <li key={c.id}>
            <p className="whitespace-pre-line">{c.notes}</p>
            <p className="text-xs text-amber-800/80">
              Cooked {formatDate(c.cooked_on, { month: 'short', day: 'numeric', year: 'numeric' })} · {nameOf(c.cooked_by)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
