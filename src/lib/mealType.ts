export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/**
 * Auto-suggestion shown on the Edit & Post step (spec §6) — always
 * editable, never enforced. Boundaries: breakfast 5:00-10:59, lunch
 * 11:00-14:59, dinner 17:00-21:59, snack otherwise (late-morning gap,
 * afternoon gap, late night). Reads the local hour directly — no
 * timezone ambiguity, since real call sites always pass a live `Date`.
 */
export function suggestMealType(now: Date): MealType {
  const hour = now.getHours()
  if (hour >= 5 && hour < 11) return 'breakfast'
  if (hour >= 11 && hour < 15) return 'lunch'
  if (hour >= 17 && hour < 22) return 'dinner'
  return 'snack'
}
