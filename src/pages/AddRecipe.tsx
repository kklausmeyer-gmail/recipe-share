import { Camera, Link2, PenLine } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PhotoPicker from '../components/PhotoPicker'
import RecipeForm, { emptyDraft, type Draft } from '../components/RecipeForm'
import { fetchRemoteImage, uploadPhoto } from '../lib/photos'
import { saveRecipe } from '../lib/recipes'
import { useData } from '../lib/store'
import { supabase } from '../lib/supabase'

type Mode = 'link' | 'photo' | 'manual'

export default function AddRecipe() {
  const [mode, setMode] = useState<Mode>('link')
  const tabs: [Mode, string, typeof Link2][] = [
    ['link', 'From a link', Link2],
    ['photo', 'From photos', Camera],
    ['manual', 'Type it in', PenLine],
  ]
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <h1 className="page-title">Add a recipe</h1>
      <div className="grid grid-cols-3 gap-2">
        {tabs.map(([m, label, Icon]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-sm transition ${
              mode === m ? 'border-accent bg-accent-soft text-accent-dark' : 'border-line bg-white text-muted'
            }`}
          >
            <Icon size={22} />
            {label}
          </button>
        ))}
      </div>
      {mode === 'link' && <FromLink />}
      {mode === 'photo' && <FromPhotos />}
      {mode === 'manual' && <Manual />}
    </div>
  )
}

function FromLink() {
  const { recipes, tags, refresh } = useData()
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const existing = recipes.find((r) => r.source_url && url && r.source_url.replace(/\/$/, '') === url.trim().replace(/\/$/, ''))

  async function fetchIt(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.functions.invoke('import-url', { body: { url: url.trim(), mode: 'recipe' } })
    setBusy(false)
    if (error || !data || data.error) {
      let msg = data?.error ?? error?.message ?? 'Something went wrong'
      try {
        const body = await (error as { context?: Response })?.context?.json()
        if (body?.error) msg = body.error
      } catch {
        // keep the generic message
      }
      setError(`${msg}. You can still type it in below.`)
      setDraft({ ...emptyDraft(), source_type: 'link', source_url: url.trim() })
      return
    }
    const known = new Set(tags.map((t) => t.name))
    setImageUrl(data.image_urls?.[0] ?? null)
    setDraft({
      ...emptyDraft(),
      title: data.title,
      description: data.description,
      servings: data.servings,
      prep_minutes: data.prep_minutes,
      cook_minutes: data.cook_minutes,
      total_minutes: data.total_minutes,
      ingredients: data.ingredients,
      steps: data.steps,
      tags: (data.tags as string[]).filter((t) => known.has(t)),
      source_type: 'link',
      source_url: data.source_url,
    })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={fetchIt} className="card space-y-3">
        <label className="field">
          <span>Paste a link to a recipe</span>
          <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </label>
        {existing && (
          <p className="text-sm text-amber-800">
            You already have this one: <Link to={`/r/${existing.id}`} className="underline">{existing.title}</Link>
          </p>
        )}
        <button className="btn-primary" disabled={busy}>
          {busy ? 'Reading the page…' : 'Get recipe'}
        </button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </form>

      {draft && (
        <>
          {imageUrl && <img src={imageUrl} alt="" className="aspect-[4/3] w-full rounded-2xl object-cover sm:w-80" />}
          <RecipeForm
            key={draft.source_url + draft.title}
            initial={draft}
            submitLabel="Save recipe"
            onSubmit={async (d) => {
              const saved = await saveRecipe(d, tags)
              if (imageUrl) {
                try {
                  const photo = await uploadPhoto(saved.id, await fetchRemoteImage(imageUrl), 'source')
                  await supabase.from('recipes').update({ hero_photo_id: photo.id }).eq('id', saved.id)
                } catch {
                  // The recipe is saved; the photo can be added later from Edit.
                }
              }
              await refresh()
              navigate(`/r/${saved.id}`)
            }}
          />
        </>
      )}
    </div>
  )
}

function FromPhotos() {
  const { tags, refresh } = useData()
  const navigate = useNavigate()
  const [pages, setPages] = useState<File[]>([])
  const [dish, setDish] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [book, setBook] = useState('')
  const [page, setPage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(typeNow: boolean) {
    setBusy(true)
    setError(null)
    try {
      const saved = await saveRecipe(
        {
          ...emptyDraft(),
          title: title.trim() || `Untitled recipe (${new Date().toLocaleDateString()})`,
          source_type: 'photo',
          source_book: book.trim() || null,
          source_page: page.trim() || null,
          status: 'needs_transcription',
        },
        tags,
      )
      for (const [i, f] of pages.entries()) await uploadPhoto(saved.id, f, 'page', { sort: i })
      for (const [i, f] of dish.entries()) {
        const p = await uploadPhoto(saved.id, f, 'source', { sort: i })
        if (i === 0) await supabase.from('recipes').update({ hero_photo_id: p.id }).eq('id', saved.id)
      }
      await refresh()
      navigate(typeNow ? `/r/${saved.id}/edit` : `/r/${saved.id}`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="card space-y-5">
      <div className="field">
        <span>Photos of the recipe pages, in order</span>
        <PhotoPicker files={pages} onChange={setPages} label="Pages" />
      </div>
      <div className="field">
        <span>Photo of the finished dish (optional, e.g. the cookbook's picture)</span>
        <PhotoPicker files={dish} onChange={setDish} label="Dish" />
      </div>
      <label className="field">
        <span>Title (optional)</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <label className="field">
          <span>Cookbook</span>
          <input value={book} onChange={(e) => setBook(e.target.value)} />
        </label>
        <label className="field">
          <span>Page</span>
          <input value={page} onChange={(e) => setPage(e.target.value)} />
        </label>
      </div>
      <p className="text-sm text-muted">
        The recipe is saved with its photos right away and marked "Needs typing up". The next time the Claude Code
        transcription queue runs, it's typed in for you (see docs/IMPORT.md). Or you can type it now.
      </p>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy || !pages.length} onClick={() => save(false)}>
          {busy ? 'Uploading…' : 'Save to the queue'}
        </button>
        <button className="btn" disabled={busy || !pages.length} onClick={() => save(true)}>
          Save and type it now
        </button>
      </div>
    </div>
  )
}

function Manual() {
  const { tags, refresh } = useData()
  const navigate = useNavigate()
  return (
    <RecipeForm
      initial={emptyDraft()}
      submitLabel="Save recipe"
      onSubmit={async (d) => {
        const saved = await saveRecipe(d, tags)
        await refresh()
        navigate(`/r/${saved.id}/edit`)
      }}
    >
      <p className="text-sm text-muted">You can add photos after saving.</p>
    </RecipeForm>
  )
}
