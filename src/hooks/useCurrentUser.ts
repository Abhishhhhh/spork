import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import { useSession } from './useSession'

export type UserRow = Database['public']['Tables']['users']['Row']

export function useCurrentUser() {
  const { session } = useSession()
  const userId = session?.user.id

  return useQuery({
    queryKey: ['currentUser', userId],
    queryFn: async (): Promise<UserRow | null> => {
      const { data, error } = await supabase.from('users').select('*').eq('id', userId!).maybeSingle()

      if (error) throw error
      return data
    },
    enabled: Boolean(userId),
  })
}
