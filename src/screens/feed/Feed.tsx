import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useFeed } from '../../hooks/useFeed'
import { useNotifications } from '../../hooks/useNotifications'
import { useSession } from '../../hooks/useSession'
import { useToggleLike } from '../../hooks/useMealDetail'
import { PostCard } from '../../components/PostCard'
import { FeedCardSkeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'

export default function Feed() {
  const navigate                          = useNavigate()
  const { session }                       = useSession()
  const { data: items, isLoading, isError } = useFeed()
  const { unreadCount }                   = useNotifications()
  const toggleLike                        = useToggleLike()
  const { toast }                         = useToast()
  const [optimisticLikes, setOptimisticLikes] = useState<Record<string, boolean>>({})
  const [likeAnimating,   setLikeAnimating]   = useState<Record<string, boolean>>({})

  function handleLike(logId: string, logOwnerId: string, currentlyLiked: boolean) {
    const next = !currentlyLiked
    setOptimisticLikes((p) => ({ ...p, [logId]: next }))
    if (next) {
      setLikeAnimating((p) => ({ ...p, [logId]: true }))
      setTimeout(() => setLikeAnimating((p) => ({ ...p, [logId]: false })), 350)
    }
    toggleLike.mutate(
      { logId, logOwnerId, currentlyLiked },
      { onError: () => { setOptimisticLikes((p) => ({ ...p, [logId]: currentlyLiked })); toast('Could not like — try again', 'error') } },
    )
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-5rem)]">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 px-5 py-3.5 backdrop-blur-sm border-b border-border/40">
        <div className="flex items-center gap-1">
          <h1 className="text-xl font-bold text-primary">Home</h1>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-muted mt-0.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/home/friends')} aria-label="Search friends"
            className="flex h-9 w-9 items-center justify-center rounded-full text-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </button>
          <button onClick={() => navigate('/home/notifications')} aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-error" />}
          </button>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex flex-col divide-y divide-border/40 pt-1">
          {[1, 2, 3].map((i) => <FeedCardSkeleton key={i} />)}
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────── */}
      {isError && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center py-20">
          <p className="text-3xl">😕</p>
          <p className="font-semibold text-primary">Feed couldn't load</p>
          <p className="text-sm text-muted">Check your connection and try again.</p>
        </div>
      )}

      {/* ── Empty ───────────────────────────────────────────────────── */}
      {!isLoading && !isError && (!items || items.length === 0) && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center py-20">
          <p className="text-4xl">🍽️</p>
          <div>
            <p className="text-base font-bold text-primary mb-1">Your feed is quiet</p>
            <p className="text-sm text-muted">Add friends or log your first meal to get started.</p>
          </div>
          <div className="flex gap-2 w-full max-w-xs">
            <button onClick={() => navigate('/home/friends')} className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-background">
              Add friends
            </button>
            <button onClick={() => navigate('/home/log')} className="flex-1 rounded-full bg-surface border border-border/50 py-2.5 text-sm font-semibold text-primary">
              Log a meal
            </button>
          </div>
        </div>
      )}

      {/* ── Posts ───────────────────────────────────────────────────── */}
      {!isLoading && !isError && items && items.length > 0 && (
        <div className="flex flex-col divide-y divide-border/40">
          {items.map((item, i) => (
            <PostCard
              key={item.log.id}
              item={item}
              index={i}
              viewerId={session?.user.id}
              optimisticLiked={optimisticLikes[item.log.id]}
              likeAnimating={likeAnimating[item.log.id] ?? false}
              onLike={handleLike}
            />
          ))}
          <div className="h-4" />
        </div>
      )}
    </div>
  )
}
