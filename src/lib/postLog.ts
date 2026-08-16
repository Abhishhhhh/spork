import { supabase } from './supabase'
import { computeNextStreak } from './streak'
import type { EstimateResult, MealType, Visibility } from '../store/logDraft'

export interface PostLogInput {
  userId: string
  photoFile: File | null
  mealName: string
  description: string
  mealType: MealType
  visibility: Visibility
  estimate: EstimateResult | null
  finalCalories: number | null
  finalProteinG: number | null
  finalCarbsG: number | null
  finalFatG: number | null
  currentStreakCount: number
  currentStreakLastLogDate: string | null
}

async function uploadMealPhoto(userId: string, logId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/${logId}.${extension}`

  const { error } = await supabase.storage.from('meal-photos').upload(path, file)
  if (error) throw error

  return path
}

/**
 * Runs on tapping Post (spec §6): uploads the photo — the first point
 * anything is persisted — inserts the logs row, then updates the streak.
 * Mirrors completeOnboarding.ts's single-orchestration-function shape;
 * no new backend pattern (no RPC) is introduced. `photo_url` is stored as
 * the raw Storage object path, not a URL — see this plan's Global
 * Constraints note (also relevant to Task 7).
 */
export async function postLog(input: PostLogInput): Promise<void> {
  const logId = crypto.randomUUID()

  const photoPath = input.photoFile ? await uploadMealPhoto(input.userId, logId, input.photoFile) : null

  const { error: insertError } = await supabase.from('logs').insert({
    id: logId,
    user_id: input.userId,
    photo_url: photoPath,
    name: input.mealName || null,
    description: input.description || null,
    meal_type: input.mealType,
    visibility: input.visibility,
    calories_estimate: input.estimate?.parsed.calories ?? null,
    calories_final: input.finalCalories,
    protein_estimate_g: input.estimate?.parsed.protein_g ?? null,
    protein_final_g: input.finalProteinG,
    carbs_estimate_g: input.estimate?.parsed.carbs_g ?? null,
    carbs_final_g: input.finalCarbsG,
    fat_estimate_g: input.estimate?.parsed.fat_g ?? null,
    fat_final_g: input.finalFatG,
    ai_confidence: input.estimate?.parsed.confidence ?? null,
    ai_raw_response: input.estimate?.raw ?? null,
  })

  if (insertError) throw insertError

  const next = computeNextStreak(input.currentStreakCount, input.currentStreakLastLogDate, new Date())

  const { error: streakError } = await supabase
    .from('users')
    .update({ streak_count: next.streak_count, streak_last_log_date: next.streak_last_log_date })
    .eq('id', input.userId)

  if (streakError) throw streakError
}
