import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useFeed } from '../../hooks/useFeed'
import { useNotifications } from '../../hooks/useNotifications'
import { getEffectiveStreak } from '../../lib/streak'
import { useToggleLike } from '../../hooks/useMealDetail'

export default function Feed() {
  const navigate = useNavigate()
  const { data: items, isLoading, isError } = useFeed()
  const { unreadCount } = useNotifications()
  const toggleLike = useToggleLike()
  const [optimisticLikes, setOptimisticLikes] = useState<Record<string, boolean>>({})

  if (isLoading) {
    return (
      <>
        <FeedHeader unreadCount={unreadCount} onBellClick={() => navigate('/home/notifications')} />
        <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
          <p className="text-muted">Loading…</p>
        </div>
      </>
    )
  }

  if (isError) {
    return (
      <>
        <FeedHeader unreadCount={unreadCount} onBellClick={() => navigate('/home/notifications')} />
        <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-6 text-center">
          <p className="text-muted">Something went wrong loading your feed. Try refreshing.</p>
        </div>
      </>
    )
  }

  if (!items || items.length === 0) {
    return (
      <>
        <FeedHeader unreadCount={unreadCount} onBellClick={() => navigate('/home/notifications')} />
        <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-lg font-semibold text-primary">Your feed is quiet</p>
          <p className="text-sm text-muted">Add a few friends, or log your first meal.</p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/home/friends')}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-background"
            >
              Add friends
            </button>
            <button
              onClick={() => navigate('/home/log')}
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold text-primary"
            >
              Log a meal
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <FeedHeader unreadCount={unreadCount} onBellClick={() => navigate('/home/notifications')} />
      <div className="flex flex-col gap-3 px-4 py-6">
        {items.map(({ log, author, photoSignedUrl, likeCount, likedByViewer, commentCount }) => {
          const effectiveStreak = getEffectiveStreak(author.streak_count, author.streak_last_log_date, new Date())
          return (
            <button
              key={log.id}
              onClick={() => navigate(`/home/log/${log.id}`)}
              className="flex flex-col gap-2 rounded-2xl border border-border p-4 text-left"
            >
              {photoSignedUrl && (
                <img src={photoSignedUrl} alt="" className="h-40 w-full rounded-xl object-cover" />
              )}
              <div className="flex items-center gap-2">
                {author.photo_url ? (
                  <img src={author.photo_url} alt={author.name} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-border/60 text-xs text-muted">
                    {author.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-semibold text-primary">@{author.username}</span>
                {effectiveStreak > 0 && <span className="text-sm">🔥</span>}
                <span className="ml-auto text-xs text-muted">
                  {new Date(log.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
              {log.name && <p className="font-semibold text-primary">{log.name}</p>}
              <div className="flex items-center justify-between">
                <span className="text-xs capitalize text-muted">{log.meal_type}</span>
                <span className="text-lg font-bold text-primary">
                  {log.calories_final ?? log.calories_estimate ?? '—'} kcal
                </span>
              </div>
              <div className="flex items-center gap-4 pt-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const displayLiked = optimisticLikes[log.id] ?? likedByViewer
                    setOptimisticLikes((prev) => ({ ...prev, [log.id]: !displayLiked }))
                    toggleLike.mutate(
                      { logId: log.id, logOwnerId: log.user_id, currentlyLiked: displayLiked },
                      {
                        onError: () =>
                          setOptimisticLikes((prev) => ({ ...prev, [log.id]: displayLiked })),
                      },
                    )
                  }}
                  className="flex items-center gap-1 text-sm text-muted"
                >
                  <span>{(optimisticLikes[log.id] ?? likedByViewer) ? '🔥' : '🤍'}</span>
                  <span>
                    {likeCount + (optimisticLikes[log.id] === undefined ? 0 : optimisticLikes[log.id] === likedByViewer ? 0 : optimisticLikes[log.id] ? 1 : -1)}
                  </span>
                </button>
                <span className="flex items-center gap-1 text-sm text-muted">
                  <span>💬</span>
                  <span>{commentCount}</span>
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}

function FeedHeader({ unreadCount, onBellClick }: { unreadCount: number; onBellClick: () => void }) {
  return (
    <div className="flex justify-end px-4 pt-4">
      <button onClick={onBellClick} aria-label="Notifications" className="relative text-2xl">
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-semibold text-background">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  )
}
