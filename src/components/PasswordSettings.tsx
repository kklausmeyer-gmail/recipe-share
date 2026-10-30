import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export default function PasswordSettings({ email }: { email: string }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [hasPassword, setHasPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    if (password !== confirmation) { setError('The passwords do not match.'); return }
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password, ...(currentPassword ? { current_password: currentPassword } : {}) })
      if (error) { setError(error.message); return }
      setPassword('')
      setConfirmation('')
      setCurrentPassword('')
      setHasPassword(true)
      setSaved(true)
    } catch { setError('Could not reach the sign-in service. Please try again.') }
    finally { setBusy(false) }
  }

  return <section className="card space-y-3" id="password">
    <h2 className="font-serif text-lg font-semibold">Set or change your password</h2>
    <p className="text-sm text-muted">Set a password for {email} to sign in directly on your iPhone, computer, or tablet. Each person sets their own password.</p>
    <form onSubmit={save} className="space-y-3">
      <input type="email" name="username" autoComplete="username" value={email} readOnly className="sr-only" tabIndex={-1} aria-label="Account email" />
      <fieldset disabled={busy} className="space-y-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hasPassword} onChange={(e) => { setHasPassword(e.target.checked); setCurrentPassword('') }} /> I already have a password</label>
        {hasPassword && <label className="field"><span>Current password</span><input type="password" name="current-password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>}
        <label className="field"><span>New password</span><input type="password" name="new-password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => { setPassword(e.target.value); setSaved(false) }} /></label>
        <label className="field"><span>Confirm new password</span><input type="password" name="confirm-password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label>
        <p className="text-xs text-muted">Use at least 8 characters. If you forgot your password, sign in using an email link and return here to set a new one.</p>
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {saved && <p role="status" className="text-sm text-green-800">Password saved. Use your email and this password to sign in on your other devices. You’re still signed in here.</p>}
    </form>
  </section>
}
