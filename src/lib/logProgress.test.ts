import { describe, expect, it } from 'vitest'
import { aggregateToday, nutrientStatus, completionMessage, localDayBounds } from './logProgress'

describe('daily logging progress', () => {
  it('distinguishes first-ever, returning and once-per-day confirmed milestones', () => {
    expect(completionMessage(1, 1, true)).toBe('Your first meal is saved')
    expect(completionMessage(20, 7, true)).toBe('7 days of checking in')
    expect(completionMessage(21, 7, false)).toBe('Meal saved')
    expect(completionMessage(20, null, true)).toBe('Meal saved')
  })
  it('is honest below, at and above target without restrictive praise', () => {
    expect(nutrientStatus(1800, 2000, 'kcal')).toBe('200 kcal remaining')
    expect(nutrientStatus(2000, 2000, 'kcal')).toBe('At target')
    expect(nutrientStatus(2300, 2000, 'kcal')).toBe('300 kcal over target')
  })
  it('marks missing nutrients instead of silently claiming full daily consumption', () => {
    expect(aggregateToday([{ calories_final: 500 }]).missing).toEqual({ calories: 0, protein: 1, carbs: 1, fat: 1 })
  })
  it('bounds queries to the actual local day with explicit timezones', () => {
    const now = new Date(2026, 8, 11, 15)
    const bounds = localDayBounds(now)
    expect(bounds.start).toBe(new Date(2026, 8, 11).toISOString())
    expect(bounds.end).toBe(new Date(2026, 8, 12).toISOString())
  })
  it('uses edited values including zero, counts all four nutrients, and never invents targets', () => {
    const stats = aggregateToday([{ calories_final: 0, calories_estimate: 500, protein_final_g: 20, carbs_estimate_g: 30, fat_final_g: 10 }], { calorie_goal: null, protein_goal: 80 })
    expect(stats.caloriesLogged).toBe(0)
    expect(stats.proteinLogged).toBe(20)
    expect(stats.carbsLogged).toBe(30)
    expect(stats.fatLogged).toBe(10)
    expect(stats.targets).toEqual({ calories: null, protein: 80, carbs: null, fat: null })
    expect(nutrientStatus(20, null, 'g')).toBe('No target set')
  })
})
