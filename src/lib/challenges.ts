/** Friend challenges: types, dates and the leaderboard built from per-day hits. */
import { localDateKey } from './progress'

export type ChallengeType = 'protein' | 'on_target' | 'log_daily' | 'hydration'

export const CHALLENGE_TYPES: Record<ChallengeType, { label: string; rule: string; color: string }> = {
  protein:   { label: 'Protein week', rule: 'Hit your protein goal each day',     color: 'var(--macro-protein)' },
  on_target: { label: 'On target',    rule: 'Calories within 10% of your goal',  color: 'var(--color-teal)' },
  log_daily: { label: 'Log every day', rule: 'Log at least 2 meals a day',       color: '#ff9f43' },
  hydration: { label: 'Hydration',    rule: 'Reach your water goal each day',    color: 'var(--water)' },
}
export const CHALLENGE_LENGTHS = [7, 14, 30] as const

export interface BoardRow { user_id: string; day: string; hit: boolean }

const parseDay = (key: string) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (key: string, n: number) => { const d = parseDay(key); d.setDate(d.getDate() + n); return localDateKey(d) }

/** Start today, run for `length` days. */
export function challengeDates(length: number, now = new Date()) {
  const starts = localDateKey(now)
  return { starts_on: starts, ends_on: addDays(starts, length - 1) }
}

export function challengeDays(startsOn: string, endsOn: string): string[] {
  const days: string[] = []
  for (let d = startsOn; d <= endsOn; d = addDays(d, 1)) days.push(d)
  return days
}

/** 'upcoming' | 'active' | 'ended', and days left including today. */
export function challengeStatus(startsOn: string, endsOn: string, now = new Date()) {
  const today = localDateKey(now)
  const daysLeft = today > endsOn ? 0 : challengeDays(today < startsOn ? startsOn : today, endsOn).length
  return { state: today < startsOn ? 'upcoming' as const : today > endsOn ? 'ended' as const : 'active' as const, daysLeft, today }
}

export interface Standing { userId: string; hits: number; rank: number; days: Record<string, boolean> }

/** Rank joined members by days hit (ties share a rank). Members with no rows yet still appear. */
export function leaderboard(rows: BoardRow[], memberIds: string[]): Standing[] {
  const byUser = new Map<string, Standing>(memberIds.map((id) => [id, { userId: id, hits: 0, rank: 0, days: {} }]))
  for (const row of rows) {
    const s = byUser.get(row.user_id)
    if (!s) continue
    s.days[row.day] = row.hit
    if (row.hit) s.hits++
  }
  const sorted = [...byUser.values()].sort((a, b) => b.hits - a.hits)
  sorted.forEach((s, i) => { s.rank = i > 0 && sorted[i - 1].hits === s.hits ? sorted[i - 1].rank : i + 1 })
  return sorted
}

/** For each challenge day: hit, missed, today-so-far or still to come. */
export type DayMark = 'hit' | 'miss' | 'today' | 'future'
export function dayMarks(days: string[], hits: Record<string, boolean>, today: string): DayMark[] {
  return days.map((d) => (d > today ? 'future' : hits[d] ? 'hit' : d === today ? 'today' : 'miss'))
}
