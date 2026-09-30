import { ChevronLeft, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useConfirm } from '../components/Confirm'
import PhotoPicker from '../components/PhotoPicker'
import RecipeForm from '../components/RecipeForm'
import StoredImage from '../components/StoredImage'
import { coverPhoto, deletePhoto, uploadPhoto } from '../lib/photos'
import { saveRecipe } from '../lib/recipes'
import { useData } from '../lib/store'
import { supabase } from '../lib/supabase'
import type { Photo, PhotoKind } from '../lib/types'

const KIND_LABELS: Record<PhotoKind, string> = {
  page: 'Recipe page',
  source: "Book/site's dish photo",
  ours: 'Our photo',
}

export default function RecipeEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { recipeById, photosByRecipe, tags, refresh } = useData()
  const confirm = useConfirm()
  const recipe = recipeById(id)
  const [files, setFiles] = useState<File[]>([])
  const [newKind, setNewKind] = useState<PhotoKind>('ours')
  const [busy, setBusy] = useState(false)

  if (!recipe) return <p className="py-20 text-center text-muted">Recipe not found.</p>
  const photos = [...(photosByRecipe.get(recipe.id) ?? [])].sort((a, b) => a.kind.localeCompare(b.kind) || a.sort - b.sort)
  const cover = coverPhoto(recipe, photos)

  async function setCover(p: Photo) {
    await supabase.from('recipes').update({ hero_photo_id: p.id }).eq('id', recipe!.id)
    refresh()
  }

  async function changeKind(p: Photo, kind: PhotoKind) {
    await supabase.from('recipe_photos').update({ kind }).eq('id', p.id)
    refresh()
  }

  async function remove(p: Photo) {
    if (!(await confirm({ title: 'Delete this photo?' }))) return
    await deletePhoto(p)
    refresh()
  }

  async function uploadNew() {
    setBusy(true)
    try {
      const start = photos.filter((p) => p.kind === newKind).length
      for (const [i, f] of files.entries()) await uploadPhoto(recipe!.id, f, newKind, { sort: start + i })
      setFiles([])
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function deleteRecipe() {
    const ok = await confirm({
      title: `Delete "${recipe!.title}"?`,
      message: "This deletes the recipe with all its photos, notes and cooking history. It can't be undone.",
      confirmLabel: 'Delete recipe',
    })
    if (!ok) return
    for (const p of photos) await deletePhoto(p)
    await supabase.from('recipes').delete().eq('id', recipe!.id)
    await refresh()
    navigate('/')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <Link to={`/r/${recipe.id}`} className="btn-ghost -ml-3">
        <ChevronLeft size={18} /> Back to recipe
      </Link>
      <h1 className="page-title">Edit recipe</h1>

      <section className="card space-y-4">
        <h2 className="font-serif text-lg font-semibold">Photos</h2>
        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <div key={p.id} className="space-y-1.5">
                <div className="relative">
                  <StoredImage path={p.path_sm} alt="" className="aspect-square rounded-xl ring-1 ring-line" />
                  {cover?.id === p.id && (
                    <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white">Cover</span>
                  )}
                </div>
                <select value={p.kind} onChange={(e) => changeKind(p, e.target.value as PhotoKind)} className="!py-1 !text-xs">
                  {Object.entries(KIND_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
                <div className="flex justify-between">
                  <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setCover(p)} disabled={cover?.id === p.id}>
                    <Star size={14} /> Make cover
                  </button>
                  <button className="btn-ghost !px-2 !py-1 text-xs hover:!text-red-700" onClick={() => remove(p)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2 border-t border-line pt-4">
          <PhotoPicker files={files} onChange={setFiles} />
          {files.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <select value={newKind} onChange={(e) => setNewKind(e.target.value as PhotoKind)} className="!w-auto">
                {Object.entries(KIND_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <button className="btn-primary" onClick={uploadNew} disabled={busy}>
                {busy ? 'Uploading…' : `Upload ${files.length}`}
              </button>
            </div>
          )}
        </div>
      </section>

      <RecipeForm
        initial={recipe}
        submitLabel="Save changes"
        onSubmit={async (d) => {
          await saveRecipe(d, tags, recipe.id)
          await refresh()
          navigate(`/r/${recipe.id}`)
        }}
      />

      <div className="border-t border-line pt-6">
        <button className="btn !border-red-200 !text-red-700" onClick={deleteRecipe}>
          <Trash2 size={16} /> Delete recipe
        </button>
      </div>
    </div>
  )
}
