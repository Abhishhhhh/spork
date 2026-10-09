/**
 * "Log again": re-log a meal you've eaten before without a new photo or AI
 * call. The old meal's numbers pre-fill the normal review screen, so the
 * user still checks (and can edit) everything before posting.
 */
import { parseEstimateResponse } from './parseEstimate'
import { suggestMealType } from './mealType'
import { useLogDraftStore, type EstimateResult, type Visibility } from '../store/logDraft'

export interface PastMeal {
  id: string
  name: string | null
  created_at: string
  photo_url: string | null
  calories_final: number | null
  calories_estimate: number | null
  protein_final_g: number | null
  protein_estimate_g: number | null
  carbs_final_g: number | null
  carbs_estimate_g: number | null
  fat_final_g: number | null
  fat_estimate_g: number | null
  ai_raw_response: unknown
}

export interface UsualMeal { meal: PastMeal; count: number }

const totalsOf = (m: PastMeal) => ({
  calories: m.calories_final ?? m.calories_estimate ?? 0,
  protein_g: m.protein_final_g ?? m.protein_estimate_g ?? 0,
  carbs_g: m.carbs_final_g ?? m.carbs_estimate_g ?? 0,
  fat_g: m.fat_final_g ?? m.fat_estimate_g ?? 0,
})

/** Most-logged meals by name (latest copy of each), most frequent first, then most recent. */
export function pickUsualMeals(meals: PastMeal[], limit = 6): UsualMeal[] {
  const groups = new Map<string, UsualMeal>()
  for (const meal of meals) {
    const key = meal.name?.trim().toLowerCase()
    if (!key || totalsOf(meal).calories <= 0) continue
    const group = groups.get(key)
    if (!group) groups.set(key, { meal, count: 1 })
    else {
      group.count++
      if (meal.created_at > group.meal.created_at) group.meal = meal
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || b.meal.created_at.localeCompare(a.meal.created_at))
    .slice(0, limit)
}

/**
 * The past meal as an estimate for the review screen. Keeps the AI's item
 * list only when it still adds up to what was posted (within 5%); otherwise
 * the posted totals win, since the user may have corrected them.
 */
export function estimateFromPastMeal(meal: PastMeal): EstimateResult {
  const totals = totalsOf(meal)
  const ai = parseEstimateResponse(meal.ai_raw_response)
  const itemKcal = ai?.items.reduce((t, i) => t + i.calories, 0) ?? 0
  const itemsMatch = ai && ai.items.length > 0 && Math.abs(itemKcal - totals.calories) <= Math.max(10, totals.calories * 0.05)
  return {
    parsed: { items: itemsMatch ? ai.items : [], ...totals, confidence: 'high', assumptions: [] },
    raw: meal.ai_raw_response ?? null,
  }
}

/** Fill the log draft with a past meal; the log flow then opens straight on the review screen. */
export function startLogAgain(meal: PastMeal, visibility: Visibility) {
  const draft = useLogDraftStore.getState()
  draft.reset()
  draft.applyEstimate(estimateFromPastMeal(meal), suggestMealType(new Date()), visibility)
  if (meal.name) draft.setMealName(meal.name)
}
