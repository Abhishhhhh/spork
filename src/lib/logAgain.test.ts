import { describe, expect, it } from 'vitest'
import { estimateFromPastMeal, pickUsualMeals, type PastMeal } from './logAgain'

const meal = (over: Partial<PastMeal>): PastMeal => ({
  id: 'x', name: 'Dal rice', created_at: '2026-10-01T08:00:00Z', photo_url: null,
  calories_final: 600, calories_estimate: 580, protein_final_g: 20, protein_estimate_g: 20,
  carbs_final_g: 90, carbs_estimate_g: 90, fat_final_g: 14, fat_estimate_g: 14, ai_raw_response: null, ...over,
})

describe('pickUsualMeals', () => {
  it('ranks by how often a meal was logged, keeping its latest copy', () => {
    const usual = pickUsualMeals([
      meal({ id: 'a', name: 'Omelette', created_at: '2026-10-01' }),
      meal({ id: 'b', name: 'omelette ', created_at: '2026-10-03' }),
      meal({ id: 'c', name: 'Dal rice', created_at: '2026-10-04' }),
      meal({ id: 'd', name: null }),
      meal({ id: 'e', name: 'Water', calories_final: 0, calories_estimate: 0 }),
    ])
    expect(usual.map((u) => [u.meal.id, u.count])).toEqual([['b', 2], ['c', 1]])
  })
})

describe('estimateFromPastMeal', () => {
  const raw = { calories: 580, protein_g: 20, carbs_g: 90, fat_g: 14, confidence: 'high', items: [
    { name: 'Dal', quantity: '1 bowl', grams: 200, calories: 200, protein_g: 12, carbs_g: 30, fat_g: 4, confidence: 'high' },
    { name: 'Rice', quantity: '1 cup', grams: 180, calories: 390, protein_g: 8, carbs_g: 60, fat_g: 10, confidence: 'high' },
  ] }
  it('uses the posted totals', () => {
    expect(estimateFromPastMeal(meal({ ai_raw_response: raw })).parsed).toMatchObject({ calories: 600, protein_g: 20, carbs_g: 90, fat_g: 14 })
  })
  it('keeps the AI items only when they still add up', () => {
    expect(estimateFromPastMeal(meal({ ai_raw_response: raw })).parsed.items).toHaveLength(2) // 590 ≈ 600
    expect(estimateFromPastMeal(meal({ ai_raw_response: raw, calories_final: 900 })).parsed.items).toHaveLength(0)
    expect(estimateFromPastMeal(meal({})).parsed.items).toHaveLength(0)
  })
})
