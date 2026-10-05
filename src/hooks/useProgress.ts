import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { mondayOf } from '../lib/weeklyRecap'
import { localDateKey, type MacroLog, type WeighIn } from '../lib/progress'
import { useSession } from './useSession'

/**
 * Data for the Insights progress cards: weigh-ins (null if the 0013
 * migration hasn't run yet) and the last four weeks of the viewer's logs.
 */
export function useProgress() {
  const { session } = useSession()
  const userId = session?.user.id
  const weekKey = localDateKey(mondayOf(new Date()))

  return useQuery({
    queryKey: ['progress', userId, weekKey],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const since = mondayOf(new Date())
      since.setDate(since.getDate() - 21)

      const [weights, logs] = await Promise.all([
        supabase.from('weight_logs').select('weight_kg, logged_on').eq('user_id', userId!).order('logged_on'),
        supabase.from('logs')
          .select('created_at, calories_final, calories_estimate, protein_final_g, protein_estimate_g, carbs_final_g, carbs_estimate_g, fat_final_g, fat_estimate_g')
          .eq('user_id', userId!).gte('created_at', since.toISOString()),
      ])
      if (logs.error) throw logs.error

      return {
        /** null = weight tracking isn't set up on the server yet. */
        weighIns: weights.error ? null : (weights.data ?? []).map((w) => ({ weight_kg: Number(w.weight_kg), logged_on: w.logged_on })) as WeighIn[],
        logs: (logs.data ?? []).map((l): MacroLog => ({
          created_at: l.created_at,
          calories: l.calories_final ?? l.calories_estimate,
          protein: l.protein_final_g ?? l.protein_estimate_g,
          carbs: l.carbs_final_g ?? l.carbs_estimate_g,
          fat: l.fat_final_g ?? l.fat_estimate_g,
        })),
      }
    },
  })
}

/** Today's weigh-in (one per day — logging again replaces it). */
export function useLogWeight() {
  const queryClient = useQueryClient()
  const { session } = useSession()
  return useMutation({
    mutationFn: async (weightKg: number) => {
      const { error } = await supabase.from('weight_logs')
        .upsert({ user_id: session!.user.id, weight_kg: weightKg, logged_on: localDateKey(new Date()) }, { onConflict: 'user_id,logged_on' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['progress'] }),
  })
}

/** Height / goal weight, edited from the Insights cards. */
export function useUpdateBodyStats() {
  const queryClient = useQueryClient()
  const { session } = useSession()
  return useMutation({
    mutationFn: async (fields: { height_cm?: number; target_weight_kg?: number }) => {
      const { error } = await supabase.from('users').update(fields).eq('id', session!.user.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
  })
}
