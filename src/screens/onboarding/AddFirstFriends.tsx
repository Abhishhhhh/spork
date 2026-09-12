import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../hooks/useSession'
import { useOnboardingStore } from '../../store/onboardingStore'
import { completeOnboarding } from '../../lib/completeOnboarding'
import { OnboardingProgress } from '../../components/OnboardingProgress'

interface FoundUser {
  id: string
  username: string
  name: string
  photo_url: string | null
  recentLogs?: number
}

function Avatar({ user }: { user: Pick<FoundUser, 'name' | 'photo_url'> }) {
  return user.photo_url ? (
    <img src={user.photo_url} alt={user.name} className="h-10 w-10 rounded-full object-cover shrink-0" />
  ) : (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface border border-border/40 text-sm font-bold text-muted">
      {user.name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function AddFirstFriends() {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const { session }  = useSession()
  const { name, username, avatarFile, calorieGoal, privacyDefault, friendUsernamesToRequest, addFriendUsername, reset } =
    useOnboardingStore()
  const proteinGoal = useOnboardingStore((s) => s.proteinGoal)

  const [searchTerm, setSearchTerm]   = useState('')
  const [results, setResults]         = useState<FoundUser[]>([])
  const [suggestions, setSuggestions] = useState<FoundUser[]>([])
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  // Load 3 recently-active public users as suggestions on mount
  useEffect(() => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    ;(async () => {
      // Fetch recently active public users
      const { data: recentLogs } = await supabase
        .from('logs')
        .select('user_id')
        .gte('created_at', cutoff)
        .limit(50)

      if (!recentLogs || recentLogs.length === 0) return

      const countById: Record<string, number> = {}
      for (const l of recentLogs) countById[l.user_id] = (countById[l.user_id] ?? 0) + 1

      const topIds = Object.entries(countById)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([id]) => id)

      if (topIds.length === 0) return

      const { data: users } = await supabase
        .from('users')
        .select('id, username, name, photo_url, privacy_default')
        .in('id', topIds)
        .eq('privacy_default', 'public')

      const enriched: FoundUser[] = (users ?? []).map((u) => ({
        id:         u.id,
        username:   u.username,
        name:       u.name,
        photo_url:  u.photo_url,
        recentLogs: countById[u.id] ?? 0,
      }))

      // Show at most 3, best first
      setSuggestions(
        enriched
          .sort((a, b) => (b.recentLogs ?? 0) - (a.recentLogs ?? 0))
          .slice(0, 3)
      )
    })()
  }, [])

  async function handleSearch() {
    setError(null)
    const term = searchTerm.trim().toLowerCase()
    if (!term) { setError('Type a username to search.'); return }

    const { data, error: searchError } = await supabase
      .from('users')
      .select('id, username, name, photo_url')
      .ilike('username', `%${term}%`)
      .limit(10)

    if (searchError) { setError('Search failed. Try again.'); return }

    setResults(data ?? [])
    if ((data ?? []).length === 0) setError('No users found with that username.')
  }

  async function finish() {
    if (!session || calorieGoal === null) return
    setSubmitting(true)
    setError(null)

    try {
      await completeOnboarding({
        userId: session.user.id,
        name,
        username,
        avatarFile,
        calorieGoal,
        proteinGoal,
        privacyDefault,
        friendUsernamesToRequest,
      })
      reset()
      queryClient.removeQueries({ queryKey: ['currentUser'] })
      navigate('/home/feed')
    } catch (err) {
      const isUsernameConflict =
        typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '23505'

      setError(
        isUsernameConflict
          ? 'That username was just taken by someone else.'
          : 'Something went wrong finishing setup. Please try again.',
      )

      if (isUsernameConflict) navigate('/onboarding/profile')
    } finally {
      setSubmitting(false)
    }
  }

  if (calorieGoal === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-base font-semibold text-primary">Session issue</p>
        <p className="text-sm text-muted">
          Your plan details weren't saved — this can happen if you confirmed
          your email in a different browser tab. Please re-enter them now.
        </p>
        <button
          onClick={() => navigate('/onboarding/basics')}
          className="rounded-full bg-primary px-6 py-3 text-base font-semibold text-background"
        >
          Re-enter my plan
        </button>
      </div>
    )
  }

  const addedSet = new Set(friendUsernamesToRequest)

  return (
    <div className="flex min-h-screen flex-col px-5 py-8">
      <button
        onClick={() => navigate('/onboarding/privacy')}
        aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-card)] text-primary"
      >
        ←
      </button>
      <OnboardingProgress step={3} total={3} />

      <h1 className="mb-1 text-xl font-bold text-primary">Add your first friends</h1>
      <p className="mb-6 text-sm text-muted">A feed is better with people in it.</p>

      {/* ── Search ─────────────────────────────────────────────── */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            placeholder="Search by username"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full rounded-full bg-surface border border-border/60 pl-9 pr-4 py-2.5 text-base text-primary placeholder:text-muted"
          />
        </div>
        <button
          onClick={handleSearch}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-background"
        >
          Search
        </button>
      </div>

      {/* ── Search results ─────────────────────────────────────── */}
      {results.length > 0 && (
        <ul className="mb-5 flex flex-col divide-y divide-border/40">
          {results.map((user) => {
            const alreadyAdded = addedSet.has(user.username)
            return (
              <li key={user.id} className="flex items-center gap-3 py-3">
                <Avatar user={user} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary">@{user.username}</p>
                  <p className="text-xs text-muted truncate">{user.name}</p>
                </div>
                <button
                  disabled={alreadyAdded}
                  onClick={() => addFriendUsername(user.username)}
                  className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-background disabled:opacity-40"
                >
                  {alreadyAdded ? 'Added ✓' : 'Follow'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* ── Suggested accounts ─────────────────────────────────── */}
      {suggestions.length > 0 && results.length === 0 && (
        <div className="mb-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Suggested</p>
          <p className="mb-3 text-xs text-muted">Active users to follow — your feed will show their meals</p>
          <ul className="flex flex-col divide-y divide-border/40">
            {suggestions.map((user) => {
              const alreadyAdded = addedSet.has(user.username)
              return (
                <li key={user.id} className="flex items-center gap-3 py-3">
                  <Avatar user={user} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary">@{user.username}</p>
                    <p className="text-xs text-muted">
                      {(user.recentLogs ?? 0) > 0
                        ? `${user.recentLogs} meal${user.recentLogs! > 1 ? 's' : ''} this week`
                        : 'Active user'}
                    </p>
                  </div>
                  <button
                    disabled={alreadyAdded}
                    onClick={() => addFriendUsername(user.username)}
                    className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-background disabled:opacity-40"
                  >
                    {alreadyAdded ? 'Added ✓' : 'Follow'}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ── Added list ─────────────────────────────────────────── */}
      {friendUsernamesToRequest.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Following after sign-up · {friendUsernamesToRequest.length}
          </p>
          <div className="flex flex-wrap gap-2">
            {friendUsernamesToRequest.map((un) => (
              <span key={un} className="rounded-full bg-surface border border-border/60 px-3 py-1 text-xs font-medium text-primary">
                @{un} ✓
              </span>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-error">{error}</p>}

      <div className="mt-auto flex flex-col gap-3 pt-4">
        <button
          onClick={finish}
          disabled={submitting}
          className="rounded-full bg-primary py-3 text-base font-semibold text-background disabled:opacity-50"
        >
          {submitting
            ? 'Finishing…'
            : friendUsernamesToRequest.length > 0
            ? `Finish & follow ${friendUsernamesToRequest.length}`
            : 'Skip for now'}
        </button>
        {friendUsernamesToRequest.length === 0 && (
          <p className="text-center text-xs text-muted">You can always find friends later from the Feed tab.</p>
        )}
      </div>
    </div>
  )
}
