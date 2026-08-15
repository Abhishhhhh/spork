import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import { useSession } from './useSession'

export type UserRow = Database['public']['Tables']['users']['Row']

export function useCurrentUser() {
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id

  const query = useQuery({
    queryKey: ['currentUser', userId],
    queryFn: async (): Promise<UserRow | null> => {
      const { data, error } = await supabase.from('users').select('*').eq('id', userId!).maybeSingle()

      if (error) throw error
      return data
    },
    enabled: Boolean(userId),
  })

  // A disabled query (no userId yet, because useSession() hasn't resolved)
  // reports isLoading: false in TanStack Query v5 — "loading" specifically
  // means "actively fetching," and a disabled query never fetches. Without
  // folding in sessionLoading here, callers see isLoading: false and
  // data: undefined simultaneously during that window and mistake "session
  // not yet known" for "confirmed: no user," which fires premature
  // onboarding-guard redirects on every fresh sign-in.
  return {
    ...query,
    isLoading: sessionLoading || (Boolean(userId) && query.isLoading),
  }
}
