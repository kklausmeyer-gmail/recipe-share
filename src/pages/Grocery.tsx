import { Check, Copy, Share } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addDays, formatDate, today, weekStart } from '../lib/dates'
import { buildGroceryList, groceryLabel } from '../lib/ingredients'
import { useData } from '../lib/store'
import { supabase } from '../lib/supabase'
import type { PlanEntry } from '../lib/types'

const STAPLES = ['salt', 'kosher salt', 'pepper', 'black pepper', 'water', 'salt and pepper', 'ice']
const HAVE_KEY = 'grocery-have-v1'

function loadHave(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(HAVE_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

/** Builds a combined shopping list from the planned dinners, ready to paste into AnyList. */
export default function Grocery() {
  const [params] = useSearchParams()
  const from = params.get('from') ?? today()
  const to = params.get('to') ?? addDays(weekStart(today()), 6)
  const { recipeById } = useData()
  const [entries, setEntries] = useState<PlanEntry[]>([])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [have, setHave] = useState<Set<string>>(loadHave)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase
      .from('meal_plan')
      .select('*')
      .gte('plan_date', from)
      .lte('plan_date', to)
      .in('status', ['planned', 'suggested'])
      .order('plan_date')
      .then(({ data }) => setEntries((data as PlanEntry[]) ?? []))
  }, [from, to])

  useEffect(() => {
    try {
      localStorage.setItem(HAVE_KEY, JSON.stringify([...have]))
    } catch {
      // ignore
    }
  }, [have])

  const planned = entries.flatMap((e) => {
    const r = recipeById(e.recipe_id ?? undefined)
    return r ? [{ entry: e, recipe: r }] : []
  })
  const included = planned.filter((p) => !excluded.has(p.entry.id)).map((p) => p.recipe)
  const items = buildGroceryList(included)

  const isHave = (key: string, name: string) => have.has(key) || (!have.has(`!${key}`) && STAPLES.includes(name.toLowerCase()))
  const toggleHave = (key: string, name: string) => {
    const next = new Set(have)
    if (isHave(key, name)) {
      next.delete(key)
      if (STAPLES.includes(name.toLowerCase())) next.add(`!${key}`)
    } else {
      next.add(key)
      next.delete(`!${key}`)
    }
    setHave(next)
  }

  const toBuy = items.filter((i) => !isHave(i.key, i.name))
  const text = toBuy.map(groceryLabel).join('\n')

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <div>
        <h1 className="page-title">Grocery list</h1>
        <p className="text-muted">
          {formatDate(from)} – {formatDate(to)}
        </p>
      </div>

      {planned.length === 0 ? (
        <p className="text-muted">
          Nothing planned for these days yet. <Link to="/plan" className="text-accent underline">Plan some dinners</Link> first.
        </p>
      ) : (
        <>
          <section className="card space-y-2">
            <h2 className="font-medium">Recipes</h2>
            {planned.map(({ entry, recipe }) => (
              <label key={entry.id} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={!excluded.has(entry.id)}
                  onChange={() => {
                    const next = new Set(excluded)
                    next.has(entry.id) ? next.delete(entry.id) : next.add(entry.id)
                    setExcluded(next)
                  }}
                />
                <span className="w-20 shrink-0 text-muted">{formatDate(entry.plan_date, { weekday: 'short', day: 'numeric' })}</span>
                <span className="line-clamp-1">{recipe.title}</span>
              </label>
            ))}
          </section>

          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={copy} disabled={!toBuy.length}>
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied!' : `Copy ${toBuy.length} items`}
            </button>
            {'share' in navigator && (
              <button className="btn" onClick={() => navigator.share({ text }).catch(() => {})} disabled={!toBuy.length}>
                <Share size={16} /> Share
              </button>
            )}
          </div>
          <p className="-mt-3 text-sm text-muted">
            To send it to AnyList, copy the list, open your AnyList list, and paste it into the add-item box. AnyList adds each line as
            its own item and sorts it into aisles.
          </p>

          <section>
            <p className="mb-2 text-sm text-muted">Tap anything you already have.</p>
            <ul className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
              {items.map((i) => {
                const got = isHave(i.key, i.name)
                return (
                  <li key={i.key}>
                    <button onClick={() => toggleHave(i.key, i.name)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                          got ? 'border-sage bg-sage text-white' : 'border-line'
                        }`}
                      >
                        {got && <Check size={14} />}
                      </span>
                      <span className={got ? 'text-muted line-through' : ''}>
                        {groceryLabel(i)}
                        {i.recipes.length > 1 && <span className="block text-xs text-muted">{i.recipes.join(', ')}</span>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
