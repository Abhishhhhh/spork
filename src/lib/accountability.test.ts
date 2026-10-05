import { describe, expect, it } from 'vitest'
import { dailyGoals, dayReview, mealScore, mealsByDay, proteinFix, weekSummary, type ScoredMeal } from './accountability'

const goals = dailyGoals(1940, 122) // carbs 194 g, fat 65 g
const meal = (over: Partial<ScoredMeal>): ScoredMeal => ({
  id: 'x', name: 'Meal', meal_type: 'lunch', created_at: new Date(2026, 8, 30, 13).toISOString(), photo_url: null,
  calories: 620, protein: 22, carbs: 90, fat: 14, ...over,
})

describe('dailyGoals', () => {
  it('derives carbs and fat like the plan screen', () => {
    expect(goals).toEqual({ calories: 1940, protein: 122, carbs: 194, fat: 65 })
    expect(dailyGoals(null, null).protein).toBe(125)
  })
})

describe('mealScore', () => {
  it('flags a low-protein lunch', () => {
    const s = mealScore(meal({}), goals)
    expect(s.score).toBe(7)
    expect(s.headline).toBe('Decent, light on protein')
    expect(s.reasons.map((r) => r.tone)).toEqual(['good', 'low'])
    expect(s.reasons[1].hint).toBe('Add 100 g paneer ≈ 18 g')
    expect(mealScore(meal({ carbs: 120, fat: 8 }), goals).reasons.some((r) => r.text.startsWith('Carb-heavy'))).toBe(true)
  })
  it('rewards a balanced, high-protein meal', () => {
    expect(mealScore(meal({ meal_type: 'dinner', calories: 600, protein: 40, carbs: 55, fat: 22 }), goals)).toMatchObject({ score: 10, headline: 'Great meal' })
  })
  it('marks one huge meal as heavy', () => {
    expect(mealScore(meal({ meal_type: 'snack', calories: 900, protein: 10, carbs: 100, fat: 45 }), goals).tone).toBe('low')
  })
})

describe('proteinFix', () => {
  it('suggests everyday foods that roughly cover the gap', () => {
    expect(proteinFix(28)).toBe('100 g paneer + 2 boiled eggs ≈ 30 g')
    expect(proteinFix(10)).toBe('2 boiled eggs ≈ 12 g')
    expect(proteinFix(4)).toBe('a bowl of dal ≈ 9 g')
  })
})

describe('dayReview', () => {
  const meals = [meal({ meal_type: 'breakfast', calories: 380, protein: 24, carbs: 30, fat: 18 }), meal({ calories: 680 }), meal({ meal_type: 'dinner', calories: 720, protein: 48, carbs: 60, fat: 39 })]
  it('scores calories, protein and meals logged', () => {
    const r = dayReview(meals, goals, false)
    expect(r.rows[0]).toMatchObject({ planned: 1940, eaten: 1780, gap: -160, tone: 'good' })
    expect(r.rows[1]).toMatchObject({ eaten: 94, gap: -28, tone: 'mid' })
    expect(r.score).toBe(85) // 40 + 25 + 20
    expect(r.summary).toBe('Calories were right, protein fell short.')
    expect(r.missing[0].text).toBe('28 g protein short')
    expect(r.label).toBe('Mostly on track')
  })
  it('handles an empty day and a day still in progress', () => {
    expect(dayReview([], goals, true)).toMatchObject({ score: null, label: 'Nothing logged yet', roomKcal: 1940 })
    const today = dayReview(meals.slice(0, 1), goals, true)
    expect(today.missing.some((m) => m.text === '1,560 kcal left today')).toBe(true)
  })
})

describe('last 7 days', () => {
  it('buckets by day (today last) and summarises logged days', () => {
    const now = new Date(2026, 8, 30, 20) // Wed 30 Sep → window Thu 24 – Wed 30
    const days = mealsByDay([meal({ created_at: new Date(2026, 8, 24, 9).toISOString() }), meal({ created_at: new Date(2026, 8, 30, 9).toISOString() }), meal({ created_at: new Date(2026, 8, 23, 9).toISOString() })], now)
    expect(days.map((d) => d.length)).toEqual([1, 0, 0, 0, 0, 0, 1])
    const w = weekSummary(days, goals)
    expect(w.scores.filter((s) => s != null)).toHaveLength(2)
    expect(w.daysLogged).toBe(2)
    expect(w.mealsPerDay).toBe(1)
  })
})
