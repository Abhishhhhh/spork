import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useFriendships,
  useSendFriendRequest,
} from '../../hooks/useFriendships'
import { useRecommendedUsers } from '../../hooks/useRecommendedUsers'
import { useSession } from '../../hooks/useSession'
import { FriendRowSkeleton } from '../../components/Skeleton'
import { TopBar } from '../../components/TopBar'
import { Avatar } from '../../components/Avatar'
import { useToast } from '../../components/Toast'

interface FoundUser {
  id: string
  username: string
  name: string
  photo_url: string | null
}

export default function Friends() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { data, isLoading }   = useFriendships()
  const { data: suggestions, isLoading: suggestionsLoading } = useRecommendedUsers(8)
  const acceptMutation        = useAcceptFriendRequest()
  const declineMutation       = useDeclineFriendRequest()
  const sendMutation          = useSendFriendRequest()
  const { toast }             = useToast()

  const [searchTerm, setSearchTerm]   = useState('')
  const [results, setResults]         = useState<FoundUser[]>([])
  const [searching, setSearching]     = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Live debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const term = searchTerm.trim().toLowerCase()
    if (!term) { setResults([]); setSearchError(null); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      setSearchError(null)
      const { data: found, error } = await supabase
        .from('users')
        .select('id, username, name, photo_url')
        .ilike('username', `%${term}%`)
        .neq('id', session?.user.id ?? '')
        .limit(8)
      setSearching(false)
      if (error) { setSearchError('Search failed.'); return }
      setResults(found ?? [])
      if ((found ?? []).length === 0) setSearchError('No users found.')
    }, 350)
  }, [searchTerm, session?.user.id])

  const connectedIds = new Set([
    ...(data?.accepted.map((u) => u.id) ?? []),
    ...(data?.incoming.map((r) => r.user.id) ?? []),
    ...(data?.outgoing.map((r) => r.user.id) ?? []),
  ])

  function handleSend(userId: string, username: string) {
    sendMutation.mutate(userId, {
      onSuccess: () => toast(`Request sent to @${username} 👋`),
      onError:   () => toast('Could not send request', 'error'),
    })
  }

  function handleAccept(id: string, username: string) {
    acceptMutation.mutate(id, {
      onSuccess: () => toast(`You and @${username} are now friends 🎉`),
      onError:   () => toast('Could not accept', 'error'),
    })
  }

  function handleDecline(id: string) {
    declineMutation.mutate(id, {
      onError: () => toast('Could not decline', 'error'),
    })
  }

  const showSearch = searchTerm.trim().length > 0

  // Suggestions to show = recommendations not already connected
  const visibleSuggestions = (suggestions ?? []).filter((u) => !connectedIds.has(u.id))

  function person(user: FoundUser, desc: string, action: React.ReactNode, onClick?: () => void) {
    const body = (
      <>
        <Avatar name={user.name} photoUrl={user.photo_url} />
        <span className="min-w-0 flex-1">
          <b>{user.name}</b>
          <small className="truncate">{desc}</small>
        </span>
        {action}
      </>
    )
    return onClick ? (
      <button type="button" onClick={onClick} className="choice no-press">{body}</button>
    ) : (
      <div className="choice">{body}</div>
    )
  }

  return (
    <div>
      <TopBar title="Friends" back="/home/feed" />

      {/* ── Search ──────────────────────────────────────────────── */}
      <div className="relative">
        <input
          className="input"
          placeholder="Search by username"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoCapitalize="none"
        />
        {searching && <span className="muted absolute right-4 top-1/2 -translate-y-1/2 text-xs">…</span>}
      </div>

      {/* ── Search results ────────────────────────────────────────── */}
      {showSearch && (
        <div className="section animate-slide-down">
          <span className="caps">Results</span>
          {searchError && !searching && <p className="small muted">{searchError}</p>}
          <div className="list">
            {results.map((user) => {
              const connected = connectedIds.has(user.id)
              return (
                <div key={user.id}>
                  {person(
                    user,
                    `@${user.username}`,
                    <button
                      type="button"
                      disabled={connected || sendMutation.isPending}
                      onClick={() => handleSend(user.id, user.username)}
                      className={`pill ${connected ? 'tint' : 'sel'}`}
                    >
                      {connected ? 'Added ✓' : 'Follow'}
                    </button>,
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!showSearch && (
        <>
          {/* ── Incoming requests ──────────────────────────────────── */}
          {data && data.incoming.length > 0 && (
            <section className="section">
              <span className="caps">Requests · {data.incoming.length}</span>
              <div className="list">
                {data.incoming.map(({ friendshipId, user }) => (
                  <div key={friendshipId} className="animate-slide-up">
                    {person(
                      user,
                      'Wants to connect',
                      <span className="flex gap-1.5">
                        <button type="button" onClick={() => handleDecline(friendshipId)} disabled={declineMutation.isPending} className="pill tint">
                          Decline
                        </button>
                        <button type="button" onClick={() => handleAccept(friendshipId, user.username)} disabled={acceptMutation.isPending} className="pill sel">
                          Accept
                        </button>
                      </span>,
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Outgoing ───────────────────────────────────────────── */}
          {data && data.outgoing.length > 0 && (
            <section className="section">
              <span className="caps">Sent</span>
              <div className="list">
                {data.outgoing.map(({ user }) => (
                  <div key={user.id}>
                    {person(user, `@${user.username}`, <span className="pill tint">Requested</span>)}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Following ──────────────────────────────────────────── */}
          <section className="section">
            <span className="caps">Following · {data?.accepted.length ?? 0}</span>
            {isLoading ? (
              <div className="list">{[1, 2, 3].map((i) => <FriendRowSkeleton key={i} />)}</div>
            ) : !data || data.accepted.length === 0 ? (
              <div className="card tint text-center" style={{ margin: 0 }}>
                <div style={{ fontSize: 34, lineHeight: 1 }}>♧</div>
                <h4 style={{ marginTop: 10 }}>No friends yet</h4>
                <p className="small muted">Follow someone below to get started</p>
              </div>
            ) : (
              <div className="list">
                {data.accepted.map((user) => (
                  <div key={user.id}>
                    {person(user, `@${user.username}`, <span className="pill">View</span>, () => navigate(`/home/friend/${user.username}`))}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Suggested for you ──────────────────────────────────── */}
          {(visibleSuggestions.length > 0 || suggestionsLoading) && (
            <section className="section">
              <span className="caps">People you may know</span>
              {suggestionsLoading ? (
                <div className="list">{[1, 2, 3].map((i) => <FriendRowSkeleton key={i} />)}</div>
              ) : (
                <div className="list">
                  {visibleSuggestions.map((user) => (
                    <div key={user.id}>
                      {person(
                        user,
                        user.mutualCount > 0
                          ? `@${user.username} · ${user.mutualCount} mutual friend${user.mutualCount > 1 ? 's' : ''}`
                          : user.recentLogs > 0
                          ? `@${user.username} · ${user.recentLogs} meal${user.recentLogs > 1 ? 's' : ''} this week`
                          : `@${user.username}`,
                        <button
                          type="button"
                          disabled={connectedIds.has(user.id) || sendMutation.isPending}
                          onClick={() => handleSend(user.id, user.username)}
                          className={`pill ${connectedIds.has(user.id) ? 'tint' : 'sel'}`}
                        >
                          {connectedIds.has(user.id) ? 'Added ✓' : 'Follow'}
                        </button>,
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
