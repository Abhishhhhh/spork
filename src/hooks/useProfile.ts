import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

/** Fetches the current user's own logs for the last 30 days — used by profile stats + calendar. */
export function useMyLogs(days = 30) {
  const { session } = useSession()
  const userId = session?.user.id

  return useQuery({
    queryKey: ['myLogs', userId, days],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date()
      since.setDate(since.getDate() - days)
      const { data, error } = await supabase
        .from('logs')
        .select('id, created_at, name, calories_final, calories_estimate, protein_final_g, protein_estimate_g, meal_type, photo_url')
        .eq('user_id', userId!)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

/** Fetches logs for a specific calendar day (local date string yyyy-mm-dd). */
export function useLogsForDay(dateStr: string) {
  const { session } = useSession()
  const userId = session?.user.id

  // Build start/end of local day in UTC
  const start = new Date(`${dateStr}T00:00:00`)
  const end   = new Date(`${dateStr}T23:59:59`)

  return useQuery({
    queryKey: ['logsForDay', userId, dateStr],
    enabled: Boolean(userId) && Boolean(dateStr),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logs')
        .select('id, created_at, name, calories_final, calories_estimate, meal_type')
        .eq('user_id', userId!)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

/** Update a user's own settings fields. */
export function useUpdateProfile() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  const userId = session?.user.id

  return useMutation({
    mutationFn: async (fields: {
      name?: string
      calorie_goal?: number
      protein_goal?: number
      privacy_default?: 'public' | 'private'
      reminder_time?: string | null
    }) => {
      const { error } = await supabase.from('users').update(fields).eq('id', userId!)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
    },
  })
}
