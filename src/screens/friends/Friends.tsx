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
import { useToast } from '../../components/Toast'

interface FoundUser {
  id: string
  username: string
  name: string
  photo_url: string | null
}

function Avatar({ user, size = 9 }: { user: Pick<FoundUser, 'name' | 'photo_url'>; size?: number }) {
  const cls = `h-${size} w-${size}`
  return user.photo_url ? (
    <img src={user.photo_url} alt={user.name} className={`${cls} rounded-full object-cover shrink-0`} />
  ) : (
    <div className={`flex ${cls} shrink-0 items-center justify-center rounded-full bg-surface border border-border/40 text-sm font-bold text-muted`}>
      {user.name.charAt(0).toUpperCase()}
    </div>
  )
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

  return (
    <div className="flex flex-col min-h-[calc(100vh-5rem)]">

      {/* ── Sticky search header ─────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-5 pt-5 pb-3 border-b border-border/40">
        <h1 className="text-xl font-bold text-primary mb-3">Friends</h1>
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            placeholder="Search by username…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-full bg-surface border border-border/60 pl-9 pr-5 py-2.5 text-base text-primary placeholder:text-muted"
          />
          {searching && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted text-xs">…</span>}
        </div>
      </div>

      <div className="flex flex-col gap-5 px-5 py-4">

        {/* ── Search results ────────────────────────────────────────── */}
        {showSearch && (
          <div className="animate-slide-down">
            {searchError && !searching && <p className="text-sm text-muted py-2">{searchError}</p>}
            {results.length > 0 && (
              <ul className="flex flex-col divide-y divide-border/40">
                {results.map((user) => {
                  const connected = connectedIds.has(user.id)
                  return (
                    <li key={user.id} className="flex items-center gap-3 py-3 animate-slide-up">
                      <Avatar user={user} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-primary">@{user.username}</p>
                        <p className="text-xs text-muted truncate">{user.name}</p>
                      </div>
                      <button
                        disabled={connected || sendMutation.isPending}
                        onClick={() => handleSend(user.id, user.username)}
                        className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold border transition-colors disabled:opacity-50 ${
                          connected ? 'border-border text-muted' : 'bg-primary text-background border-transparent'
                        }`}
                      >
                        {connected ? 'Added ✓' : 'Follow'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {!showSearch && (
          <>
            {/* ── Incoming requests ──────────────────────────────────── */}
            {data && data.incoming.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  Requests · {data.incoming.length}
                </h2>
                <ul className="flex flex-col divide-y divide-border/40">
                  {data.incoming.map(({ friendshipId, user }) => (
                    <li key={friendshipId} className="flex items-center gap-3 py-3 animate-slide-up">
                      <Avatar user={user} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-primary">@{user.username}</p>
                        <p className="text-xs text-muted truncate">{user.name}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDecline(friendshipId)}
                          disabled={declineMutation.isPending}
                          className="rounded-full border border-border/60 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-40"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleAccept(friendshipId, user.username)}
                          disabled={acceptMutation.isPending}
                          className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-40"
                        >
                          Accept
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Outgoing ───────────────────────────────────────────── */}
            {data && data.outgoing.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Sent</h2>
                <ul className="flex flex-col divide-y divide-border/40">
                  {data.outgoing.map(({ user }) => (
                    <li key={user.id} className="flex items-center gap-3 py-3">
                      <Avatar user={user} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-primary">@{user.username}</p>
                        <p className="text-xs text-muted truncate">{user.name}</p>
                      </div>
                      <span className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted">Requested</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Your Circle ────────────────────────────────────────── */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Your Circle · {data?.accepted.length ?? 0}
              </h2>

              {isLoading ? (
                <div className="flex flex-col gap-2">
                  {[1,2,3].map((i) => <FriendRowSkeleton key={i} />)}
                </div>
              ) : !data || data.accepted.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-muted/50">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <p className="text-sm font-semibold text-primary">No friends yet</p>
                  <p className="text-xs text-muted">Follow someone below to get started.</p>
                </div>
              ) : (
                <ul className="flex flex-col divide-y divide-border/40">
                  {data.accepted.map((user) => (
                    <li key={user.id}>
                      <button
                        onClick={() => navigate(`/home/friend/${user.username}`)}
                        className="flex w-full items-center gap-3 py-3 text-left no-press"
                      >
                        <Avatar user={user} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-primary">@{user.username}</p>
                          <p className="text-xs text-muted truncate">{user.name}</p>
                        </div>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-muted shrink-0">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ── Suggested for you ──────────────────────────────────── */}
            {(visibleSuggestions.length > 0 || suggestionsLoading) && (
              <section>
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  Suggested for you
                </h2>
                <p className="mb-3 text-xs text-muted">
                  {data && data.accepted.length > 0
                    ? 'People your friends are connected with'
                    : 'Active users you might want to follow'}
                </p>

                {suggestionsLoading ? (
                  <div className="flex flex-col gap-2">
                    {[1,2,3].map((i) => <FriendRowSkeleton key={i} />)}
                  </div>
                ) : (
                  <ul className="flex flex-col divide-y divide-border/40">
                    {visibleSuggestions.map((user) => (
                      <li key={user.id} className="flex items-center gap-3 py-3">
                        <Avatar user={user} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-primary">@{user.username}</p>
                          <p className="text-xs text-muted truncate">
                            {user.mutualCount > 0
                              ? `${user.mutualCount} mutual friend${user.mutualCount > 1 ? 's' : ''}`
                              : user.recentLogs > 0
                              ? `${user.recentLogs} meal${user.recentLogs > 1 ? 's' : ''} this week`
                              : user.name}
                          </p>
                        </div>
                        <button
                          disabled={connectedIds.has(user.id) || sendMutation.isPending}
                          onClick={() => handleSend(user.id, user.username)}
                          className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
                        >
                          {connectedIds.has(user.id) ? 'Added ✓' : 'Follow'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
