import { useAuth } from '../lib/store'

export default function NotInvited() {
  const { session, signOut } = useAuth()
  return (
    <div className="flex min-h-dvh items-center justify-center p-6 text-center">
      <div className="max-w-sm space-y-4">
        <h1 className="font-serif text-2xl font-semibold">Not on the list yet</h1>
        <p className="text-muted">
          {session?.user.email} is signed in but hasn't been invited to this recipe box. Ask an owner to add you in Settings.
        </p>
        <button className="btn" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  )
}
