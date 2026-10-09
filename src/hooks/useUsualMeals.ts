import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { signMealPhotos } from '../lib/mealPhotos'
import { pickUsualMeals, type PastMeal } from '../lib/logAgain'
import { useSession } from './useSession'

/** The viewer's most-logged meals from the last 60 days, for "Log again". */
export function useUsualMeals() {
  const { session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['usualMeals', userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 86_400_000).toISOString()
      const { data, error } = await supabase.from('logs')
        .select('id, name, created_at, photo_url, calories_final, calories_estimate, protein_final_g, protein_estimate_g, carbs_final_g, carbs_estimate_g, fat_final_g, fat_estimate_g, ai_raw_response')
        .eq('user_id', userId!).gte('created_at', since)
        .order('created_at', { ascending: false }).limit(300)
      if (error) throw error
      const usual = pickUsualMeals((data ?? []) as PastMeal[])
      const photos = await signMealPhotos(usual.map((u) => u.meal.photo_url).filter((p): p is string => Boolean(p)))
      return usual.map((u) => ({ ...u, photo: u.meal.photo_url ? photos.get(u.meal.photo_url) ?? null : null }))
    },
  })
}
