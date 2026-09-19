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
import { TopBar } from '../../components/TopBar'
import { Avatar } from '../../components/Avatar'
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
      <div className="animate-fade-in">
        <TopBar title={`@${username ?? ''}`} />
        <div className="flex items-center gap-4">
          <Skeleton className="h-[72px] w-[72px] !rounded-[26px]" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="mt-4 h-24 !rounded-[27px]" />
        <FeedCardSkeleton />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div>
        <TopBar title="Profile" />
        <div className="card text-center" style={{ padding: 40 }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>◌</div>
          <h4 style={{ marginTop: 12 }}>{isError ? 'Something went wrong' : 'Profile not found'}</h4>
          <button type="button" onClick={() => navigate(-1)} className="btn">Go back</button>
        </div>
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
    <div className="animate-fade-in">
      <TopBar title={`@${user.username}`} back="/home/friends" />

      {/* ── Identity row ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3.5">
        <Avatar name={user.name} photoUrl={user.photo_url} size="big" />
        <span className="min-w-0">
          <h3 className="truncate">{user.name}</h3>
          <p className="muted small">@{user.username}</p>
          <p className="small">{logs.length} post{logs.length === 1 ? '' : 's'} · {effectiveStreak} day streak</p>
        </span>
      </div>
      <div style={{ height: 15 }} />

      {/* ── Streak card ──────────────────────────────────────────── */}
      <div className="card tint">
        <div className="flex items-center justify-between">
          <span>
            <span className="caps">Streak</span>
            <h3>{effectiveStreak} day{effectiveStreak === 1 ? '' : 's'}</h3>
          </span>
          <span style={{ fontSize: 40, lineHeight: 1 }}>✳</span>
        </div>
      </div>

      {/* ── Consistency ──────────────────────────────────────────── */}
      <div className="tile-grid">
        <div className="tile compact">
          <span className="icon">▦</span>
          <span><b>{weeklyDays}/14</b><small className="block">days logged</small></span>
        </div>
        <div className="tile compact">
          <span className="icon">◌</span>
          <span><b>{avgCalories != null ? avgCalories.toLocaleString() : '—'}</b><small className="block">avg kcal/day</small></span>
        </div>
      </div>

      <div className="section">
        <span className="caps">Last 14 days</span>
        <StreakCalendar logDates={logDates} days={14} />
      </div>

      {/* ── Posts feed ───────────────────────────────────────────── */}
      <div className="section">
        <span className="caps">Recent meals · {logs.length}</span>
        {logs.length === 0 ? (
          <div className="card tint text-center" style={{ margin: 0 }}>
            <div style={{ fontSize: 34, lineHeight: 1 }}>✳</div>
            <p className="small muted" style={{ marginTop: 8 }}>No public posts yet</p>
          </div>
        ) : (
          feedItems.map((item, i) => (
            <PostCard
              key={item.log.id}
              item={item}
              index={i}
              viewerId={session?.user.id}
              optimisticLiked={optimisticLikes[item.log.id]}
              likeAnimating={likeAnimating[item.log.id] ?? false}
              onLike={handleLike}
            />
          ))
        )}
      </div>
    </div>
  )
}
