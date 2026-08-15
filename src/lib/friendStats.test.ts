import { describe, expect, it } from 'vitest'
import { computeAverageCalories, computeMostLoggedMealType } from './friendStats'

describe('computeAverageCalories', () => {
  it('returns null for no logs', () => {
    expect(computeAverageCalories([])).toBeNull()
  })

  it('averages across distinct calendar days, not per-log', () => {
    const logs = [
      { calories_final: 500, calories_estimate: null, meal_type: 'breakfast' as const, created_at: '2026-08-10T08:00:00Z' },
      { calories_final: 700, calories_estimate: null, meal_type: 'lunch' as const, created_at: '2026-08-10T13:00:00Z' },
      { calories_final: 800, calories_estimate: null, meal_type: 'dinner' as const, created_at: '2026-08-11T19:00:00Z' },
    ]
    // day 1 total: 1200 (500+700), day 2 total: 800 -> avg = (1200+800)/2 = 1000
    expect(computeAverageCalories(logs)).toBe(1000)
  })

  it('falls back to the estimate when final is null', () => {
    const logs = [
      { calories_final: null, calories_estimate: 450, meal_type: 'snack' as const, created_at: '2026-08-10T08:00:00Z' },
    ]
    expect(computeAverageCalories(logs)).toBe(450)
  })

  it('skips logs with no calorie data at all', () => {
    const logs = [
      { calories_final: null, calories_estimate: null, meal_type: 'snack' as const, created_at: '2026-08-10T08:00:00Z' },
    ]
    expect(computeAverageCalories(logs)).toBeNull()
  })
})

describe('computeMostLoggedMealType', () => {
  it('returns null for no logs', () => {
    expect(computeMostLoggedMealType([])).toBeNull()
  })

  it('returns the meal type with the most logs', () => {
    const logs = [
      { calories_final: 500, calories_estimate: null, meal_type: 'lunch' as const, created_at: '2026-08-10T08:00:00Z' },
      { calories_final: 500, calories_estimate: null, meal_type: 'lunch' as const, created_at: '2026-08-11T08:00:00Z' },
      { calories_final: 500, calories_estimate: null, meal_type: 'dinner' as const, created_at: '2026-08-12T08:00:00Z' },
    ]
    expect(computeMostLoggedMealType(logs)).toBe('lunch')
  })
})
