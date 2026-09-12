import { describe, expect, it } from 'vitest'
import { computeWeeklyAvgCalories, computeWeeklyLoggedDays, computeCalorieRingPct, buildLogDateSet } from './profileStats'

// Minimal log shape for testing
const log = (date: string, cal: number | null) => ({
  created_at: `${date}T12:00:00Z`,
  calories_final: cal,
  calories_estimate: cal === null ? 400 : null,
})

describe('computeWeeklyAvgCalories', () => {
  it('returns null for empty list', () => {
    expect(computeWeeklyAvgCalories([])).toBeNull()
  })

  it('averages calories across distinct days', () => {
    const logs = [
      log('2026-09-01', 500),
      log('2026-09-01', 300), // same day — both count toward that day's total
      log('2026-09-02', 800),
    ]
    // day 1: 800, day 2: 800 → avg 800
    expect(computeWeeklyAvgCalories(logs)).toBe(800)
  })

  it('falls back to calories_estimate when final is null', () => {
    const logs = [log('2026-09-01', null)] // estimate is 400
    expect(computeWeeklyAvgCalories(logs)).toBe(400)
  })

  it('skips logs with no calorie data at all', () => {
    const noData = [{ created_at: '2026-09-01T12:00:00Z', calories_final: null, calories_estimate: null }]
    expect(computeWeeklyAvgCalories(noData)).toBeNull()
  })
})

describe('computeWeeklyLoggedDays', () => {
  it('returns 0 for empty list', () => {
    expect(computeWeeklyLoggedDays([])).toBe(0)
  })

  it('counts distinct calendar days', () => {
    const logs = [log('2026-09-01', 500), log('2026-09-01', 300), log('2026-09-02', 800)]
    expect(computeWeeklyLoggedDays(logs)).toBe(2)
  })
})

describe('computeCalorieRingPct', () => {
  it('returns 0 for 0 calories', () => {
    expect(computeCalorieRingPct(0, 2000)).toBe(0)
  })

  it('returns 0.5 for half goal', () => {
    expect(computeCalorieRingPct(1000, 2000)).toBe(0.5)
  })

  it('returns 1 for full goal', () => {
    expect(computeCalorieRingPct(2000, 2000)).toBe(1)
  })

  it('clamps to 1 when over goal', () => {
    expect(computeCalorieRingPct(3000, 2000)).toBe(1)
  })

  it('returns 0 when goal is 0 (no division by zero)', () => {
    expect(computeCalorieRingPct(500, 0)).toBe(0)
  })
})

describe('buildLogDateSet', () => {
  it('returns a set of yyyy-mm-dd strings', () => {
    const logs = [log('2026-09-01', 500), log('2026-09-01', 200), log('2026-09-03', 800)]
    const set = buildLogDateSet(logs)
    expect(set.has('2026-09-01')).toBe(true)
    expect(set.has('2026-09-03')).toBe(true)
    expect(set.size).toBe(2)
  })

  it('handles empty list', () => {
    expect(buildLogDateSet([])).toEqual(new Set())
  })
})
