import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { relativeTime } from '../lib/relativeTime'
import { computeLikeDelta } from '../lib/likeDelta'
import { getEffectiveStreak } from '../lib/streak'
import { ShareModal } from './ShareModal'
import { FeedImage } from './FeedImage'
import { useToast } from './Toast'
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

export function PostCard({ item, index = 0, viewerId, optimisticLiked, likeAnimating = false, onLike }: PostCardProps) {
  const navigate     = useNavigate()
  const { toast }    = useToast()
  const deletePost   = useDeletePost()
  const { log, author, photoSignedUrl, likeCount, likedByViewer, commentCount } = item

  const [showShare, setShowShare]   = useState(false)
  const [showMenu,  setShowMenu]    = useState(false)

  const displayLiked     = optimisticLiked ?? likedByViewer
  const displayLikeCount = likeCount + computeLikeDelta(optimisticLiked, likedByViewer)
  const isOwnPost        = viewerId === log.user_id
  const caption          = (log as { caption?: string | null }).caption
  const calories         = log.calories_final ?? log.calories_estimate
  const proteinG         = log.protein_final_g ?? log.protein_estimate_g
  const carbsG           = log.carbs_final_g   ?? log.carbs_estimate_g
  const fatG             = log.fat_final_g     ?? log.fat_estimate_g
  const effectiveStreak  = getEffectiveStreak(author.streak_count, author.streak_last_log_date, new Date())

  function handleDelete() {
    setShowMenu(false)
    if (!window.confirm('Delete this meal post? This cannot be undone.')) return
    deletePost.mutate(log.id, {
      onSuccess: () => toast('Post deleted'),
      onError:   () => toast('Could not delete — try again', 'error'),
    })
  }

  return (
    <>
      {/* Backdrop to close menu */}
      {showMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
      )}

      <article
        className="flex flex-col bg-background animate-slide-up border-b border-border/40 last:border-0"
        style={{ animationDelay: `${index * 30}ms` }}
      >
        {/* ── Author row ──────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <button
            onClick={() => isOwnPost ? navigate('/home/profile') : navigate(`/home/friend/${author.username}`)}
            className="no-press flex items-center gap-3 flex-1 min-w-0"
          >
            {author.photo_url ? (
              <img src={author.photo_url} alt={author.name} className="h-10 w-10 rounded-full object-cover shrink-0" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface border border-border/40 text-sm font-bold text-muted">
                {author.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-bold text-primary leading-tight">{author.username}</span>
              <span className="text-xs text-muted leading-tight">{relativeTime(log.created_at)}</span>
            </div>
          </button>

          {/* Streak badge + ⋯ menu for own posts */}
          <div className="flex items-center gap-2 shrink-0">
            {effectiveStreak > 0 && (
              <span className="text-xs font-semibold text-muted">🔥 {effectiveStreak}</span>
            )}
            {isOwnPost && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted border-0"
                  aria-label="Post options"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <circle cx="12" cy="5"  r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="12" cy="19" r="1.5" />
                  </svg>
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-9 z-50 w-36 rounded-2xl bg-surface shadow-[var(--shadow-modal)] border border-border/40 overflow-hidden animate-slide-down">
                    <button
                      onClick={() => { setShowMenu(false); navigate(`/home/log/${log.id}`) }}
                      className="flex w-full items-center gap-2 px-4 py-3 text-sm text-primary border-0 text-left hover:bg-background"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      Edit caption
                    </button>
                    <button
                      onClick={handleDelete}
                      className="flex w-full items-center gap-2 px-4 py-3 text-sm text-error border-0 text-left hover:bg-background border-t border-border/40"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
                      </svg>
                      Delete post
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Meal name + caption ─────────────────────────── */}
        <button onClick={() => navigate(`/home/log/${log.id}`)} className="no-press flex flex-col items-start gap-0.5 px-4 pb-2 text-left">
          {log.name && <p className="text-base font-bold text-primary leading-snug">{log.name}</p>}
          {caption && <p className="text-sm text-muted">{caption}</p>}
          {!log.name && !caption && <p className="text-sm text-muted capitalize">{log.meal_type}</p>}
        </button>

        {/* ── Stats row ───────────────────────────────────── */}
        <div className="flex items-center gap-6 px-4 pb-3">
          {calories != null && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted leading-none mb-0.5">Calories</p>
              <p className="text-sm font-bold text-primary">{Number(calories).toLocaleString()}</p>
            </div>
          )}
          {proteinG != null && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted leading-none mb-0.5">Protein</p>
              <p className="text-sm font-bold text-primary">{proteinG}g</p>
            </div>
          )}
          {carbsG != null && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted leading-none mb-0.5">Carbs</p>
              <p className="text-sm font-bold text-primary">{carbsG}g</p>
            </div>
          )}
          {fatG != null && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted leading-none mb-0.5">Fat</p>
              <p className="text-sm font-bold text-primary">{fatG}g</p>
            </div>
          )}
          {calories == null && proteinG == null && (
            <p className="text-xs text-muted capitalize">{log.meal_type}</p>
          )}
        </div>

        {/* ── Photo — FeedImage with skeleton + fade ───────── */}
        {photoSignedUrl && (
          <FeedImage
            src={photoSignedUrl}
            alt={log.name ?? 'Meal photo'}
            style={{ maxHeight: 340 }}
            onClick={() => navigate(`/home/log/${log.id}`)}
          />
        )}

        {/* ── Interaction bar ─────────────────────────────── */}
        <div className="flex items-center gap-5 px-4 pt-2.5 pb-2">
          {/* Like */}
          <button onClick={() => onLike(log.id, log.user_id, displayLiked)} className="flex items-center gap-1.5 text-sm">
            <svg viewBox="0 0 24 24" fill={displayLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              className={`h-5 w-5 ${displayLiked ? 'text-primary' : 'text-muted'} ${likeAnimating ? 'animate-pop' : ''}`}>
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
            <span className={`font-medium ${displayLiked ? 'text-primary' : 'text-muted'}`}>{displayLikeCount}</span>
          </button>

          {/* Comment */}
          <button onClick={() => navigate(`/home/log/${log.id}`)} className="flex items-center gap-1.5 text-sm text-muted">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="font-medium">{commentCount}</span>
          </button>

          {/* Share */}
          <button onClick={() => setShowShare(true)} className="ml-auto flex items-center justify-center text-muted border-0" aria-label="Share">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </button>
        </div>

        {/* ── Liked by ────────────────────────────────────── */}
        {displayLikeCount > 0 && (
          <div className="flex items-center gap-2 px-4 pb-3.5">
            <div className="flex -space-x-1.5">
              <div className="h-4 w-4 rounded-full bg-border border border-background" />
              {displayLikeCount > 1 && <div className="h-4 w-4 rounded-full bg-muted/40 border border-background" />}
            </div>
            <p className="text-xs text-muted">
              Liked by <span className="font-semibold text-primary">{displayLikeCount === 1 ? '1 person' : `${displayLikeCount} people`}</span>
            </p>
          </div>
        )}
      </article>

      {/* ── Share modal ── */}
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
