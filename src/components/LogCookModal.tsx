import { useState } from 'react'
import { today } from '../lib/dates'
import { uploadPhoto } from '../lib/photos'
import { useAuth, useData } from '../lib/store'
import { supabase } from '../lib/supabase'
import type { Recipe } from '../lib/types'
import Modal from './Modal'
import PhotoPicker from './PhotoPicker'
import Stars from './Stars'

interface Props {
  recipe: Recipe
  onClose: () => void
  defaultDate?: string
  onLogged?: () => void
}

export default function LogCookModal({ recipe, onClose, defaultDate, onLogged }: Props) {
  const { session } = useAuth()
  const { stats, refresh } = useData()
  const [date, setDate] = useState(defaultDate ?? today())
  const [meal, setMeal] = useState('dinner')
  const [stars, setStars] = useState<number | null>(stats.get(recipe.id)?.myRating ?? null)
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [makeCover, setMakeCover] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const { data: entry, error: e1 } = await supabase
        .from('cook_log')
        .insert({ recipe_id: recipe.id, cooked_on: date, meal, notes: notes.trim() || null })
        .select()
        .single()
      if (e1) throw e1
      if (stars) {
        const { error: e2 } = await supabase
          .from('ratings')
          .upsert({ recipe_id: recipe.id, user_id: session!.user.id, stars, updated_at: new Date().toISOString() })
        if (e2) throw e2
      }
      let firstPhotoId: string | null = null
      for (const f of files) {
        const p = await uploadPhoto(recipe.id, f, 'ours', { cookLogId: entry.id })
        firstPhotoId ??= p.id
      }
      if (makeCover && firstPhotoId) {
        await supabase.from('recipes').update({ hero_photo_id: firstPhotoId }).eq('id', recipe.id)
      }
      await refresh()
      onLogged?.()
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <Modal title="We made this!" onClose={onClose}>
      <div className="space-y-4">
        <p className="font-serif text-lg leading-tight">{recipe.title}</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Meal</span>
            <select value={meal} onChange={(e) => setMeal(e.target.value)}>
              {['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'party'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="field">
          <span>Your rating</span>
          <Stars value={stars} onChange={setStars} size={30} />
        </div>
        <label className="field">
          <span>What did you change? How did it turn out?</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Used half the salt, added spinach, 10 more minutes in the oven…"
          />
        </label>
        <div className="field">
          <span>Photos of the dish</span>
          <PhotoPicker files={files} onChange={setFiles} />
          {files.length > 0 && (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={makeCover} onChange={(e) => setMakeCover(e.target.checked)} />
              Use as the recipe's cover photo
            </label>
          )}
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  )
}
