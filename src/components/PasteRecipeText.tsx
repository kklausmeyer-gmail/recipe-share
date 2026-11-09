import { useState } from 'react'
import { parseRecipeText } from '../lib/recipe-text'
import { emptyDraft, type Draft } from './RecipeForm'

export default function PasteRecipeText({ sourceUrl = '', onDraft }: { sourceUrl?: string; onDraft: (draft: Draft) => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  return <form className="card space-y-3" onSubmit={(event) => {
    event.preventDefault()
    if (sourceUrl) {
      try {
        if (!/^https?:$/.test(new URL(sourceUrl).protocol)) throw new Error('scheme')
      } catch {
        setError('Use a complete recipe link starting with https://, or leave the optional link blank.')
        return
      }
    }
    const parsed = parseRecipeText(text)
    if (!parsed.ingredients.some(l => !l.startsWith('# ')) || !parsed.steps.some(l => !l.startsWith('# '))) {
      setError('Add an Ingredients heading above the ingredient list and an Instructions or Directions heading above the steps, then try again. Your text is kept below.')
      return
    }
    setError('')
    onDraft({ ...emptyDraft(), ...parsed, source_url: sourceUrl || null, source_type: sourceUrl ? 'link' : 'manual' })
  }}>
    <h2 className="font-serif text-xl font-semibold">Paste recipe text</h2>
    <p className="text-sm text-muted">Copy the recipe title, ingredients, and directions from the website, then paste them below. Include the Ingredients and Instructions headings so we can separate the lists.</p>
    <label className="field">
      <span>Recipe text</span>
      <textarea rows={12} required maxLength={60000} value={text} onChange={e => setText(e.target.value)} placeholder={'Lemon chicken\nServes: 4\n\nIngredients\n2 chicken breasts\n1 lemon\n\nInstructions\n1. Slice the lemon.\n2. Cook the chicken with the lemon.'} />
    </label>
    <p className="text-xs text-muted">Your pasted text stays here while you review the draft. Check quantities, sections, and steps before saving; extra notes and nutrition aren’t copied into the draft.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button className="btn-primary" disabled={!text.trim()}>Prepare editable recipe</button>
  </form>
}
