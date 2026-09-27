import { Link } from 'react-router-dom'
import { relativeDays } from '../lib/dates'
import { coverPhoto } from '../lib/photos'
import { useData } from '../lib/store'
import type { Recipe } from '../lib/types'
import Stars from './Stars'
import StoredImage from './StoredImage'

export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  const { photosByRecipe, stats } = useData()
  const cover = coverPhoto(recipe, photosByRecipe.get(recipe.id) ?? [])
  const s = stats.get(recipe.id)

  return (
    <Link
      to={`/r/${recipe.id}`}
      className="group block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative">
        <StoredImage path={cover?.path_sm} alt={recipe.title} className="aspect-[4/3] w-full" />
        {recipe.status === 'needs_transcription' && (
          <span className="absolute left-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Needs typing up
          </span>
        )}
      </div>
      <div className="space-y-1 p-3">
        <h3 className="line-clamp-2 font-serif text-[15px] font-semibold leading-snug group-hover:text-accent">{recipe.title}</h3>
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          {s?.avgRating ? <Stars value={s.avgRating} size={12} /> : <span>Not rated</span>}
          {s?.lastCooked ? <span>Made {relativeDays(s.lastCooked)}</span> : <span>Never made</span>}
        </div>
      </div>
    </Link>
  )
}
