import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'
import { useCurrentUser } from './useCurrentUser'
import { useStreakData } from './useStreakData'
import {
  aggregateLogsToDaily,
  deriveInsights,
  topProteinMealsFromLogs,
  CONSISTENCY_DAYS,
  type DailyRow,
  type InsightRange,
  type Insights,
  type TopProteinMeal,
} from '../lib/insights'
import type { MealType } from '../lib/mealType'

interface RpcPayload { daily: DailyRow[]; top_protein_meals: TopProteinMeal[] }

const localTz = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}

/** True when Postgres/PostgREST says the function doesn't exist (migration not applied yet). */
function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42883' || error.code === 'PGRST202' || /could not find the function|does not exist/i.test(error.message ?? '')
}

/**
 * Daily aggregates for the insights screens. Prefers the `get_insights` RPC
 * (supabase/migrations/0009_insights.sql); if it isn't deployed yet, computes
 * the same shape client-side from the user's own logs. Either way the numbers
 * come from `deriveInsights()` so both paths agree.
 */
async function fetchAggregates(userId: string, days: InsightRange): Promise<RpcPayload> {
  const { data, error } = await supabase.rpc('get_insights' as never, { p_days: days, p_tz: localTz() } as never)
  if (!error && data) return data as unknown as RpcPayload
  if (error && !isMissingFunction(error)) throw error

  // Fallback: same window rule as the RPC — max(2×days, 56) days of own logs
  const windowDays = Math.max(days * 2, CONSISTENCY_DAYS * 2)
  const since = new Date()
  since.setHours(0, 0, 0, 0)
  since.setDate(since.getDate() - (windowDays - 1))
  const { data: rows, error: logsError } = await supabase
    .from('logs')
    .select('created_at, name, meal_type, calories_final, calories_estimate, protein_final_g, protein_estimate_g, carbs_final_g, carbs_estimate_g, fat_final_g, fat_estimate_g')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString())
  if (logsError) throw logsError
  const logs = (rows ?? []).map((r) => ({
    created_at: r.created_at,
    name: r.name,
    meal_type: r.meal_type as MealType,
    calories: r.calories_final ?? r.calories_estimate,
    protein:  r.protein_final_g ?? r.protein_estimate_g,
    carbs:    r.carbs_final_g ?? r.carbs_estimate_g,
    fat:      r.fat_final_g ?? r.fat_estimate_g,
  }))
  return { daily: aggregateLogsToDaily(logs), top_protein_meals: topProteinMealsFromLogs(logs) }
}

export function useInsights(range: InsightRange) {
  const { session } = useSession()
  const { data: user } = useCurrentUser()
  const { data: streak } = useStreakData()
  const userId = session?.user.id

  const query = useQuery({
    queryKey: ['insights', userId, range],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: () => fetchAggregates(userId!, range),
  })

  const insights: Insights | null = query.data && user
    ? deriveInsights({
        daily: query.data.daily,
        topProtein: query.data.top_protein_meals,
        goals: { calorieGoal: user.calorie_goal ?? 2000, proteinGoal: (user as unknown as { protein_goal?: number | null }).protein_goal ?? 0 },
        range,
        streak: streak?.effectiveStreak ?? user.streak_count ?? 0,
      })
    : null

  return { ...query, insights, user }
}
