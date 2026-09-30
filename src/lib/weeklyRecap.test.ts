import { describe, expect, it } from 'vitest'
import { buildWeeklyRecap, isRecapSeason, mondayOf, recapWeeks, weekLabel, type RecapLog } from './weeklyRecap'

// Wednesday 30 Sep 2026, 10:00 local → last week = Mon 21 – Sun 27 Sep
const NOW = new Date(2026, 8, 30, 10, 0)
const at = (month: number, day: number, hour = 13) => new Date(2026, month, day, hour).toISOString()
const log = (id: string, created_at: string, calories: number | null, protein: number | null = 20, name: string | null = id): RecapLog =>
  ({ id, name, created_at, calories, protein })

describe('weeks', () => {
  it('finds the Monday of any day', () => {
    expect(mondayOf(new Date(2026, 8, 27, 23)).getDate()).toBe(21)   // Sunday → previous Monday
    expect(mondayOf(new Date(2026, 8, 21, 0, 5)).getDate()).toBe(21) // Monday → itself
  })
  it('recaps the last complete week', () => {
    const { lastStart, prevStart, end } = recapWeeks(NOW)
    expect([lastStart.getDate(), prevStart.getDate(), end.getDate()]).toEqual([21, 14, 28])
  })
  it('labels weeks, across months too', () => {
    expect(weekLabel(new Date(2026, 8, 21))).toBe('21–27 Sep')
    expect(weekLabel(new Date(2026, 8, 28))).toBe('28 Sep – 4 Oct')
  })
  it('shows the card Monday to Wednesday only', () => {
    expect(isRecapSeason(new Date(2026, 8, 28))).toBe(true)   // Mon
    expect(isRecapSeason(new Date(2026, 8, 30))).toBe(true)   // Wed
    expect(isRecapSeason(new Date(2026, 9, 1))).toBe(false)   // Thu
    expect(isRecapSeason(new Date(2026, 9, 4))).toBe(false)   // Sun
  })
})

describe('buildWeeklyRecap', () => {
  const goals = { calorie_goal: 2000, protein_goal: 100 }

  it('returns null when nothing was logged last week', () => {
    expect(buildWeeklyRecap([log('a', at(8, 28), 500)], new Map(), goals, NOW)).toBeNull()
  })

  it('counts days, meals, averages per logged day and protein-goal days', () => {
    const logs = [
      log('mon1', at(8, 21, 9), 600, 60), log('mon2', at(8, 21, 20), 1200, 50),   // Mon: 1800 kcal, 110 g ✓
      log('wed', at(8, 23), 1500, 40),                                             // Wed: 1500 kcal, 40 g
      log('sun', at(8, 27, 23), 2100, 120),                                        // Sun (late): 2100 kcal ✓
      log('old', at(8, 15), 2500),                                                 // week before
      log('new', at(8, 28), 900),                                                  // this week — ignored
    ]
    const r = buildWeeklyRecap(logs, new Map(), goals, NOW)!
    expect(r.label).toBe('21–27 Sep')
    expect(r.days).toEqual([true, false, true, false, false, false, true])
    expect(r.daysLogged).toBe(3)
    expect(r.meals).toBe(4)
    expect(r.avgCalories).toBe(1800)          // (1800 + 1500 + 2100) / 3
    expect(r.proteinDays).toBe(2)
    expect(r.calorieChange).toBe(1800 - 2500)
  })

  it('picks the most-liked meal of that week only', () => {
    const logs = [log('a', at(8, 22), 500, 20, 'Poha'), log('b', at(8, 24), 700, 30, 'Chapati plate'), log('c', at(8, 16), 400)]
    const likes = new Map([['a', 2], ['b', 5], ['c', 9]])
    expect(buildWeeklyRecap(logs, likes, goals, NOW)!.topMeal).toEqual({ name: 'Chapati plate', likes: 5 })
  })

  it('copes with no goals, no calories and no likes', () => {
    const r = buildWeeklyRecap([log('a', at(8, 22), null)], new Map(), {}, NOW)!
    expect(r).toMatchObject({ avgCalories: null, calorieGoal: null, proteinDays: null, calorieChange: null, topMeal: null, daysLogged: 1 })
  })
})
