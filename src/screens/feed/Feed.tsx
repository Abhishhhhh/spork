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
    <div>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="topbar">
        <span className="clay" style={{ fontSize: 30 }}>Home</span>
        <span className="flex items-center gap-2.5">
          <button type="button" onClick={() => navigate('/home/friends')} aria-label="Find friends" className="circle sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </button>
          <button type="button" onClick={() => navigate('/home/notifications')} aria-label="Notifications" className="circle sm relative">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-ink" />}
          </button>
        </span>
      </div>

      <div className="section">
        <div className="flex items-center justify-between">
          <h3>Friend feed</h3>
          <button type="button" onClick={() => navigate('/home/friends')} className="small muted">Find friends →</button>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {isLoading && [1, 2, 3].map((i) => <FeedCardSkeleton key={i} />)}

      {/* ── Error ───────────────────────────────────────────────────── */}
      {isError && (
        <div className="card text-center" style={{ padding: 40 }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>◌</div>
          <h4 style={{ marginTop: 12 }}>Feed couldn’t load</h4>
          <p className="small muted">Check your connection and try again</p>
        </div>
      )}

      {/* ── Empty ───────────────────────────────────────────────────── */}
      {!isLoading && !isError && (!items || items.length === 0) && (
        <div className="card text-center" style={{ padding: 40 }}>
          <div style={{ fontSize: 44, lineHeight: 1 }}>✳</div>
          <h4 style={{ marginTop: 12 }}>Your feed is quiet</h4>
          <p className="small muted">Add friends or log your first meal to get started</p>
          <div className="action-row" style={{ marginTop: 18 }}>
            <button type="button" onClick={() => navigate('/home/friends')} className="btn" style={{ marginTop: 0 }}>Add friends</button>
            <button type="button" onClick={() => navigate('/home/log')} className="btn light bg-soft" style={{ marginTop: 0 }}>Log a meal</button>
          </div>
        </div>
      )}

      {/* ── Posts ───────────────────────────────────────────────────── */}
      {!isLoading && !isError && items && items.length > 0 && items.map((item, i) => (
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
    </div>
  )
}
