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

export default function MealDetail() {
  const { logId } = useParams<{ logId: string }>()
  const navigate = useNavigate()
  const { session } = useSession()
  const { data, isLoading, isError } = useMealDetail(logId)
  const toggleLike = useToggleLike()
  const addComment = useAddComment()
  const deleteComment = useDeleteComment()

  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null)
  const [commentBody, setCommentBody] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  useEffect(() => {
    setOptimisticLiked(null)
  }, [data?.likedByViewer])

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted">Something went wrong loading this meal.</p>
        <button
          onClick={() => navigate(-1)}
          className="rounded-full bg-primary px-6 py-3 text-base font-semibold text-background"
        >
          Go back
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted">Couldn't find that meal.</p>
        <button
          onClick={() => navigate(-1)}
          className="rounded-full bg-primary px-6 py-3 text-base font-semibold text-background"
        >
          Go back
        </button>
      </div>
    )
  }

  const { log, author, photoSignedUrl, likeCount, likedByViewer, comments } = data
  const viewerId = session?.user.id
  const displayLiked = optimisticLiked ?? likedByViewer
  const displayLikeCount = likeCount + computeLikeDelta(optimisticLiked, likedByViewer)

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
    <div className="flex min-h-[calc(100vh-5rem)] flex-col px-6 py-8">
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-card)] text-primary"
      >
        ←
      </button>

      {photoSignedUrl && (
        <img src={photoSignedUrl} alt="" className="mb-4 aspect-square w-full rounded-2xl object-cover" />
      )}

      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => navigate(`/home/friend/${author.username}`)}
          className="flex items-center gap-2"
        >
          {author.photo_url ? (
            <img src={author.photo_url} alt={author.name} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-xs text-muted">
              {author.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-semibold text-primary">@{author.username}</span>
        </button>
        <span className="ml-auto text-xs text-muted">
          {new Date(log.created_at).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      </div>

      {log.name && <h1 className="mb-1 text-lg font-bold text-primary">{log.name}</h1>}
      {(log as { caption?: string | null }).caption && (
        <p className="mb-2 text-sm text-muted">{(log as { caption?: string | null }).caption}</p>
      )}
      <p className="mb-4 text-sm capitalize text-muted">{log.meal_type}</p>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="card p-3 text-center">
          <p className="text-xs text-muted">Calories</p>
          <p className="text-base font-bold text-primary">{log.calories_final ?? '—'}</p>
          <p className="text-xs text-muted">estimate: {log.calories_estimate ?? '—'}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-muted">Protein / Carbs / Fat</p>
          <p className="text-base font-bold text-primary">
            {log.protein_final_g ?? '—'}g / {log.carbs_final_g ?? '—'}g / {log.fat_final_g ?? '—'}g
          </p>
        </div>
      </div>

      <button
        onClick={handleToggleLike}
        className="mb-6 flex items-center gap-2 self-start rounded-full bg-surface shadow-[var(--shadow-card)] px-4 py-2 text-sm font-semibold text-primary"
      >
        <span>{displayLiked ? '🔥' : '🤍'}</span>
        <span>{displayLikeCount}</span>
      </button>

      <h2 className="mb-3 text-sm font-semibold text-muted">COMMENTS</h2>
      <ul className="mb-4 flex flex-col gap-4">
        {comments.length === 0 && <p className="text-sm text-muted">No comments yet.</p>}
        {comments.map((comment: CommentThread) => (
          <li key={comment.id} className="flex flex-col gap-2">
            <CommentRow
              comment={comment}
              canDelete={viewerId === comment.user_id || viewerId === log.user_id}
              onReply={() => setReplyingTo(comment.id)}
              onDelete={() => deleteComment.mutate(comment.id)}
            />
            {comment.replies.length > 0 && (
              <ul className="ml-8 flex flex-col gap-2 border-l border-border pl-3">
                {comment.replies.map((reply) => (
                  <li key={reply.id}>
                    <CommentRow
                      comment={reply}
                      canDelete={viewerId === reply.user_id || viewerId === log.user_id}
                      onDelete={() => deleteComment.mutate(reply.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {replyingTo && (
        <div className="mb-2 flex items-center justify-between rounded-full bg-background px-4 py-2 text-xs text-muted">
          <span>Replying to a comment</span>
          <button onClick={() => setReplyingTo(null)} className="font-semibold text-primary">
            Cancel
          </button>
        </div>
      )}

      <div className="mt-auto flex gap-2">
        <input
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          placeholder="Add a comment…"
          className="flex-1 rounded-full bg-surface border border-border/60 px-5 py-3 text-base text-primary placeholder:text-muted"
        />
        <button
          onClick={handleAddComment}
          disabled={!commentBody.trim() || addComment.isPending}
          className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-background disabled:opacity-50"
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
  return (
    <div className="flex items-start gap-2">
      <button
        onClick={() => navigate(`/home/friend/${comment.author.username}`)}
        className="shrink-0 border-0"
        aria-label={`View ${comment.author.username}'s profile`}
      >
        {comment.author.photo_url ? (
          <img src={comment.author.photo_url} alt={comment.author.name} className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface border border-border/40 text-xs font-bold text-muted">
            {comment.author.name.charAt(0).toUpperCase()}
          </div>
        )}
      </button>
      <div className="flex-1">
        <p className="text-sm">
          <button
            onClick={() => navigate(`/home/friend/${comment.author.username}`)}
            className="font-semibold text-primary border-0 mr-1"
          >
            @{comment.author.username}
          </button>
          <span className="text-primary">{comment.body}</span>
        </p>
        <div className="flex gap-3 text-xs text-muted">
          {onReply && (
            <button onClick={onReply} className="font-semibold border-0">
              Reply
            </button>
          )}
          {canDelete && (
            <button onClick={onDelete} className="font-semibold text-error border-0">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}