import { Pencil, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'

interface Props {
  text: string | null
  /** Shown under the text, e.g. who wrote it and when. */
  meta?: ReactNode
  onSave: (text: string) => Promise<void>
  onDelete: () => void
  deleteLabel: string
  /** Placeholder shown when editing an empty note. */
  placeholder?: string
  children?: ReactNode
}

/** A note with Edit and Delete buttons that are easy to tap on a phone. */
export default function EditableNote({ text, meta, onSave, onDelete, deleteLabel, placeholder, children }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await onSave(draft.trim())
      setEditing(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        {meta}
        {editing ? (
          <div className="mt-1 space-y-2">
            <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} autoFocus />
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex gap-2">
              <button className="btn-primary !py-1.5" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                className="btn !py-1.5"
                onClick={() => {
                  setDraft(text ?? '')
                  setEditing(false)
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          text && <p className="mt-1 whitespace-pre-line">{text}</p>
        )}
        {children}
      </div>
      {!editing && (
        <div className="-mr-2 -mt-1 flex shrink-0">
          <button
            className="rounded-full p-2.5 text-muted hover:bg-line/60 hover:text-ink"
            onClick={() => {
              setDraft(text ?? '')
              setEditing(true)
            }}
            aria-label="Edit"
          >
            <Pencil size={17} />
          </button>
          <button className="rounded-full p-2.5 text-muted hover:bg-line/60 hover:text-red-700" onClick={onDelete} aria-label={deleteLabel}>
            <Trash2 size={17} />
          </button>
        </div>
      )}
    </div>
  )
}
