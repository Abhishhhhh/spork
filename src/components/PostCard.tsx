import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { relativeTime } from '../lib/relativeTime'
import { computeLikeDelta } from '../lib/likeDelta'
import { likedByLabel } from '../lib/likedBy'
import { useFriendUsernames } from '../hooks/useFriendUsernames'
import { getEffectiveStreak } from '../lib/streak'
import { ShareModal } from './ShareModal'
import { FeedImage } from './FeedImage'
import { PhotoViewer } from './PhotoViewer'
import { Avatar } from './Avatar'
import { useToast } from './Toast'
import { hapticLight } from '../lib/haptics'
import type { FeedItem } from '../hooks/useFeed'

interface PostCardProps {
  item: FeedItem
  index?: number
  viewerId?: string
  optimisticLiked?: boolean
  likeAnimating?: boolean
  onLike: (logId: string, logOwnerId: string, currentlyLiked: boolean) => void
}

/** ── Delete post mutation ─────────────────────────────────────────────────── */
function useDeletePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase.from('logs').delete().eq('id', logId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['myPosts'] })
      queryClient.invalidateQueries({ queryKey: ['todayStats'] })
    },
  })
}

/** ── Edit post mutation ───────────────────────────────────────────────────── */
function useEditPost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ logId, name, caption }: { logId: string; name: string; caption: string }) => {
      // Try with caption first; if the column doesn't exist yet (0006 migration
      // not applied), fall back to name-only so editing still works.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const full = await supabase.from('logs').update({ name, caption } as any).eq('id', logId)
      if (full.error?.code === '42703') {
        // 42703 = undefined_column — caption column not yet in DB, update name only
        const { error } = await supabase.from('logs').update({ name }).eq('id', logId)
        if (error) throw error
      } else if (full.error) {
        throw full.error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['myPosts'] })
      queryClient.invalidateQueries({ queryKey: ['mealDetail'] })
    },
  })
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

export function PostCard({ item, index = 0, viewerId, optimisticLiked, likeAnimating = false, onLike }: PostCardProps) {
  const navigate     = useNavigate()
  const { toast }    = useToast()
  const deletePost   = useDeletePost()
  const editPost     = useEditPost()
  const { log, author, photoSignedUrl, likeCount, likedByViewer, likerIds, commentCount } = item
  const friendUsernameById = useFriendUsernames()

  const [showShare,   setShowShare]   = useState(false)
  const [showPhoto,   setShowPhoto]   = useState(false)
  const [showMenu,    setShowMenu]    = useState(false)
  const [editing,     setEditing]     = useState(false)
  const [editName,    setEditName]    = useState('')
  const [editCaption, setEditCaption] = useState('')

  const displayLiked     = optimisticLiked ?? likedByViewer
  const displayLikeCount = likeCount + computeLikeDelta(optimisticLiked, likedByViewer)
  const likedBy          = likedByLabel({ likerIds, total: displayLikeCount, viewerId, viewerLiked: displayLiked, friendUsernameById })
  const isOwnPost        = viewerId === log.user_id
  const caption          = (log as { caption?: string | null }).caption
  const calories         = log.calories_final ?? log.calories_estimate
  const proteinG         = log.protein_final_g ?? log.protein_estimate_g
  const effectiveStreak  = getEffectiveStreak(author.streak_count, author.streak_last_log_date, new Date())
  const detailPath       = `/home/log/${log.id}`

  function handleDelete() {
    setShowMenu(false)
    if (!window.confirm('Delete this meal post? This cannot be undone.')) return
    deletePost.mutate(log.id, {
      onSuccess: () => toast('Post deleted'),
      onError:   () => toast('Could not delete — try again', 'error'),
    })
  }

  function openEdit() {
    setShowMenu(false)
    setEditName(log.name ?? '')
    setEditCaption(caption ?? '')
    setEditing(true)
  }

  function handleSaveEdit() {
    editPost.mutate(
      { logId: log.id, name: editName.trim(), caption: editCaption.trim() },
      {
        onSuccess: () => { toast('Post updated ✓'); setEditing(false) },
        onError:   () => toast('Could not save — try again', 'error'),
      }
    )
  }

  function handleLikeWithHaptic() {
    hapticLight()
    onLike(log.id, log.user_id, displayLiked)
  }

  return (
    <>
      {showMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />}

      <article className="feed-card animate-slide-up" style={{ animationDelay: `${index * 30}ms` }}>

        {/* ── Author row ──────────────────────────────────── */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => isOwnPost ? navigate('/home/profile') : navigate(`/home/friend/${author.username}`)}
            className="no-press flex min-w-0 flex-1 items-center gap-2.5"
          >
            <Avatar name={author.name} photoUrl={author.photo_url} />
            <span className="min-w-0 flex-1">
              <b className="block truncate font-semibold">@{author.username}</b>
              <small className="muted block">{relativeTime(log.created_at)} · {capitalize(log.meal_type)}</small>
            </span>
          </button>

          {isOwnPost ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink"
                aria-label="Post options"
              >
                •••
              </button>
              {showMenu && (
                <div className="absolute right-0 top-9 z-50 w-40 overflow-hidden rounded-[19px] bg-paper shadow-[0_8px_30px_#00000020] animate-slide-down">
                  <button type="button" onClick={openEdit}
                    className="block w-full px-4 py-3 text-left text-[13px]">
                    Edit post
                  </button>
                  <button type="button" onClick={handleDelete}
                    className="block w-full border-t border-line px-4 py-3 text-left text-[13px] text-error">
                    Delete post
                  </button>
                </div>
              )}
            </div>
          ) : (
            effectiveStreak > 0 && <span className="pill tint">🔥 {effectiveStreak}</span>
          )}
        </div>

        {/* ── Photo ───────────────────────────────────────── */}
        {photoSignedUrl && (
          <FeedImage
            src={photoSignedUrl}
            alt={log.name ?? 'Meal photo'}
            className="photo"
            style={{ marginTop: 13 }}
            onClick={() => setShowPhoto(true)}
          />
        )}

        {/* ── Meal name + caption / inline edit form ──────── */}
        {editing ? (
          <div style={{ marginTop: 13 }}>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Meal name"
              maxLength={80}
              autoFocus
              className="input"
              style={{ marginBottom: 8 }}
            />
            <textarea
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              placeholder="Add a caption… (optional)"
              maxLength={300}
              rows={3}
              className="input"
              style={{ resize: 'none' }}
            />
            <div className="flex gap-2" style={{ marginTop: 10 }}>
              <button type="button" onClick={handleSaveEdit}
                disabled={editPost.isPending} className="btn flex-1">
                {editPost.isPending ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="btn light flex-1">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => navigate(detailPath)}
            className="no-press block w-full text-left" style={{ marginTop: 13 }}>
            <span className="flex items-start justify-between gap-3">
              <b className="font-semibold">{log.name || capitalize(log.meal_type)}</b>
              <span className="flex flex-none gap-1.5">
                {calories != null && <span className="pill tint">{Number(calories).toLocaleString()} kcal</span>}
                {proteinG != null && <span className="pill tint">{proteinG}g protein</span>}
              </span>
            </span>
            {caption && <p className="small muted" style={{ marginTop: 4 }}>{caption}</p>}
          </button>
        )}

        {/* ── Interaction row ─────────────────────────────── */}
        {!editing && (
          <div className="flex items-center gap-4" style={{ marginTop: 14 }}>
            <button type="button" onClick={handleLikeWithHaptic}
              className={`flex items-center gap-1.5 ${displayLiked ? 'liked font-semibold' : 'muted'}`}>
              <span className={likeAnimating ? 'animate-pop inline-block' : 'inline-block'}
                style={{ fontSize: 16, lineHeight: 1 }}>
                {displayLiked ? '♥' : '♡'}
              </span>
              {displayLiked ? 'Liked' : 'Like'}
            </button>
            <button type="button" onClick={() => navigate(detailPath)} className="muted flex items-center gap-1.5">
              <span style={{ fontSize: 16, lineHeight: 1 }}>◌</span>
              {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
            </button>
            <button type="button" onClick={() => setShowShare(true)} className="muted ml-auto flex items-center gap-1.5">
              <span style={{ fontSize: 16, lineHeight: 1 }}>↗</span> Share
            </button>
          </div>
        )}

        {!editing && likedBy && (
          <button type="button" onClick={() => navigate(detailPath)}
            className="no-press small muted block text-left" style={{ marginTop: 8 }}>
            {likedBy}
          </button>
        )}
      </article>

      {showPhoto && photoSignedUrl && (
        <PhotoViewer src={photoSignedUrl} alt={log.name ?? 'Meal photo'} onClose={() => setShowPhoto(false)} />
      )}

      {showShare && (
        <ShareModal
          photoUrl={photoSignedUrl}
          username={author.username}
          calories={calories}
          proteinG={proteinG}
          streak={effectiveStreak}
          mealName={log.name}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  )
}
