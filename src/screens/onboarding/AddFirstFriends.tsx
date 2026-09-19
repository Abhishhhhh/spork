import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../hooks/useSession'
import { useOnboardingStore } from '../../store/onboardingStore'
import { completeOnboarding } from '../../lib/completeOnboarding'
import { TopBar } from '../../components/TopBar'
import { Avatar } from '../../components/Avatar'

interface FoundUser {
  id: string
  username: string
  name: string
  photo_url: string | null
  recentLogs?: number
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
      <div className="screen min-h-screen">
        <TopBar title="Your plan" back={null} />
        <div className="text-center" style={{ padding: '80px 10px' }}>
          <div style={{ fontSize: 60, lineHeight: 1 }}>◌</div>
          <h2 style={{ marginTop: 16 }}>Session issue</h2>
          <p className="muted">
            Your plan details weren't saved — this can happen if you confirmed
            your email in a different browser tab. Please re-enter them now.
          </p>
          <button type="button" onClick={() => navigate('/onboarding/basics')} className="btn" style={{ marginTop: 30 }}>
            Re-enter my plan
          </button>
        </div>
      </div>
    )
  }

  const addedSet = new Set(friendUsernamesToRequest)

  function renderPerson(user: FoundUser, desc: string) {
    const alreadyAdded = addedSet.has(user.username)
    return (
      <li key={user.id} className="choice">
        <Avatar name={user.name} photoUrl={user.photo_url} />
        <span className="min-w-0 flex-1">
          <b>@{user.username}</b>
          <small className="truncate">{user.name} · {desc}</small>
        </span>
        <button
          type="button"
          disabled={alreadyAdded}
          onClick={() => addFriendUsername(user.username)}
          className={`pill ${alreadyAdded ? 'tint' : 'sel'}`}
        >
          {alreadyAdded ? 'Added ✓' : 'Follow'}
        </button>
      </li>
    )
  }

  return (
    <div className="screen flex min-h-screen flex-col">
      <TopBar title="Your plan" back="/onboarding/privacy" />

      <h2>Add your first friends</h2>
      <p className="muted">Find people to share your progress with</p>
      <div style={{ height: 15 }} />

      {/* ── Search ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5">
        <input
          className="input flex-1"
          placeholder="Search by username"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          autoCapitalize="none"
        />
        <button type="button" onClick={handleSearch} className="pill sel" style={{ padding: '12px 16px' }}>
          Search
        </button>
      </div>

      {/* ── Search results ─────────────────────────────────────── */}
      {results.length > 0 && (
        <div className="section">
          <span className="caps">Results</span>
          <ul className="list">
            {results.map((user) => renderPerson(user, 'On Spork'))}
          </ul>
        </div>
      )}

      {/* ── Suggested accounts ─────────────────────────────────── */}
      {suggestions.length > 0 && results.length === 0 && (
        <div className="section">
          <span className="caps">Suggested people</span>
          <ul className="list">
            {suggestions.map((user) =>
              renderPerson(
                user,
                (user.recentLogs ?? 0) > 0
                  ? `${user.recentLogs} meal${user.recentLogs! > 1 ? 's' : ''} this week`
                  : 'Active user',
              ),
            )}
          </ul>
        </div>
      )}

      {/* ── Added list ─────────────────────────────────────────── */}
      <p className="small muted" style={{ marginTop: 16 }}>
        Following after sign-up · {friendUsernamesToRequest.length}
        {friendUsernamesToRequest.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {friendUsernamesToRequest.map((un) => <span key={un} className="pill">@{un} ✓</span>)}
          </span>
        )}
      </p>

      {error && <p className="error-text">{error}</p>}

      <div className="mt-auto pt-4">
        <button type="button" onClick={finish} disabled={submitting} className="btn">
          {submitting
            ? 'Finishing…'
            : friendUsernamesToRequest.length > 0
            ? `Start using Spork · follow ${friendUsernamesToRequest.length}`
            : 'Start using Spork'}
        </button>
        {friendUsernamesToRequest.length === 0 && (
          <p className="hint">You can always find friends later from the Home tab</p>
        )}
      </div>
    </div>
  )
}
