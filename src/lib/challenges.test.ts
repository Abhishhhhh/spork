import { describe, expect, it } from 'vitest'
import { challengeDates, challengeDays, challengeStatus, dayMarks, leaderboard } from './challenges'

const NOW = new Date(2026, 9, 9, 12) // Fri 9 Oct 2026

describe('dates', () => {
  it('starts today and counts the length inclusively', () => {
    expect(challengeDates(7, NOW)).toEqual({ starts_on: '2026-10-09', ends_on: '2026-10-15' })
    expect(challengeDays('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  })
  it('knows upcoming, active and ended', () => {
    expect(challengeStatus('2026-10-09', '2026-10-15', NOW)).toMatchObject({ state: 'active', daysLeft: 7 })
    expect(challengeStatus('2026-10-01', '2026-10-07', NOW)).toMatchObject({ state: 'ended', daysLeft: 0 })
    expect(challengeStatus('2026-10-10', '2026-10-16', NOW)).toMatchObject({ state: 'upcoming', daysLeft: 7 })
  })
})

describe('leaderboard', () => {
  it('ranks by days hit, ties share a rank, silent members still listed', () => {
    const rows = [
      { user_id: 'a', day: '2026-10-07', hit: true }, { user_id: 'a', day: '2026-10-08', hit: true },
      { user_id: 'b', day: '2026-10-07', hit: true }, { user_id: 'b', day: '2026-10-08', hit: true },
      { user_id: 'c', day: '2026-10-07', hit: false }, { user_id: 'x', day: '2026-10-07', hit: true },
    ]
    expect(leaderboard(rows, ['a', 'b', 'c', 'd']).map((s) => [s.userId, s.hits, s.rank])).toEqual([['a', 2, 1], ['b', 2, 1], ['c', 0, 3], ['d', 0, 3]])
  })
})

describe('dayMarks', () => {
  it('marks hit, missed, today and future days', () => {
    expect(dayMarks(['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'], { '2026-10-07': true, '2026-10-08': false }, '2026-10-09'))
      .toEqual(['hit', 'miss', 'today', 'future'])
  })
})
