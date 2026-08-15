import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'
import type { Database } from '../lib/database.types'

type UserRow = Database['public']['Tables']['users']['Row']
type LogRow = Database['public']['Tables']['logs']['Row']

export interface FriendProfileLog extends LogRow {
  photoSignedUrl: string | null
}

export interface FriendProfileData {
  user: UserRow
  logs: FriendProfileLog[]
}

/**
 * Two plain queries, same reasoning as useFeed: no embedded selects. The
 * `logs` query is RLS-safe by construction — whatever `visibility`/
 * friendship rules apply, this always returns exactly what the caller is
 * allowed to see for that user_id, nothing more.
 */
export function useFriendProfile(username: string | undefined) {
  const { session, loading: sessionLoading } = useSession()
  const viewerId = session?.user.id

  // viewerId is part of the key so cached, RLS-filtered results never
  // leak across accounts sharing a browser (e.g. signing out and into a
  // different account within TanStack Query's gcTime window).
  const query = useQuery({
    queryKey: ['friendProfile', viewerId, username],
    queryFn: async (): Promise<FriendProfileData | null> => {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username!)
        .maybeSingle()

      if (userError) throw userError
      if (!user) return null

      const { data: logs, error: logsError } = await supabase
        .from('logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (logsError) throw logsError

      const rows = logs ?? []
      const photoPaths = rows.filter((log) => log.photo_url).map((log) => log.photo_url as string)
      const signedUrlByPath = new Map<string, string>()
      if (photoPaths.length > 0) {
        const { data: signedUrls } = await supabase.storage.from('meal-photos').createSignedUrls(photoPaths, 3600)
        for (const entry of signedUrls ?? []) {
          if (entry.signedUrl && entry.path) signedUrlByPath.set(entry.path, entry.signedUrl)
        }
      }

      return {
        user,
        logs: rows.map((log) => ({
          ...log,
          photoSignedUrl: log.photo_url ? (signedUrlByPath.get(log.photo_url) ?? null) : null,
        })),
      }
    },
    enabled: Boolean(username) && Boolean(viewerId),
  })

  // Same session-race guard as useCurrentUser.ts / useFeed.ts: a disabled
  // query (no viewerId yet, because useSession() hasn't resolved) reports
  // isLoading: false in TanStack Query v5, so without folding sessionLoading
  // in here callers briefly see isLoading: false + data: undefined and
  // mistake "session not yet known" for "profile not found."
  return {
    ...query,
    isLoading: sessionLoading || (Boolean(viewerId) && query.isLoading),
  }
}
