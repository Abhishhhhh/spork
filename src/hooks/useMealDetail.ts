import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'
import { groupComments, type CommentRow } from '../lib/commentTree'
import type { Database } from '../lib/database.types'

type LogRow = Database['public']['Tables']['logs']['Row']
type UserRow = Database['public']['Tables']['users']['Row']
type CommentAuthor = Pick<UserRow, 'id' | 'name' | 'username' | 'photo_url'>

export interface CommentWithAuthor extends CommentRow {
  author: CommentAuthor
}

export interface CommentThread extends CommentWithAuthor {
  replies: CommentWithAuthor[]
}

export interface MealDetailData {
  log: LogRow
  author: Pick<UserRow, 'id' | 'name' | 'username' | 'photo_url'>
  photoSignedUrl: string | null
  likeCount: number
  likerIds: string[]
  likedByViewer: boolean
  comments: CommentThread[]
}

/**
 * Four plain queries (log, author, likes, comments+their authors), no
 * embedded selects — same reasoning as every other hook in this
 * codebase. `log_likes`/`log_comments` RLS already restricts what a
 * plain select can return to what the viewer is allowed to see, so the
 * like count and comment list can never over-fetch a hidden log's data.
 */
export function useMealDetail(logId: string | undefined) {
  const { session, loading: sessionLoading } = useSession()
  const viewerId = session?.user.id

  const query = useQuery({
    queryKey: ['mealDetail', viewerId, logId],
    queryFn: async (): Promise<MealDetailData | null> => {
      const { data: log, error: logError } = await supabase.from('logs').select('*').eq('id', logId!).maybeSingle()
      if (logError) throw logError
      if (!log) return null

      const { data: author, error: authorError } = await supabase
        .from('users')
        .select('id, name, username, photo_url')
        .eq('id', log.user_id)
        .single()
      if (authorError) throw authorError

      let photoSignedUrl: string | null = null
      if (log.photo_url) {
        const { data: signedUrls } = await supabase.storage.from('meal-photos').createSignedUrls([log.photo_url], 3600)
        photoSignedUrl = signedUrls?.[0]?.signedUrl ?? null
      }

      const { data: likes, error: likesError } = await supabase
        .from('log_likes')
        .select('user_id')
        .eq('log_id', logId!)
      if (likesError) throw likesError
      const likeRows = likes ?? []
      const likeCount = likeRows.length
      const likedByViewer = likeRows.some((l) => l.user_id === viewerId)
      const likerIds = likeRows.map((l) => l.user_id)

      const { data: commentRows, error: commentsError } = await supabase
        .from('log_comments')
        .select('id, user_id, parent_comment_id, body, created_at')
        .eq('log_id', logId!)
        .order('created_at', { ascending: true })
      if (commentsError) throw commentsError

      const rows = commentRows ?? []
      const commenterIds = [...new Set(rows.map((c) => c.user_id))]
      const { data: commenters, error: commentersError } =
        commenterIds.length > 0
          ? await supabase.from('users').select('id, name, username, photo_url').in('id', commenterIds)
          : { data: [] as CommentAuthor[], error: null }
      if (commentersError) throw commentersError

      const commentersById = new Map((commenters ?? []).map((u) => [u.id, u]))
      const rowsWithAuthor = rows
        .map((row) => {
          const commentAuthor = commentersById.get(row.user_id)
          return commentAuthor ? { ...row, author: commentAuthor } : null
        })
        .filter((r): r is CommentWithAuthor => r !== null)

      const comments = groupComments(rowsWithAuthor)

      return { log, author, photoSignedUrl, likeCount, likerIds, likedByViewer, comments }
    },
    enabled: Boolean(logId) && Boolean(viewerId),
  })

  return {
    ...query,
    isLoading: sessionLoading || (Boolean(viewerId) && query.isLoading),
  }
}

/**
 * Toggles a like: deletes the row if already liked, otherwise inserts it
 * plus a notification row (skipped when liking your own post). Callers
 * pass `currentlyLiked` explicitly rather than this hook re-deriving it,
 * so a screen using optimistic local state (Task 5) controls exactly
 * which direction the toggle goes.
 */
export function useToggleLike() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { logId: string; logOwnerId: string; currentlyLiked: boolean }) => {
      if (!session) throw new Error('Not signed in')
      const userId = session.user.id

      if (input.currentlyLiked) {
        const { error } = await supabase.from('log_likes').delete().eq('log_id', input.logId).eq('user_id', userId)
        if (error) throw error
        return
      }

      const { error: likeError } = await supabase.from('log_likes').insert({ log_id: input.logId, user_id: userId })
      if (likeError) throw likeError

      if (input.logOwnerId !== userId) {
        const { error: notifError } = await supabase.from('notifications').insert({
          recipient_id: input.logOwnerId,
          actor_id: userId,
          log_id: input.logId,
          type: 'like',
        })
        // 23505 = unique_violation: a like notification for this
        // (actor, log) pair already exists from a prior like/unlike cycle
        // — the existing row still stands in for this one, nothing to do.
        if (notifError && notifError.code !== '23505') throw notifError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealDetail'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['friendProfile'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useAddComment() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      logId: string
      logOwnerId: string
      body: string
      parentCommentId: string | null
    }) => {
      if (!session) throw new Error('Not signed in')
      const userId = session.user.id

      const { data: insertedComment, error: commentError } = await supabase
        .from('log_comments')
        .insert({
          log_id: input.logId,
          user_id: userId,
          parent_comment_id: input.parentCommentId,
          body: input.body,
        })
        .select('id')
        .single()
      if (commentError) throw commentError

      if (input.logOwnerId !== userId) {
        const { error: notifError } = await supabase.from('notifications').insert({
          recipient_id: input.logOwnerId,
          actor_id: userId,
          log_id: input.logId,
          type: input.parentCommentId ? 'reply' : 'comment',
          comment_id: insertedComment.id,
        })
        if (notifError) throw notifError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealDetail'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['friendProfile'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useDeleteComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from('log_comments').delete().eq('id', commentId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealDetail'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['friendProfile'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
