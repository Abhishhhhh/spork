import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'
import type { FeedItem } from './useFeed'

/** Own posts with signed photo URLs, like counts, and comment counts.
 *  Returns the same FeedItem shape as useFeed so PostCard works unchanged. */
export function useMyPosts(limit = 100) {
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id

  const query = useQuery({
    queryKey: ['myPosts', userId],
    staleTime: 30_000,
    queryFn: async (): Promise<FeedItem[]> => {
      const { data: logs, error } = await supabase
        .from('logs')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      if (!logs || logs.length === 0) return []

      const { data: author } = await supabase
        .from('users')
        .select('id, name, username, photo_url, streak_count, streak_last_log_date')
        .eq('id', userId!)
        .maybeSingle()

      if (!author) return []

      const photoPaths = logs.filter((l) => l.photo_url).map((l) => l.photo_url as string)
      const signedUrlByPath = new Map<string, string>()
      if (photoPaths.length > 0) {
        const { data: signedUrls } = await supabase.storage
          .from('meal-photos')
          .createSignedUrls(photoPaths, 3600)
        for (const entry of signedUrls ?? []) {
          if (entry.signedUrl && entry.path) signedUrlByPath.set(entry.path, entry.signedUrl)
        }
      }

      const logIds = logs.map((l) => l.id)
      const { data: likeRows }    = await supabase.from('log_likes').select('log_id, user_id').in('log_id', logIds)
      const { data: commentRows } = await supabase.from('log_comments').select('log_id').in('log_id', logIds)

      const likesByLog = new Map<string, { count: number; likedByViewer: boolean }>()
      for (const like of likeRows ?? []) {
        const entry = likesByLog.get(like.log_id) ?? { count: 0, likedByViewer: false }
        entry.count += 1
        if (like.user_id === userId) entry.likedByViewer = true
        likesByLog.set(like.log_id, entry)
      }

      const commentCountByLog = new Map<string, number>()
      for (const c of commentRows ?? []) {
        commentCountByLog.set(c.log_id, (commentCountByLog.get(c.log_id) ?? 0) + 1)
      }

      return logs.map((log) => {
        const likeInfo = likesByLog.get(log.id) ?? { count: 0, likedByViewer: false }
        return {
          log,
          author,
          photoSignedUrl: log.photo_url ? (signedUrlByPath.get(log.photo_url) ?? null) : null,
          likeCount: likeInfo.count,
          likedByViewer: likeInfo.likedByViewer,
          commentCount: commentCountByLog.get(log.id) ?? 0,
        }
      })
    },
    enabled: Boolean(userId),
  })

  return {
    ...query,
    isLoading: sessionLoading || (Boolean(userId) && query.isLoading),
  }
}
