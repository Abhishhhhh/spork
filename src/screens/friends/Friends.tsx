import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useFriendships,
  useSendFriendRequest,
} from '../../hooks/useFriendships'

interface FoundUser {
  id: string
  username: string
  name: string
  photo_url: string | null
}

export default function Friends() {
  const navigate = useNavigate()
  const { data, isLoading } = useFriendships()
  const acceptMutation = useAcceptFriendRequest()
  const declineMutation = useDeclineFriendRequest()
  const sendMutation = useSendFriendRequest()

  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<FoundUser[]>([])
  const [error, setError] = useState<string | null>(null)

  async function handleSearch() {
    setError(null)
    const term = searchTerm.trim().toLowerCase()
    if (!term) {
      setError('Type a username to search.')
      return
    }

    const { data: found, error: searchError } = await supabase
      .from('users')
      .select('id, username, name, photo_url')
      .ilike('username', `%${term}%`)
      .limit(10)

    if (searchError) {
      setError('Search failed. Try again.')
      return
    }

    setResults(found ?? [])
    if ((found ?? []).length === 0) {
      setError('No users found with that username.')
    }
  }

  const connectedIds = new Set([
    ...(data?.accepted.map((u) => u.id) ?? []),
    ...(data?.incoming.map((r) => r.user.id) ?? []),
    ...(data?.outgoing.map((r) => r.user.id) ?? []),
  ])

  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      <div className="flex gap-2">
        <input
          placeholder="Search by username"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 rounded-full bg-border/60 px-5 py-2 text-base text-primary placeholder:text-muted"
        />
        <button onClick={handleSearch} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-background">
          Search
        </button>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map((user) => {
            const alreadyConnected = connectedIds.has(user.id)
            return (
              <li key={user.id} className="flex items-center justify-between rounded-full border border-border px-4 py-2">
                <span className="font-medium text-primary">@{user.username}</span>
                <button
                  disabled={alreadyConnected || sendMutation.isPending}
                  onClick={() => sendMutation.mutate(user.id)}
                  className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-background disabled:opacity-40"
                >
                  {alreadyConnected ? 'Added' : 'Add'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          {data && data.incoming.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-muted">REQUESTS</h2>
              <ul className="flex flex-col gap-2">
                {data.incoming.map(({ friendshipId, user }) => (
                  <li
                    key={friendshipId}
                    className="flex items-center justify-between rounded-full border border-border px-4 py-2"
                  >
                    <span className="font-medium text-primary">@{user.username}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => declineMutation.mutate(friendshipId)}
                        disabled={declineMutation.isPending}
                        className="rounded-full border border-border px-3 py-1 text-sm font-semibold text-primary disabled:opacity-40"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => acceptMutation.mutate(friendshipId)}
                        disabled={acceptMutation.isPending}
                        className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-background disabled:opacity-40"
                      >
                        Accept
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data && data.outgoing.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-muted">SENT</h2>
              <ul className="flex flex-col gap-2">
                {data.outgoing.map(({ friendshipId, user }) => (
                  <li
                    key={friendshipId}
                    className="flex items-center justify-between rounded-full border border-border px-4 py-2"
                  >
                    <span className="font-medium text-primary">@{user.username}</span>
                    <span className="rounded-full bg-border/60 px-3 py-1 text-sm text-muted">Requested</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h2 className="mb-2 text-sm font-semibold text-muted">YOUR CIRCLE · {data?.accepted.length ?? 0}</h2>
            {!data || data.accepted.length === 0 ? (
              <p className="text-sm text-muted">No friends yet — search above to add some.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.accepted.map((user) => (
                  <li key={user.id}>
                    <button
                      onClick={() => navigate(`/home/friend/${user.username}`)}
                      className="flex w-full items-center gap-3 rounded-full border border-border px-4 py-2 text-left"
                    >
                      {user.photo_url ? (
                        <img src={user.photo_url} alt={user.name} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-border/60 text-xs text-muted">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-primary">@{user.username}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
