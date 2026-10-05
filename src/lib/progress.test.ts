import { describe, expect, it } from 'vitest'
import { bmi, caloriesByMacro, daysToNextWeighIn, goalProgress, thisWeekDots, weighInsInRange, type MacroLog } from './progress'

// Wednesday 30 Sep 2026 — this week is Mon 28 Sep – Sun 4 Oct
const NOW = new Date(2026, 8, 30, 10)
const at = (m: number, d: number, h = 13) => new Date(2026, m, d, h).toISOString()

describe('bmi', () => {
  it('computes value and category', () => {
    expect(bmi(172, 73)).toMatchObject({ value: 24.7, category: 'Healthy' })
    expect(bmi(172, 50)!.category).toBe('Underweight')
    expect(bmi(172, 80)!.category).toBe('Overweight')
    expect(bmi(172, 95)!.category).toBe('Obese')
  })
  it('needs both height and weight', () => {
    expect(bmi(null, 70)).toBeNull()
    expect(bmi(172, undefined)).toBeNull()
  })
})

describe('weight', () => {
  const w = [{ weight_kg: 76, logged_on: '2026-09-01' }, { weight_kg: 74.5, logged_on: '2026-09-15' }, { weight_kg: 73, logged_on: '2026-09-25' }]
  it('measures progress from the first weigh-in to the goal', () => {
    expect(goalProgress(w, 70)).toBeCloseTo(0.5)     // 76 → 73 of 76 → 70
    expect(goalProgress(w, null)).toBeNull()
    expect(goalProgress([], 70)).toBeNull()
    expect(goalProgress([{ weight_kg: 60, logged_on: '2026-09-01' }, { weight_kg: 63, logged_on: '2026-09-20' }], 66)).toBeCloseTo(0.5) // gaining
  })
  it('counts down to the weekly weigh-in', () => {
    expect(daysToNextWeighIn(w, NOW)).toBe(2)        // 25 Sep + 7 = 2 Oct
    expect(daysToNextWeighIn([], NOW)).toBe(0)
    expect(daysToNextWeighIn([{ weight_kg: 70, logged_on: '2026-09-01' }], NOW)).toBe(0)
  })
  it('filters by range', () => {
    expect(weighInsInRange(w, 30, NOW).map((x) => x.logged_on)).toEqual(['2026-09-01', '2026-09-15', '2026-09-25'])
    expect(weighInsInRange(w, 'all', NOW)).toHaveLength(3)
    expect(weighInsInRange(w, 30, new Date(2026, 9, 20))).toHaveLength(1)
  })
})

describe('caloriesByMacro', () => {
  const log = (created_at: string, calories: number, protein: number, carbs: number, fat: number): MacroLog => ({ created_at, calories, protein, carbs, fat })
  it('splits each day by macro calories, this week and earlier weeks', () => {
    const logs = [log(at(8, 28), 500, 25, 50, 20), log(at(8, 28, 20), 300, 0, 75, 0), log(at(8, 22), 900, 50, 100, 30)]
    const thisWeek = caloriesByMacro(logs, 0, NOW)
    expect(thisWeek[0].calories).toBe(800)
    expect(thisWeek[0].protein + thisWeek[0].carbs + thisWeek[0].fat).toBeCloseTo(1)
    expect(thisWeek[0].carbs).toBeCloseTo(500 / 780) // (50+75)*4 of 25*4 + 125*4 + 20*9
    expect(thisWeek[1].calories).toBe(0)
    expect(caloriesByMacro(logs, 1, NOW)[1].calories).toBe(900) // Tue 22 Sep, last week
  })
})

describe('thisWeekDots', () => {
  it('marks logged days this week and today', () => {
    expect(thisWeekDots([at(8, 28), at(8, 30), at(8, 27)], NOW)).toEqual({ days: [true, false, true, false, false, false, false], today: 2 })
  })
})
