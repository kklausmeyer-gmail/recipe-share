import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import RecipeCard from '../components/RecipeCard'
import TagChip from '../components/TagChip'
import { useData } from '../lib/store'
import type { Recipe } from '../lib/types'

const SORTS = {
  rating: 'Top rated',
  mine: 'My favorites',
  newest: 'Newest',
  recent: 'Recently made',
  stale: "Haven't made in a while",
  az: 'A–Z',
} as const
type SortKey = keyof typeof SORTS

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function Browse() {
  const { recipes, tags, stats } = useData()
  const [params, setParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)

  const q = params.get('q') ?? ''
  const mode = params.get('mode') === 'ing' ? 'ing' : 'all'
  const activeTags = params.getAll('tag')
  const sort = (params.get('sort') as SortKey) || 'rating'
  const only = params.get('only') ?? ''

  const update = (fn: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params)
    fn(next)
    setParams(next, { replace: true })
  }

  const haystacks = useMemo(() => {
    const map = new Map<string, { all: string; ing: string }>()
    for (const r of recipes) {
      const ing = norm(r.ingredients.join('\n'))
      map.set(r.id, {
        ing,
        all: norm([r.title, r.description, r.source_book, r.tags.join(' '), ing, r.steps.join(' ')].join('\n')),
      })
    }
    return map
  }, [recipes])

  const results = useMemo(() => {
    const terms =
      mode === 'ing'
        ? q.split(/[,;]+/).map((t) => norm(t.trim())).filter(Boolean)
        : norm(q).split(/\s+/).filter(Boolean)
    const list = recipes.filter((r) => {
      if (activeTags.length && !activeTags.every((t) => r.tags.includes(t))) return false
      const s = stats.get(r.id)
      if (only === 'never' && s?.timesCooked) return false
      if (only === 'queue' && r.status !== 'needs_transcription') return false
      if (!terms.length) return true
      const h = haystacks.get(r.id)!
      return terms.every((t) => (mode === 'ing' ? h.ing : h.all).includes(t))
    })

    const score = (r: Recipe) => {
      const s = stats.get(r.id)
      switch (sort) {
        case 'rating':
          return -(s?.avgRating ?? 0)
        case 'mine':
          return -(s?.myRating ?? 0)
        case 'recent':
          return s?.lastCooked ? -Date.parse(s.lastCooked) : Infinity
        case 'stale':
          return s?.lastCooked ? Date.parse(s.lastCooked) : Infinity
        case 'newest':
          return -Date.parse(r.created_at)
        default:
          return 0
      }
    }
    return list.sort((a, b) => score(a) - score(b) || a.title.localeCompare(b.title))
  }, [recipes, haystacks, stats, params])

  const queueCount = recipes.filter((r) => r.status === 'needs_transcription').length
  const usedTags = useMemo(() => {
    const used = new Set(recipes.flatMap((r) => r.tags))
    return tags.filter((t) => used.has(t.name))
  }, [recipes, tags])
  const groups = [...new Set(usedTags.map((t) => t.grp))]
  const quickTags = usedTags.filter((t) => t.grp === 'meal' || t.grp === 'diet')

  const toggleTag = (name: string) =>
    update((p) => {
      const current = p.getAll('tag')
      p.delete('tag')
      const next = current.includes(name) ? current.filter((t) => t !== name) : [...current, name]
      next.forEach((t) => p.append('tag', t))
    })

  if (!recipes.length) {
    return (
      <div className="py-20 text-center">
        <h1 className="page-title">Your recipe box is empty</h1>
        <p className="mt-2 text-muted">Add your first recipe, or run the photo import (see docs/IMPORT.md).</p>
        <Link to="/add" className="btn-primary mt-6">
          Add a recipe
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-end justify-between gap-4">
        <h1 className="page-title">Recipes</h1>
        <span className="text-sm text-muted">
          {results.length} of {recipes.length}
        </span>
      </div>

      <div className="sticky top-0 z-20 -mx-4 space-y-3 bg-cream/95 px-4 pb-3 pt-2 backdrop-blur md:top-[57px] md:-mx-6 md:px-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={q}
              onChange={(e) => update((p) => (e.target.value ? p.set('q', e.target.value) : p.delete('q')))}
              placeholder={mode === 'ing' ? 'chicken, lemon, feta…' : 'Search recipes'}
              className="!pl-10 !pr-9"
            />
            {q && (
              <button
                onClick={() => update((p) => p.delete('q'))}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            className={`btn !px-3 ${showFilters || activeTags.length || only ? '!border-accent text-accent' : ''}`}
            onClick={() => setShowFilters((s) => !s)}
            aria-label="Filters"
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          <div className="flex shrink-0 rounded-full bg-line/60 p-0.5 text-sm">
            <button
              className={`rounded-full px-3 py-1 ${mode === 'all' ? 'bg-white shadow-sm' : 'text-muted'}`}
              onClick={() => update((p) => p.delete('mode'))}
            >
              Anything
            </button>
            <button
              className={`rounded-full px-3 py-1 ${mode === 'ing' ? 'bg-white shadow-sm' : 'text-muted'}`}
              onClick={() => update((p) => p.set('mode', 'ing'))}
            >
              Ingredients
            </button>
          </div>
          {quickTags.map((t) => (
            <TagChip key={t.name} name={t.name} active={activeTags.includes(t.name)} onClick={() => toggleTag(t.name)} />
          ))}
        </div>

        {showFilters && (
          <div className="card space-y-4">
            <label className="field">
              <span>Sort by</span>
              <select value={sort} onChange={(e) => update((p) => p.set('sort', e.target.value))}>
                {Object.entries(SORTS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <TagChip
                name="Never made"
                active={only === 'never'}
                onClick={() => update((p) => (only === 'never' ? p.delete('only') : p.set('only', 'never')))}
              />
              {queueCount > 0 && (
                <TagChip
                  name={`Needs typing up (${queueCount})`}
                  active={only === 'queue'}
                  onClick={() => update((p) => (only === 'queue' ? p.delete('only') : p.set('only', 'queue')))}
                />
              )}
            </div>
            {groups.map((g) => (
              <div key={g}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{g}</p>
                <div className="flex flex-wrap gap-1.5">
                  {usedTags
                    .filter((t) => t.grp === g)
                    .map((t) => (
                      <TagChip key={t.name} name={t.name} small active={activeTags.includes(t.name)} onClick={() => toggleTag(t.name)} />
                    ))}
                </div>
              </div>
            ))}
            {(activeTags.length > 0 || only) && (
              <button
                className="btn-ghost"
                onClick={() =>
                  update((p) => {
                    p.delete('tag')
                    p.delete('only')
                  })
                }
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {results.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {results.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-muted">No recipes match. Try fewer words or tags.</p>
      )}
    </div>
  )
}
