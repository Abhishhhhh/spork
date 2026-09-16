import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { useSession } from '../../hooks/useSession'
import { useTodayStats } from '../../hooks/useTodayStats'
import { useMyLogs, useLogsForDay, useUpdateProfile } from '../../hooks/useProfile'
import { useMyPosts } from '../../hooks/useMyPosts'
import { useFriendships } from '../../hooks/useFriendships'
import { useStreakData } from '../../hooks/useStreakData'
import { useToggleLike } from '../../hooks/useMealDetail'
import { CalorieRing } from '../../components/CalorieRing'
import { StreakCalendar } from '../../components/StreakCalendar'
import { PostCard } from '../../components/PostCard'
import { ProfileHeaderSkeleton, Skeleton, FeedCardSkeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import {
  computeWeeklyAvgCalories,
  computeWeeklyLoggedDays,
  computeCalorieRingPct,
  buildLogDateSet,
} from '../../lib/profileStats'
import { useQueryClient } from '@tanstack/react-query'

export default function ProfileScreen() {
  const navigate       = useNavigate()
  const queryClient    = useQueryClient()
  const { session }    = useSession()
  const { data: user, isLoading } = useCurrentUser()
  const { data: stats }           = useTodayStats()
  const { data: recentLogs = [] } = useMyLogs(14)
  const { data: streakData }      = useStreakData()
  const { data: posts = [], isLoading: postsLoading } = useMyPosts()
  const { data: friendships }     = useFriendships()
  const updateProfile = useUpdateProfile()
  const toggleLike    = useToggleLike()
  const { toast }     = useToast()
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const { data: dayLogs = [] }        = useLogsForDay(selectedDay ?? '')
  const [editingName, setEditingName] = useState(false)
  const [nameVal,     setNameVal]     = useState('')

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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !session?.user.id) return
    setUploadingAvatar(true)
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `${session.user.id}/avatar.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('avatars').upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: updateErr } = await supabase
        .from('users').update({ photo_url: urlData.publicUrl }).eq('id', session.user.id)
      if (updateErr) throw updateErr

      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      toast('Photo updated ✓')
    } catch {
      toast('Could not update photo — try again', 'error')
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <ProfileHeaderSkeleton />
        <div className="mx-5 mt-2 flex flex-col gap-3">
          <Skeleton className="h-36 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }
  if (!user) return null

  const calorieGoal    = user.calorie_goal ?? 2000
  const proteinGoal    = (user as unknown as { protein_goal?: number }).protein_goal ?? 0
  const todayCal       = stats?.caloriesLogged ?? 0
  const todayProtein   = stats?.proteinLogged ?? 0
  const ringPct        = computeCalorieRingPct(todayCal, calorieGoal)
  const over           = todayCal > calorieGoal
  const weeklyAvg      = computeWeeklyAvgCalories(recentLogs)
  const weeklyDays     = computeWeeklyLoggedDays(recentLogs)
  const logDates       = streakData?.recentLogDates ?? buildLogDateSet(recentLogs)
  const effectiveStreak = streakData?.effectiveStreak ?? user.streak_count

  // Real following/followers counts from friendships
  const followingCount = friendships?.accepted.length ?? 0
  // Outgoing pending are people you follow who haven't accepted yet
  const followingTotal = followingCount + (friendships?.outgoing.length ?? 0)
  // Followers = people who follow you (accepted from their side = accepted on ours)
  const followersCount = followingCount // accepted is mutual — both sides accepted

  function saveField(fields: Parameters<typeof updateProfile.mutate>[0]) {
    updateProfile.mutate(fields, {
      onSuccess: () => toast('Saved ✓'),
      onError:   () => toast('Could not save — try again', 'error'),
    })
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col pb-8">

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-6 pb-3">
        <div className="flex items-center gap-2">
          <p className="text-lg font-bold text-primary">@{user.username}</p>
          {effectiveStreak > 0 && (
            <span className="text-sm font-semibold text-muted">🔥 {effectiveStreak}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/home/friends')} aria-label="Friends"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted border-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
          <button onClick={() => navigate('/home/notifications')} aria-label="Notifications"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted border-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
          <button onClick={() => navigate('/home/settings')} aria-label="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted border-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Identity row ─────────────────────────────────────────── */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-5">

          {/* Avatar — hidden input label, camera badge overlay */}
          <div className="relative shrink-0">
            <label
              htmlFor="avatar-upload"
              className="block cursor-pointer"
              aria-label="Change profile photo"
            >
              {user.photo_url ? (
                <img src={user.photo_url} alt={user.name}
                  className="h-20 w-20 rounded-full object-cover border border-border/40" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface border border-border/40 text-2xl font-bold text-muted">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </label>
            {/* Camera badge */}
            <label
              htmlFor="avatar-upload"
              className="absolute bottom-0 right-0 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-primary border-2 border-background"
            >
              {uploadingAvatar ? (
                <svg className="h-3 w-3 animate-spin text-background" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                </svg>
              ) : (
                <svg className="h-3 w-3 text-background" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="flex-1 min-w-0">
            {/* Editable name — border-0 removes the global button border */}
            {editingName ? (
              <div className="flex items-center gap-2 mb-2">
                <input value={nameVal} onChange={(e) => setNameVal(e.target.value)} autoFocus
                  className="rounded-full bg-surface border border-border/60 px-3 py-1 text-sm font-bold text-primary w-32 placeholder:text-muted" />
                <button onClick={() => { saveField({ name: nameVal }); setEditingName(false) }}
                  className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-background">Save</button>
                <button onClick={() => setEditingName(false)} className="text-xs text-muted border-0">✕</button>
              </div>
            ) : (
              <button
                onClick={() => { setNameVal(user.name); setEditingName(true) }}
                className="mb-2 text-base font-bold text-primary text-left border-0"
              >
                {user.name}
              </button>
            )}

            {/* Stats row — no borders on these buttons */}
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-base font-bold text-primary leading-none">{posts.length}</p>
                <p className="text-xs text-muted mt-0.5">Posts</p>
              </div>
              <button onClick={() => navigate('/home/friends')} className="text-center border-0">
                <p className="text-base font-bold text-primary leading-none">{followingTotal}</p>
                <p className="text-xs text-muted mt-0.5">Following</p>
              </button>
              <button onClick={() => navigate('/home/friends')} className="text-center border-0">
                <p className="text-base font-bold text-primary leading-none">{followersCount}</p>
                <p className="text-xs text-muted mt-0.5">Followers</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Today's ring ─────────────────────────────────────────── */}
      <div className="mx-5 mb-5 card p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted">Today</p>
        <div className="flex items-center gap-5">
          <CalorieRing pct={ringPct} size={110} label={todayCal.toLocaleString()} sublabel="kcal" over={over} />
          <div className="flex flex-1 flex-col gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted">Calories</p>
                <p className={`text-xs font-semibold ${over ? 'text-error' : 'text-primary'}`}>
                  {over ? `${(todayCal - calorieGoal).toLocaleString()} over` : `${(calorieGoal - todayCal).toLocaleString()} left`}
                </p>
              </div>
              <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                <div className={`h-1.5 rounded-full ${over ? 'bg-error' : 'bg-primary'}`} style={{ width: `${Math.min(ringPct * 100, 100)}%` }} />
              </div>
            </div>
            {proteinGoal > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted">Protein</p>
                  <p className="text-xs font-semibold text-primary">{todayProtein}g / {proteinGoal}g</p>
                </div>
                <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                  <div className="h-1.5 rounded-full macro-protein" style={{ width: `${Math.min((todayProtein / proteinGoal) * 100, 100)}%` }} />
                </div>
              </div>
            )}
            <p className="text-xs text-muted">{stats?.logCount ?? 0} meal{(stats?.logCount ?? 0) !== 1 ? 's' : ''} logged</p>
          </div>
        </div>
      </div>

      {/* ── Weekly stats ──────────────────────────────────────────── */}
      <div className="mx-5 mb-5 grid grid-cols-2 gap-3">
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-primary">{weeklyDays}<span className="text-sm font-normal text-muted">/14</span></p>
          <p className="text-xs text-muted">days logged</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-primary">{weeklyAvg !== null ? weeklyAvg.toLocaleString() : '—'}</p>
          <p className="text-xs text-muted">avg kcal/day</p>
        </div>
      </div>

      {/* ── Consistency calendar ─────────────────────────────────── */}
      <div className="mx-5 mb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Last 14 days — tap a day</p>
        <StreakCalendar logDates={logDates} days={14} onDayTap={(d) => setSelectedDay(selectedDay === d ? null : d)} />
        {selectedDay && (
          <div className="mt-3 card p-3">
            <p className="text-xs font-semibold text-muted mb-2">
              {new Date(selectedDay + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            {dayLogs.length === 0
              ? <p className="text-sm text-muted">Nothing logged this day.</p>
              : dayLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-primary">{log.name || log.meal_type}</p>
                    <p className="text-xs text-muted capitalize">{log.meal_type}</p>
                  </div>
                  <p className="text-sm font-bold text-primary">{(log.calories_final ?? log.calories_estimate ?? '—')} kcal</p>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* ── My posts ─────────────────────────────────────────────── */}
      <div className="mx-0">
        <p className="mb-0 px-5 text-xs font-semibold uppercase tracking-wide text-muted pb-3 border-b border-border/40">
          Posts · {posts.length}
        </p>
        {postsLoading ? (
          <div className="flex flex-col gap-0 mt-0">
            {[1, 2].map((i) => <FeedCardSkeleton key={i} />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-3xl">🍽️</p>
            <p className="text-sm font-semibold text-primary">No meals logged yet</p>
            <button onClick={() => navigate('/home/log')}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-background">
              Log your first meal
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            {posts.map((item, i) => (
              <PostCard
                key={item.log.id}
                item={item}
                index={i}
                viewerId={item.author.id}
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
