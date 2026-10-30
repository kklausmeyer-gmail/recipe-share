import { Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { siteUrl, supabase } from '../lib/supabase'

export default function Login() {
  const [method, setMethod] = useState<'password' | 'email'>('password')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (error) setError(error.code === 'invalid_credentials'
        ? 'Email or password is incorrect. If you haven’t set a password yet, use the email-link option below.'
        : error.message)
      else setPassword('')
    } catch { setError('Could not reach the sign-in service. Please try again.') }
    finally { setBusy(false) }
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: siteUrl(), shouldCreateUser: true },
      })
      if (error) {
        setError(/database error|not_invited/i.test(error.message)
          ? "That email hasn't been invited yet. Ask whoever runs the recipe box to add you."
          : error.message)
      } else setSent(true)
    } catch { setError('Could not reach the sign-in service. Please try again.') }
    finally { setBusy(false) }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.replace(/\s+/g, ''), type: 'email' })
      if (error) setError(error.message)
    } catch { setError('Could not reach the sign-in service. Please try again.') }
    finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-accent-soft via-cream to-sage-soft p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white/90 p-8 shadow-xl ring-1 ring-line backdrop-blur">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="mx-auto mb-4 h-16 w-16" />
        <h1 className="text-center font-serif text-3xl font-semibold">Recipe Box</h1>
        {method === 'password' ? (
          <form onSubmit={signIn} className="mt-6 space-y-4">
            <p className="text-center text-sm text-muted">Sign in with your email and password.</p>
            <label className="field"><span>Email</span><input type="email" name="username" required autoComplete="username" placeholder="you@example.com" disabled={busy} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="field"><span>Password</span><input type="password" name="password" required autoComplete="current-password" disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <button type="button" className="btn-ghost w-full" disabled={busy} onClick={() => { setMethod('email'); setError(null); setPassword('') }}>First time or forgot password? Use an email link</button>
          </form>
        ) : !sent ? (
          <form onSubmit={send} className="mt-6 space-y-4">
            <p className="text-center text-sm text-muted">Sign in with an email link, then open Settings to set or change your password. The link opens in your browser.</p>
            <input
              aria-label="Email for sign-in link"
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
              Check <b>{email}</b>. Open the sign-in link in your browser, then go to Settings to set a password. Afterward, return to your home-screen app and sign in with your email and password. If your email includes a code, you can enter it here instead.
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
            <button type="button" className="btn-ghost w-full" disabled={busy} onClick={() => setSent(false)}>
              Use a different email
            </button>
          </form>
        )}
        {method === 'email' && <button type="button" className="btn-ghost mt-3 w-full" disabled={busy} onClick={() => { setMethod('password'); setSent(false); setCode(''); setError(null) }}>Back to password sign-in</button>}
        {error && <p className="mt-4 text-center text-sm text-red-700">{error}</p>}
      </div>
    </div>
  )
}
