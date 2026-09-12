import { useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { useFriendProfile } from '../../hooks/useFriendProfile'
import { useSession } from '../../hooks/useSession'
import { getEffectiveStreak } from '../../lib/streak'
import { computeAverageCalories, computeWeeklyLoggedDays } from '../../lib/friendStats'
import { buildLogDateSet } from '../../lib/profileStats'
import { useToggleLike } from '../../hooks/useMealDetail'
import { StreakCalendar } from '../../components/StreakCalendar'
import { PostCard } from '../../components/PostCard'
import { Skeleton, FeedCardSkeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import type { FeedItem } from '../../hooks/useFeed'

export default function FriendProfile() {
  const { username }   = useParams<{ username: string }>()
  const navigate       = useNavigate()
  const { session }    = useSession()
  const { toast }      = useToast()
  const { data, isLoading, isError } = useFriendProfile(username)
  const toggleLike     = useToggleLike()

  const [optimisticLikes, setOptimisticLikes] = useState<Record<string, boolean>>({})
  const [likeAnimating,   setLikeAnimating]   = useState<Record<string, boolean>>({})

  function handleLike(logId: string, ownerId: string, currentlyLiked: boolean) {
    const next = !currentlyLiked
    setOptimisticLikes((p) => ({ ...p, [logId]: next }))
    if (next) {
      setLikeAnimating((p) => ({ ...p, [logId]: true }))
      setTimeout(() => setLikeAnimating((p) => ({ ...p, [logId]: false })), 350)
    }
    toggleLike.mutate(
      { logId, logOwnerId: ownerId, currentlyLiked },
      { onError: () => { setOptimisticLikes((p) => ({ ...p, [logId]: currentlyLiked })); toast('Could not like — try again', 'error') } },
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col animate-fade-in">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/40">
          <Skeleton circle className="h-9 w-9" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="px-5 py-6">
          <div className="flex items-center gap-5 mb-5">
            <Skeleton circle className="h-20 w-20" />
            <div className="flex flex-col gap-2 flex-1">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <Skeleton className="h-32 rounded-2xl mb-4" />
          <div className="flex flex-col gap-0 mt-4">
            {[1, 2].map((i) => <FeedCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-3xl">😕</p>
        <p className="font-semibold text-primary">{isError ? 'Something went wrong' : 'Profile not found'}</p>
        <button onClick={() => navigate(-1)} className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-background">
          Go back
        </button>
      </div>
    )
  }

  const { user, logs } = data
  const effectiveStreak = getEffectiveStreak(user.streak_count, user.streak_last_log_date, new Date())
  const avgCalories     = computeAverageCalories(logs)
  const weeklyDays      = computeWeeklyLoggedDays(logs)
  const logDates        = buildLogDateSet(logs)

  // Map FriendProfileLog → FeedItem shape for PostCard
  const feedItems: FeedItem[] = logs.map((log) => ({
    log,
    author: {
      id:                  user.id,
      name:                user.name,
      username:            user.username,
      photo_url:           user.photo_url,
      streak_count:        user.streak_count,
      streak_last_log_date: user.streak_last_log_date,
    },
    photoSignedUrl: log.photoSignedUrl,
    likeCount:      log.likeCount,
    likedByViewer:  log.likedByViewer,
    commentCount:   log.commentCount,
  }))

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col animate-fade-in">

      {/* ── Sticky header ────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-5 py-3.5 backdrop-blur-sm border-b border-border/40">
        <button onClick={() => navigate(-1)} aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-card)] text-primary">
          ←
        </button>
        <p className="text-base font-bold text-primary">@{user.username}</p>
        {effectiveStreak > 0 && (
          <span className="ml-auto text-sm font-semibold text-muted">🔥 {effectiveStreak}</span>
        )}
      </div>

      {/* ── Identity row ─────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-5">
          <div className="shrink-0">
            {user.photo_url ? (
              <img src={user.photo_url} alt={user.name} className="h-20 w-20 rounded-full object-cover border border-border/40" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface border border-border/40 text-2xl font-bold text-muted">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="mb-2 text-base font-bold text-primary">{user.name}</p>
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-base font-bold text-primary leading-none">{logs.length}</p>
                <p className="text-xs text-muted mt-0.5">Posts</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-primary leading-none">{effectiveStreak}</p>
                <p className="text-xs text-muted mt-0.5">Streak</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-primary leading-none">{avgCalories ?? '—'}</p>
                <p className="text-xs text-muted mt-0.5">avg kcal</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Consistency stats ─────────────────────────────────────── */}
      <div className="mx-5 mb-4 grid grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-primary">🔥 {effectiveStreak}</p>
          <p className="text-[11px] text-muted">streak</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-primary">{weeklyDays}</p>
          <p className="text-[11px] text-muted">days / 2wks</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-primary">{avgCalories ?? '—'}</p>
          <p className="text-[11px] text-muted">avg kcal</p>
        </div>
      </div>

      {/* ── Consistency calendar ─────────────────────────────────── */}
      <div className="mx-5 mb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Consistency</p>
        <StreakCalendar logDates={logDates} days={14} />
      </div>

      {/* ── Posts feed ───────────────────────────────────────────── */}
      <div>
        <p className="px-5 text-xs font-semibold uppercase tracking-wide text-muted pb-3 border-b border-border/40">
          Posts · {logs.length}
        </p>
        {logs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-3xl">🍽️</p>
            <p className="text-sm text-muted">No public posts yet.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {feedItems.map((item, i) => (
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
        )}
      </div>
    </div>
  )
}
