import { LogOut, Trash2, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth, useData } from '../lib/store'
import { supabase } from '../lib/supabase'
import type { Member, Role } from '../lib/types'

export default function Settings() {
  const { member, isOwner, signOut } = useAuth()
  const { members, tags, recipes, refresh } = useData()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('editor')
  const [error, setError] = useState<string | null>(null)
  const [newTag, setNewTag] = useState('')
  const [newTagGroup, setNewTagGroup] = useState('other')

  async function invite(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase
      .from('members')
      .insert({ email: email.trim().toLowerCase(), display_name: name.trim(), role })
    if (error) return setError(error.message)
    setEmail('')
    setName('')
    refresh()
  }

  async function update(m: Member, patch: Partial<Member>) {
    await supabase.from('members').update(patch).eq('email', m.email)
    refresh()
  }

  async function removeMember(m: Member) {
    if (!confirm(`Remove ${m.display_name}? They won't be able to open the recipe box anymore.`)) return
    await supabase.from('members').delete().eq('email', m.email)
    refresh()
  }

  async function addTag(e: FormEvent) {
    e.preventDefault()
    const t = newTag.trim().toLowerCase()
    if (!t) return
    await supabase.from('tags').upsert({ name: t, grp: newTagGroup })
    setNewTag('')
    refresh()
  }

  async function removeTag(name: string) {
    const used = recipes.filter((r) => r.tags.includes(name)).length
    if (!confirm(used ? `"${name}" is on ${used} recipes. Remove it from the tag list? (Recipes keep it.)` : `Delete "${name}"?`)) return
    await supabase.from('tags').delete().eq('name', name)
    refresh()
  }

  const groups = [...new Set(['meal', 'diet', 'protein', 'cuisine', 'other', ...tags.map((t) => t.grp)])]

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-12">
      <h1 className="page-title">Settings</h1>

      <section className="card flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">{member?.display_name}</p>
          <p className="text-sm text-muted">
            {member?.email} · {member?.role === 'owner' ? 'Owner' : 'Can edit recipes'}
          </p>
        </div>
        <button className="btn" onClick={signOut}>
          <LogOut size={16} /> Sign out
        </button>
      </section>

      <section>
        <h2 className="section-title">People</h2>
        <ul className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
          {members.map((m) => (
            <li key={m.email} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{m.display_name}</p>
                <p className="truncate text-sm text-muted">
                  {m.email}
                  {!m.user_id && ' · hasn’t signed in yet'}
                </p>
              </div>
              {isOwner && m.email !== member?.email ? (
                <>
                  <select value={m.role} onChange={(e) => update(m, { role: e.target.value as Role })} className="!w-auto !py-1 text-sm">
                    <option value="owner">Owner</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button className="btn-ghost !p-2 hover:!text-red-700" onClick={() => removeMember(m)} aria-label="Remove">
                    <Trash2 size={16} />
                  </button>
                </>
              ) : (
                <span className="text-sm text-muted">{m.role === 'owner' ? 'Owner' : 'Editor'}</span>
              )}
            </li>
          ))}
        </ul>
        {isOwner && (
          <form onSubmit={invite} className="card mt-3 space-y-3">
            <p className="text-sm text-muted">
              Invite someone: add their email here, then send them the site link. They sign in with that email. Editors can add and edit
              recipes, rate and log cooks. Only owners see the meal plan and grocery list.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="!w-auto">
                <option value="editor">Editor</option>
                <option value="owner">Owner</option>
              </select>
              <button className="btn-primary">
                <UserPlus size={16} /> Invite
              </button>
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <p className="text-sm">
              Site link: <code className="rounded bg-line/60 px-1.5 py-0.5">{window.location.origin + import.meta.env.BASE_URL}</code>
            </p>
          </form>
        )}
      </section>

      <section>
        <h2 className="section-title">Tags</h2>
        <div className="space-y-3">
          {groups.map((g) => {
            const list = tags.filter((t) => t.grp === g)
            if (!list.length) return null
            return (
              <div key={g}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{g}</p>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((t) => (
                    <span key={t.name} className="inline-flex items-center gap-1 rounded-full border border-line bg-white py-0.5 pl-2.5 pr-1 text-sm capitalize">
                      {t.name}
                      <button onClick={() => removeTag(t.name)} className="rounded-full p-0.5 text-muted hover:text-red-700" aria-label={`Delete ${t.name}`}>
                        <Trash2 size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <form onSubmit={addTag} className="mt-3 flex gap-2">
          <input placeholder="New tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
          <select value={newTagGroup} onChange={(e) => setNewTagGroup(e.target.value)} className="!w-auto">
            {groups.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <button className="btn shrink-0">Add</button>
        </form>
      </section>

      <section className="card space-y-2 text-sm">
        <h2 className="font-serif text-lg font-semibold">Put it on your iPhone home screen</h2>
        <p className="text-muted">
          In Safari, tap the Share button, then <b>Add to Home Screen</b>. It opens full-screen like an app. The first time you open it
          from the home screen, sign in with the <b>code</b> from the email (the link opens in Safari instead).
        </p>
      </section>
    </div>
  )
}
