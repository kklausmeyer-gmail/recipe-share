import { Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { siteUrl, supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: siteUrl(), shouldCreateUser: true },
    })
    setBusy(false)
    if (error) {
      setError(
        /database error|not_invited/i.test(error.message)
          ? "That email hasn't been invited yet. Ask whoever runs the recipe box to add you."
          : error.message,
      )
    } else {
      setSent(true)
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-accent-soft via-cream to-sage-soft p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white/90 p-8 shadow-xl ring-1 ring-line backdrop-blur">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="mx-auto mb-4 h-16 w-16" />
        <h1 className="text-center font-serif text-3xl font-semibold">Recipe Box</h1>
        {!sent ? (
          <form onSubmit={send} className="mt-6 space-y-4">
            <p className="text-center text-sm text-muted">We'll email you a sign-in link. No password needed.</p>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn-primary w-full" disabled={busy}>
              <Mail size={16} /> {busy ? 'Sending…' : 'Email me a link'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-6 space-y-4">
            <p className="text-center text-sm text-muted">
              Check <b>{email}</b>. Tap the link in the email, or type the code from it here. (Using the home-screen app? Use the code.)
            </p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Code from the email"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="text-center tracking-[0.3em]"
            />
            <button className="btn-primary w-full" disabled={busy || code.trim().length < 6}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button type="button" className="btn-ghost w-full" onClick={() => setSent(false)}>
              Use a different email
            </button>
          </form>
        )}
        {error && <p className="mt-4 text-center text-sm text-red-700">{error}</p>}
      </div>
    </div>
  )
}
