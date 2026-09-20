import { describe, expect, it } from 'vitest'
import { likedByLabel } from './likedBy'

const friends = new Map([['f1', 'rohaan'], ['f2', 'priya']])
const base = { viewerId: 'me', friendUsernameById: friends }

describe('likedByLabel', () => {
  it('hides when nobody liked', () => {
    expect(likedByLabel({ ...base, likerIds: [], total: 0, viewerLiked: false })).toBeNull()
  })
  it('falls back to a count when no friends liked', () => {
    expect(likedByLabel({ ...base, likerIds: ['x', 'y'], total: 2, viewerLiked: false })).toBe('2 likes')
    expect(likedByLabel({ ...base, likerIds: ['x'], total: 1, viewerLiked: false })).toBe('1 like')
  })
  it('says "Liked by you" when the viewer is the only liker', () => {
    expect(likedByLabel({ ...base, likerIds: ['me'], total: 1, viewerLiked: true })).toBe('Liked by you')
  })
  it('names one friend and folds the rest', () => {
    expect(likedByLabel({ ...base, likerIds: ['x', 'f1', 'y', 'z'], total: 4, viewerLiked: false }))
      .toBe('Liked by @rohaan and 3 others')
    expect(likedByLabel({ ...base, likerIds: ['f1', 'y'], total: 2, viewerLiked: false }))
      .toBe('Liked by @rohaan and 1 other')
  })
  it('names up to two friends', () => {
    expect(likedByLabel({ ...base, likerIds: ['f1', 'f2'], total: 2, viewerLiked: false }))
      .toBe('Liked by @rohaan and @priya')
    expect(likedByLabel({ ...base, likerIds: ['f1', 'f2', 'x'], total: 3, viewerLiked: false }))
      .toBe('Liked by @rohaan, @priya and 1 other')
  })
  it('never names the viewer, and keeps the remainder in sync with an optimistic count', () => {
    // viewer just liked (optimistic total 3, likerIds not yet refetched)
    expect(likedByLabel({ ...base, likerIds: ['f1', 'x'], total: 3, viewerLiked: true }))
      .toBe('Liked by @rohaan and 2 others')
  })
})
