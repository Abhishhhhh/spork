import { describe, expect, it } from 'vitest'
import { computeStreakMeta } from './streakMeta'

describe('computeStreakMeta', () => {
  it('next milestone is 7, progress 0 when streak is 0', () => {
    const r = computeStreakMeta(0)
    expect(r.nextMilestone).toBe(7)
    expect(r.daysToMilestone).toBe(7)
    expect(r.milestoneProgress).toBe(0)
    expect(r.prevMilestone).toBe(0)
  })

  it('next milestone is 7, progress partial when streak is 4', () => {
    const r = computeStreakMeta(4)
    expect(r.nextMilestone).toBe(7)
    expect(r.daysToMilestone).toBe(3)
    expect(r.milestoneProgress).toBeCloseTo(4 / 7, 4)
  })

  it('next milestone is 30 when streak is exactly 7', () => {
    const r = computeStreakMeta(7)
    expect(r.nextMilestone).toBe(30)
    expect(r.daysToMilestone).toBe(23)
    expect(r.prevMilestone).toBe(7)
    expect(r.milestoneProgress).toBeCloseTo(0 / 23, 4)
  })

  it('next milestone is 30 when streak is 15', () => {
    const r = computeStreakMeta(15)
    expect(r.nextMilestone).toBe(30)
    expect(r.daysToMilestone).toBe(15)
    expect(r.prevMilestone).toBe(7)
    expect(r.milestoneProgress).toBeCloseTo(8 / 23, 4)
  })

  it('next milestone is 100 when streak is exactly 30', () => {
    const r = computeStreakMeta(30)
    expect(r.nextMilestone).toBe(100)
    expect(r.daysToMilestone).toBe(70)
    expect(r.prevMilestone).toBe(30)
  })

  it('next milestone is 100 when streak is 50', () => {
    const r = computeStreakMeta(50)
    expect(r.nextMilestone).toBe(100)
    expect(r.daysToMilestone).toBe(50)
    expect(r.milestoneProgress).toBeCloseTo(20 / 70, 4)
  })

  it('no next milestone when streak is exactly 100', () => {
    const r = computeStreakMeta(100)
    expect(r.nextMilestone).toBeNull()
    expect(r.daysToMilestone).toBeNull()
    expect(r.milestoneProgress).toBe(1)
    expect(r.prevMilestone).toBe(100)
  })

  it('no next milestone when streak is 200', () => {
    const r = computeStreakMeta(200)
    expect(r.nextMilestone).toBeNull()
    expect(r.milestoneProgress).toBe(1)
  })

  it('milestoneProgress is always 0–1', () => {
    for (const n of [0, 1, 6, 7, 8, 29, 30, 31, 99, 100, 101]) {
      const { milestoneProgress } = computeStreakMeta(n)
      expect(milestoneProgress).toBeGreaterThanOrEqual(0)
      expect(milestoneProgress).toBeLessThanOrEqual(1)
    }
  })
})
