import { describe, expect, it } from 'vitest'
import { computeNextStreak, getEffectiveStreak } from './streak'

describe('getEffectiveStreak', () => {
  it('returns 0 when there is no last-log date', () => {
    expect(getEffectiveStreak(15, null, new Date('2026-08-15'))).toBe(0)
  })

  it('shows the stored count when the last log was today', () => {
    expect(getEffectiveStreak(15, '2026-08-15', new Date('2026-08-15'))).toBe(15)
  })

  it('shows the stored count when the last log was yesterday', () => {
    expect(getEffectiveStreak(15, '2026-08-14', new Date('2026-08-15'))).toBe(15)
  })

  it('shows 0 when the last log was 2+ days ago', () => {
    expect(getEffectiveStreak(15, '2026-08-12', new Date('2026-08-15'))).toBe(0)
  })
})

describe('computeNextStreak', () => {
  // Uses new Date(year, monthIndex, day) rather than a date-only ISO
  // string like '2026-08-15'. An ISO date-only string parses as UTC
  // midnight; this function's own return value encodes a *local*
  // calendar-day string, so asserting against it needs `today` to be
  // unambiguously local from the start (unlike getEffectiveStreak, which
  // only returns a number and is insensitive to this).
  it('does not increment if already logged today', () => {
    expect(computeNextStreak(15, '2026-08-15', new Date(2026, 7, 15))).toEqual({
      streak_count: 15,
      streak_last_log_date: '2026-08-15',
    })
  })

  it('increments by 1 if the last log was yesterday', () => {
    expect(computeNextStreak(15, '2026-08-14', new Date(2026, 7, 15))).toEqual({
      streak_count: 16,
      streak_last_log_date: '2026-08-15',
    })
  })

  it('resets to 1 if the last log was 2+ days ago', () => {
    expect(computeNextStreak(15, '2026-08-12', new Date(2026, 7, 15))).toEqual({
      streak_count: 1,
      streak_last_log_date: '2026-08-15',
    })
  })

  it('starts at 1 for a first-ever log (no prior last-log date)', () => {
    expect(computeNextStreak(0, null, new Date(2026, 7, 15))).toEqual({
      streak_count: 1,
      streak_last_log_date: '2026-08-15',
    })
  })
})
