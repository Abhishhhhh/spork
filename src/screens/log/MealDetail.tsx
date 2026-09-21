import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../../hooks/useSession'
import {
  useAddComment,
  useDeleteComment,
  useMealDetail,
  useToggleLike,
  type CommentThread,
  type CommentWithAuthor,
} from '../../hooks/useMealDetail'
import { computeLikeDelta } from '../../lib/likeDelta'
import { likedByLabel } from '../../lib/likedBy'
import { useFriendUsernames } from '../../hooks/useFriendUsernames'
import { relativeTime } from '../../lib/relativeTime'
import { TopBar } from '../../components/TopBar'
import { Avatar } from '../../components/Avatar'
import { PhotoViewer } from '../../components/PhotoViewer'

export default function MealDetail() {
  const { logId } = useParams<{ logId: string }>()
  const navigate = useNavigate()
  const { session } = useSession()
  const { data, isLoading, isError } = useMealDetail(logId)
  const toggleLike = useToggleLike()
  const addComment = useAddComment()
  const deleteComment = useDeleteComment()
  const friendUsernameById = useFriendUsernames()

  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null)
  const [commentBody, setCommentBody] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ src: string; alt: string } | null>(null)

  useEffect(() => {
    setOptimisticLiked(null)
  }, [data?.likedByViewer])

  if (isLoading) {
    return (
      <div>
        <TopBar title="Meal detail" />
        <p className="muted text-center" style={{ padding: 60 }}>Loading…</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div>
        <TopBar title="Meal detail" />
        <div className="card text-center" style={{ padding: 40 }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>◌</div>
          <h4 style={{ marginTop: 12 }}>{isError ? 'Something went wrong loading this meal' : 'Couldn’t find that meal'}</h4>
          <button type="button" onClick={() => navigate(-1)} className="btn">Go back</button>
        </div>
      </div>
    )
  }

  const { log, author, photoSignedUrl, likeCount, likedByViewer, likerIds, comments } = data
  const viewerId = session?.user.id
  const displayLiked = optimisticLiked ?? likedByViewer
  const displayLikeCount = likeCount + computeLikeDelta(optimisticLiked, likedByViewer)
  const likedBy = likedByLabel({ likerIds, total: displayLikeCount, viewerId, viewerLiked: displayLiked, friendUsernameById })
  const caption  = (log as { caption?: string | null }).caption
  const calories = log.calories_final ?? log.calories_estimate
  const proteinG = log.protein_final_g ?? log.protein_estimate_g
  const carbsG   = log.carbs_final_g ?? log.carbs_estimate_g
  const fatG     = log.fat_final_g ?? log.fat_estimate_g
  const mealTypeLabel = log.meal_type.charAt(0).toUpperCase() + log.meal_type.slice(1)

  function handleToggleLike() {
    const next = !displayLiked
    setOptimisticLiked(next)
    toggleLike.mutate(
      { logId: log.id, logOwnerId: log.user_id, currentlyLiked: displayLiked },
      { onError: () => setOptimisticLiked(!next) },
    )
  }

  function handleAddComment() {
    const body = commentBody.trim()
    if (!body) return
    addComment.mutate(
      { logId: log.id, logOwnerId: log.user_id, body, parentCommentId: replyingTo },
      {
        onSuccess: () => {
          setCommentBody('')
          setReplyingTo(null)
        },
      },
    )
  }

  return (
    <div>
      <TopBar title="Meal detail" right={viewerId === author.id ? (
        <button type="button" onClick={() => navigate(`/home/log/${log.id}/edit`)} className="pill" aria-label="Edit post">Edit</button>
      ) : undefined} />

      {/* Author row */}
      <div className="flex w-full items-center gap-2.5 text-left">
        <button type="button" className="no-press" aria-label={author.photo_url ? 'View profile photo' : 'View profile'}
          onClick={() => author.photo_url ? setViewer({ src: author.photo_url, alt: author.name }) : navigate(viewerId === author.id ? '/home/profile' : `/home/friend/${author.username}`)}>
          <Avatar name={author.name} photoUrl={author.photo_url} />
        </button>
        <button type="button" onClick={() => navigate(viewerId === author.id ? '/home/profile' : `/home/friend/${author.username}`)} className="no-press min-w-0 flex-1 text-left">
          <b className="block font-semibold">@{author.username}</b>
          <small className="muted block">{mealTypeLabel} · {relativeTime(log.created_at)}</small>
        </button>
      </div>
      <div style={{ height: 15 }} />

      {photoSignedUrl && (
        <img src={photoSignedUrl} alt={log.name ?? 'Meal photo'} className="photo natural" style={{ cursor: 'zoom-in' }}
          onClick={() => setViewer({ src: photoSignedUrl, alt: log.name ?? 'Meal photo' })} />
      )}
      {viewer && <PhotoViewer src={viewer.src} alt={viewer.alt} onClose={() => setViewer(null)} />}

      <h3 style={{ marginTop: 17 }}>{log.name || mealTypeLabel}</h3>
      {caption && <p className="small muted">{caption}</p>}

      <div className="card tint">
        <div className="flex items-center justify-between gap-2">
          <b className="font-semibold">{calories != null ? `${Number(calories).toLocaleString()} kcal` : '— kcal'}</b>
          <span className="protein-total">{proteinG ?? '—'}g protein</span>
          <span>{carbsG ?? '—'}g carbs</span>
          <span>{fatG ?? '—'}g fat</span>
        </div>
        {log.calories_final != null && log.calories_estimate != null && log.calories_final !== log.calories_estimate && (
          <p className="tiny muted" style={{ marginTop: 8 }}>AI estimate was {log.calories_estimate.toLocaleString()} kcal</p>
        )}
      </div>

      <div className="flex items-center gap-4" style={{ margin: '17px 0' }}>
        <button type="button" onClick={handleToggleLike} className={`flex items-center gap-1.5 ${displayLiked ? 'liked font-semibold' : ''}`}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>{displayLiked ? '♥' : '♡'}</span>
          {likedBy ?? 'Like'}
        </button>
        <span className="flex items-center gap-1.5">
          <span style={{ fontSize: 16, lineHeight: 1 }}>◌</span>
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </span>
      </div>

      <div className="divider" />

      <h4>Comments</h4>
      {comments.length === 0 && <p className="small muted" style={{ marginTop: 8 }}>No comments yet</p>}
      {comments.map((comment: CommentThread) => (
        <div key={comment.id}>
          <CommentRow
            comment={comment}
            canDelete={viewerId === comment.user_id || viewerId === log.user_id}
            onReply={() => setReplyingTo(comment.id)}
            onDelete={() => deleteComment.mutate(comment.id)}
          />
          {comment.replies.length > 0 && (
            <div className="border-l border-line" style={{ marginLeft: 19, paddingLeft: 12 }}>
              {comment.replies.map((reply) => (
                <CommentRow
                  key={reply.id}
                  comment={reply}
                  canDelete={viewerId === reply.user_id || viewerId === log.user_id}
                  onDelete={() => deleteComment.mutate(reply.id)}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {replyingTo && (
        <div className="pill tint flex w-full justify-between" style={{ marginTop: 12 }}>
          <span>Replying to a comment</span>
          <button type="button" onClick={() => setReplyingTo(null)} className="font-semibold">Cancel</button>
        </div>
      )}

      <div className="flex items-center gap-2" style={{ marginTop: 12 }}>
        <input
          className="input flex-1"
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
          placeholder="Add a comment"
        />
        <button
          type="button"
          onClick={handleAddComment}
          disabled={!commentBody.trim() || addComment.isPending}
          className="pill sel"
          style={{ padding: '12px 16px' }}
        >
          Post
        </button>
      </div>
    </div>
  )
}

function CommentRow({
  comment,
  canDelete,
  onReply,
  onDelete,
}: {
  comment: CommentWithAuthor
  canDelete: boolean
  onReply?: () => void
  onDelete: () => void
}) {
  const navigate = useNavigate()
  const goToAuthor = () => navigate(`/home/friend/${comment.author.username}`)
  return (
    <div className="meal-row">
      <button type="button" onClick={goToAuthor} aria-label={`View ${comment.author.username}'s profile`} className="no-press">
        <Avatar name={comment.author.name} photoUrl={comment.author.photo_url} />
      </button>
      <span className="min-w-0 flex-1">
        <button type="button" onClick={goToAuthor} className="font-semibold">@{comment.author.username}</button>
        <p className="small">{comment.body}</p>
        <span className="flex gap-3">
          {onReply && <button type="button" onClick={onReply} className="muted tiny">Reply</button>}
          {canDelete && <button type="button" onClick={onDelete} className="tiny text-error">Delete</button>}
        </span>
      </span>
    </div>
  )
}
