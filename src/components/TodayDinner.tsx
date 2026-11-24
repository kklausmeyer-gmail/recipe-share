import { ChevronRight, UtensilsCrossed } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { today } from '../lib/dates'
import { coverPhoto } from '../lib/photos'
import { useAuth, useData } from '../lib/store'
import { supabase } from '../lib/supabase'
import type { PlanEntry } from '../lib/types'
import StoredImage from './StoredImage'

/** Shortcut to tonight's planned recipes, shown above the search bar. Meal plans are owner-only. */
export default function TodayDinner() {
  const { isOwner } = useAuth()
  const { recipeById, photosByRecipe } = useData()
  const [entries, setEntries] = useState<PlanEntry[]>([])

  useEffect(() => {
    if (!isOwner) return
    let live = true
    supabase
      .from('meal_plan')
      .select('*')
      .eq('plan_date', today())
      .eq('meal', 'dinner')
      .in('status', ['planned', 'suggested', 'cooked'])
      .not('recipe_id', 'is', null)
      .then(({ data }) => live && setEntries((data as PlanEntry[]) ?? []))
    return () => {
      live = false
    }
  }, [isOwner])

  const recipes = entries.flatMap((e) => {
    const r = recipeById(e.recipe_id ?? undefined)
    return r ? [r] : []
  })
  if (!recipes.length) return null

  return (
    <div className="space-y-2">
      {recipes.map((r) => {
        const cover = coverPhoto(r, photosByRecipe.get(r.id) ?? [])
        return (
          <Link key={r.id} to={`/r/${r.id}`} className="card flex items-center gap-3 !p-2.5 hover:ring-accent">
            {cover ? (
              <StoredImage path={cover.path_sm} alt="" className="h-14 w-14 shrink-0 rounded-xl" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-dark">
                <UtensilsCrossed size={20} />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold uppercase tracking-wide text-accent">Tonight’s dinner</span>
              <span className="line-clamp-1 font-serif text-lg font-semibold">{r.title}</span>
            </span>
            <ChevronRight size={20} className="shrink-0 text-muted" />
          </Link>
        )
      })}
    </div>
  )
}
