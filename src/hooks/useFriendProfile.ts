import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

type UserRow = Database['public']['Tables']['users']['Row']
type LogRow = Database['public']['Tables']['logs']['Row']

export interface FriendProfileData {
  user: UserRow
  logs: LogRow[]
}

/**
 * Two plain queries, same reasoning as useFeed: no embedded selects. The
 * `logs` query is RLS-safe by construction — whatever `visibility`/
 * friendship rules apply, this always returns exactly what the caller is
 * allowed to see for that user_id, nothing more.
 */
export function useFriendProfile(username: string | undefined) {
  return useQuery({
    queryKey: ['friendProfile', username],
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

      return { user, logs: logs ?? [] }
    },
    enabled: Boolean(username),
  })
}
