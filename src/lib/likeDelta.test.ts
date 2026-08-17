import { describe, expect, it } from 'vitest'
import { computeLikeDelta } from './likeDelta'

describe('computeLikeDelta', () => {
  it('returns 0 when there is no optimistic override (null)', () => {
    expect(computeLikeDelta(null, false)).toBe(0)
    expect(computeLikeDelta(null, true)).toBe(0)
  })

  it('returns 0 when there is no optimistic override (undefined)', () => {
    expect(computeLikeDelta(undefined, false)).toBe(0)
    expect(computeLikeDelta(undefined, true)).toBe(0)
  })

  it('returns +1 when optimistically liked but the server still shows unliked', () => {
    expect(computeLikeDelta(true, false)).toBe(1)
  })

  it('returns -1 when optimistically unliked but the server still shows liked', () => {
    expect(computeLikeDelta(false, true)).toBe(-1)
  })

  it('returns 0 once the optimistic state matches the settled server state (liked)', () => {
    expect(computeLikeDelta(true, true)).toBe(0)
  })

  it('returns 0 once the optimistic state matches the settled server state (unliked)', () => {
    expect(computeLikeDelta(false, false)).toBe(0)
  })
})
