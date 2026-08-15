import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'
import type { Database } from '../lib/database.types'

type LogRow = Database['public']['Tables']['logs']['Row']
type UserRow = Database['public']['Tables']['users']['Row']

export interface FeedItem {
  log: LogRow
  author: Pick<UserRow, 'id' | 'name' | 'username' | 'photo_url' | 'streak_count' | 'streak_last_log_date'>
  photoSignedUrl: string | null
}

/**
 * Fetches friends' logs, then their authors, as two separate queries
 * rather than one embedded Supabase `.select('*, users(...)')` — our
 * hand-written Database type doesn't model foreign-key `Relationships`,
 * and past experience in this project (Phase 1) showed embedded-select
 * type inference silently degrading without it. Two plain queries avoid
 * that whole class of bug.
 *
 * RLS on `logs` already restricts what a plain `select('*')` can return
 * to the caller's own rows or an accepted friend's public rows — the
 * explicit `.neq('user_id', userId)` below only removes the caller's own
 * logs from an already-safe result set, it isn't what makes this private-
 * log-safe. That's RLS's job (see supabase/migrations/0001_init.sql).
 */
export function useFeed() {
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id

  const query = useQuery({
    queryKey: ['feed', userId],
    queryFn: async (): Promise<FeedItem[]> => {
      const { data: logs, error: logsError } = await supabase
        .from('logs')
        .select('*')
        .neq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(50)

      if (logsError) throw logsError
      if (!logs || logs.length === 0) return []

      const authorIds = [...new Set(logs.map((log) => log.user_id))]
      const { data: authors, error: authorsError } = await supabase
        .from('users')
        .select('id, name, username, photo_url, streak_count, streak_last_log_date')
        .in('id', authorIds)

      if (authorsError) throw authorsError

      const authorsById = new Map((authors ?? []).map((author) => [author.id, author]))

      const photoPaths = logs.filter((log) => log.photo_url).map((log) => log.photo_url as string)
      const signedUrlByPath = new Map<string, string>()
      if (photoPaths.length > 0) {
        const { data: signedUrls } = await supabase.storage.from('meal-photos').createSignedUrls(photoPaths, 3600)
        for (const entry of signedUrls ?? []) {
          if (entry.signedUrl && entry.path) signedUrlByPath.set(entry.path, entry.signedUrl)
        }
      }

      return logs
        .map((log) => {
          const author = authorsById.get(log.user_id)
          if (!author) return null
          return {
            log,
            author,
            photoSignedUrl: log.photo_url ? (signedUrlByPath.get(log.photo_url) ?? null) : null,
          }
        })
        .filter((item): item is FeedItem => item !== null)
    },
    enabled: Boolean(userId),
  })

  // Same session-race guard as useCurrentUser.ts — a disabled query (no
  // userId yet because useSession() hasn't resolved) reports isLoading:
  // false in TanStack Query v5, so without this callers briefly see
  // isLoading: false + data: undefined and mistake "session not yet known"
  // for "confirmed: empty feed."
  return {
    ...query,
    isLoading: sessionLoading || (Boolean(userId) && query.isLoading),
  }
}
