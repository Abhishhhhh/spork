import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

export interface Connection {
  id: string
  username: string
  name: string
  photo_url: string | null
}

export interface ConnectionsData {
  count: number
  users: Connection[]
  /** false when the caller isn't allowed to look, or the RPC isn't deployed */
  visible: boolean
}

/**
 * Friend count + list for any profile, via the `get_connections` RPC
 * (migration 0010). RLS hides other people's friendship rows from the
 * client, so this is the only way to show a friend's connections.
 *
 * Until the migration is run the RPC is missing — Postgres answers
 * PGRST202 / 42883 — and we return visible:false so the UI simply omits
 * the counts instead of erroring, the same fallback shape useInsights
 * uses for get_insights.
 */
export function useConnections(username: string | undefined) {
  const { session } = useSession()

  return useQuery({
    queryKey: ['connections', username],
    enabled: Boolean(username) && Boolean(session),
    staleTime: 60_000,
    queryFn: async (): Promise<ConnectionsData> => {
      const { data, error } = await supabase.rpc('get_connections' as never, { p_username: username } as never)
      if (error) {
        const missing = error.code === 'PGRST202' || error.code === '42883' ||
          /could not find the function/i.test(error.message ?? '')
        if (missing) return { count: 0, users: [], visible: false }
        throw error
      }
      const payload = (data ?? {}) as Partial<ConnectionsData>
      return {
        count:   payload.count ?? 0,
        users:   payload.users ?? [],
        visible: payload.visible ?? false,
      }
    },
  })
}
