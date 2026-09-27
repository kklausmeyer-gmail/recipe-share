export default function SetupNeeded() {
  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="font-serif text-2xl font-semibold">Almost there</h1>
      <p className="mt-3 text-muted">
        This site isn't connected to its database yet. Fill in <code>VITE_SUPABASE_URL</code> and{' '}
        <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in <code>.env.production</code> (see <code>docs/SETUP.md</code>) and push.
      </p>
    </div>
  )
}
