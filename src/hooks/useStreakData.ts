import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'
import { useCurrentUser } from './useCurrentUser'
import { getEffectiveStreak } from '../lib/streak'
import { computeStreakMeta, type StreakMeta } from '../lib/streakMeta'
import { buildLogDateSet } from '../lib/profileStats'

export interface StreakData extends StreakMeta {
  effectiveStreak: number
  todayLogged: boolean
  /** Set of yyyy-mm-dd strings — last 30 days that have at least one log */
  recentLogDates: Set<string>
}

export function useStreakData() {
  const { session } = useSession()
  const { data: user } = useCurrentUser()
  const userId = session?.user.id

  return useQuery<StreakData>({
    queryKey: ['streakData', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<StreakData> => {
      // Fetch last 30 days of logs to build the calendar
      const since = new Date()
      since.setDate(since.getDate() - 30)

      const { data: logs } = await supabase
        .from('logs')
        .select('created_at')
        .eq('user_id', userId!)
        .gte('created_at', since.toISOString())

      const recentLogDates = buildLogDateSet(
        (logs ?? []).map((l) => ({ ...l, calories_final: null, calories_estimate: null }))
      )

      const todayStr = new Date().toLocaleDateString('en-CA')
      const todayLogged = recentLogDates.has(todayStr)

      const rawStreak = user?.streak_count ?? 0
      const effectiveStreak = getEffectiveStreak(rawStreak, user?.streak_last_log_date ?? null, new Date())

      return {
        effectiveStreak,
        todayLogged,
        recentLogDates,
        ...computeStreakMeta(effectiveStreak),
      }
    },
  })
}
