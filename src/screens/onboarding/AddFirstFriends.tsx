import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../hooks/useSession'
import { useOnboardingStore } from '../../store/onboardingStore'
import { completeOnboarding } from '../../lib/completeOnboarding'

interface FoundUser {
  id: string
  username: string
  name: string
  photo_url: string | null
}

export default function AddFirstFriends() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { name, username, avatarFile, calorieGoal, privacyDefault, friendUsernamesToRequest, addFriendUsername, reset } =
    useOnboardingStore()

  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<FoundUser[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch() {
    setError(null)
    const term = searchTerm.trim().toLowerCase()
    if (!term) {
      setError('Type a username to search.')
      return
    }

    const { data, error: searchError } = await supabase
      .from('users')
      .select('id, username, name, photo_url')
      .ilike('username', `%${term}%`)
      .limit(10)

    if (searchError) {
      setError('Search failed. Try again.')
      return
    }

    setResults(data ?? [])
    if ((data ?? []).length === 0) {
      setError('No users found with that username.')
    }
  }

  async function finish() {
    // The `calorieGoal === null` case is handled by the early-return render
    // above (it shows "Restart onboarding" instead of this screen), so this
    // check only narrows the type for TypeScript — it isn't reachable in
    // practice once that guard is in place.
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
        privacyDefault,
        friendUsernamesToRequest,
      })
      reset()
      navigate('/home/feed')
    } catch (err) {
      const isUsernameConflict =
        typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '23505'

      setError(
        isUsernameConflict
          ? 'That username was just taken by someone else.'
          : 'Something went wrong finishing setup. Please try again.',
      )

      if (isUsernameConflict) {
        navigate('/onboarding/profile')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (calorieGoal === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-neutral-500">
          Your progress from earlier onboarding steps was lost (e.g. by a page reload). Please restart.
        </p>
        <button
          onClick={() => navigate('/onboarding/profile')}
          className="rounded-2xl bg-orange-500 px-6 py-3 text-base font-semibold text-white"
        >
          Restart onboarding
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-neutral-900">Add friends</h1>
      <p className="mb-6 text-sm text-neutral-500">Optional — you can always do this later.</p>

      <div className="mb-4 flex gap-2">
        <input
          placeholder="Search by username"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 rounded-2xl border border-neutral-200 px-4 py-2 text-base"
        />
        <button onClick={handleSearch} className="rounded-2xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">
          Search
        </button>
      </div>

      <button className="mb-4 rounded-2xl bg-neutral-100 py-2 text-sm text-neutral-500" disabled>
        Find from Contacts (coming soon)
      </button>

      <ul className="mb-6 flex flex-col gap-2">
        {results.map((user) => {
          const alreadyAdded = friendUsernamesToRequest.includes(user.username)
          return (
            <li key={user.id} className="flex items-center justify-between rounded-xl border border-neutral-100 p-3">
              <span className="font-medium text-neutral-900">@{user.username}</span>
              <button
                disabled={alreadyAdded}
                onClick={() => addFriendUsername(user.username)}
                className="rounded-lg bg-orange-500 px-3 py-1 text-sm font-semibold text-white disabled:opacity-40"
              >
                {alreadyAdded ? 'Added' : 'Add'}
              </button>
            </li>
          )
        })}
      </ul>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <button
        onClick={finish}
        disabled={submitting}
        className="rounded-2xl bg-orange-500 py-3 text-base font-semibold text-white disabled:opacity-50"
      >
        {submitting ? 'Finishing…' : friendUsernamesToRequest.length > 0 ? 'Finish' : 'Skip & Finish'}
      </button>
    </div>
  )
}
