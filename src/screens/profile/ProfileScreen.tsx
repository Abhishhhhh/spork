import { useCurrentUser } from '../../hooks/useCurrentUser'
import { supabase } from '../../lib/supabase'

export default function ProfileScreen() {
  const { data: user, isLoading } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-neutral-400">Loading…</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex flex-col items-center gap-4 px-6 pt-10">
      {user.photo_url ? (
        <img src={user.photo_url} alt={user.name} className="h-24 w-24 rounded-full object-cover" />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-neutral-100 text-2xl text-neutral-400">
          {user.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="text-center">
        <p className="text-xl font-bold text-neutral-900">{user.name}</p>
        <p className="text-sm text-neutral-400">@{user.username}</p>
      </div>
      <div className="w-full rounded-2xl bg-neutral-50 p-4 text-center">
        <p className="text-3xl font-bold text-neutral-900">{user.calorie_goal ?? '—'}</p>
        <p className="text-xs text-neutral-400">daily calorie goal</p>
      </div>
      <button onClick={() => supabase.auth.signOut()} className="mt-4 text-sm text-red-500">
        Sign out
      </button>
    </div>
  )
}
