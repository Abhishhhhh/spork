import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { buildWeeklyRecap, recapWeeks, type RecapLog, type WeeklyRecap } from '../lib/weeklyRecap'
import { useSession } from './useSession'
import { useCurrentUser } from './useCurrentUser'

/** Last Mon–Sun recap for the signed-in user (null = nothing logged that week). */
export function useWeeklyRecap() {
  const { session } = useSession()
  const { data: user } = useCurrentUser()
  const userId = session?.user.id
  const { lastStart, prevStart, end } = recapWeeks()

  return useQuery<WeeklyRecap | null>({
    queryKey: ['weeklyRecap', userId, lastStart.toISOString(), user?.calorie_goal, user?.protein_goal],
    enabled: Boolean(userId && user),
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('logs')
        .select('id, name, created_at, calories_final, calories_estimate, protein_final_g, protein_estimate_g')
        .eq('user_id', userId!)
        .gte('created_at', prevStart.toISOString())
        .lt('created_at', end.toISOString())
      if (error) throw error

      const logs: RecapLog[] = (rows ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        created_at: r.created_at,
        calories: r.calories_final ?? r.calories_estimate,
        protein: r.protein_final_g ?? r.protein_estimate_g,
      }))

      const lastWeekIds = logs.filter((l) => new Date(l.created_at) >= lastStart).map((l) => l.id)
      const likesByLog = new Map<string, number>()
      if (lastWeekIds.length > 0) {
        const { data: likes } = await supabase.from('log_likes').select('log_id').in('log_id', lastWeekIds)
        for (const { log_id } of likes ?? []) likesByLog.set(log_id, (likesByLog.get(log_id) ?? 0) + 1)
      }

      return buildWeeklyRecap(logs, likesByLog, user ?? {})
    },
  })
}
