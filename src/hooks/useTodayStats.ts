import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'
import { useCurrentUser } from './useCurrentUser'
import { aggregateToday, localDayBounds, type TodayProgress } from '../lib/logProgress'

export type TodayStats = TodayProgress
export async function fetchTodayStats(userId: string, goals: { calorie_goal?: number | null; protein_goal?: number | null }, now = new Date()): Promise<TodayStats> {
  const { start, end } = localDayBounds(now)
  const { data, error } = await supabase.from('logs')
    .select('calories_final, calories_estimate, protein_final_g, protein_estimate_g, carbs_final_g, carbs_estimate_g, fat_final_g, fat_estimate_g')
    .eq('user_id', userId).gte('created_at', start).lt('created_at', end)
  if (error) throw error
  return aggregateToday(data ?? [], goals)
}
export function useTodayStats() {
  const { session } = useSession()
  const { data: user } = useCurrentUser()
  const [day, setDay] = useState(() => localDayBounds().start)
  useEffect(() => {
    const timer = setInterval(() => setDay(localDayBounds().start), 30_000)
    return () => clearInterval(timer)
  }, [])
  const userId = session?.user.id
  return useQuery<TodayStats>({
    queryKey: ['todayStats', userId, day, user?.calorie_goal, user?.protein_goal],
    enabled: Boolean(userId && user), staleTime: 60_000,
    queryFn: () => fetchTodayStats(userId!, user ?? {}),
  })
}
