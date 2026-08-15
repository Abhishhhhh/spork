import { describe, expect, it } from 'vitest'
import { getEffectiveStreak } from './streak'

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
