import { describe, expect, it } from 'vitest'
import { aggregateLogsToDaily, deriveInsights, topProteinMealsFromLogs, dateWindow, localDateKey, type InsightLog } from './insights'

const today = new Date(2026, 8, 20, 12) // Sun 20 Sep 2026 (local)
const at = (daysAgo: number, hour: number) => {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo, hour, 0, 0)
  return d.toISOString()
}
const log = (daysAgo: number, hour: number, meal_type: InsightLog['meal_type'], calories: number, protein: number, name = `${meal_type} ${daysAgo}`): InsightLog =>
  ({ created_at: at(daysAgo, hour), name, meal_type, calories, protein, carbs: 50, fat: 15 })

describe('dateWindow', () => {
  it('returns N local dates ending today, oldest first', () => {
    const w = dateWindow(3, today)
    expect(w).toEqual(['2026-09-18', '2026-09-19', '2026-09-20'])
    expect(localDateKey(today)).toBe('2026-09-20')
  })
})

describe('aggregateLogsToDaily', () => {
  it('sums by local day and by meal type, and flags early breakfasts', () => {
    const daily = aggregateLogsToDaily([
      log(0, 8, 'breakfast', 400, 20),
      log(0, 13, 'lunch', 600, 35),
      log(0, 20, 'dinner', 700, 30),
      log(1, 11, 'breakfast', 350, 15),
    ])
    expect(daily).toHaveLength(2)
    const todayRow = daily.find((d) => d.date === '2026-09-20')!
    expect(todayRow.calories).toBe(1700)
    expect(todayRow.protein).toBe(85)
    expect(todayRow.meals).toBe(3)
    expect(todayRow.byType.lunch.calories).toBe(600)
    expect(todayRow.breakfastBefore1030).toBe(true)
    expect(daily.find((d) => d.date === '2026-09-19')!.breakfastBefore1030).toBe(false) // 11:00 breakfast
  })
})

describe('topProteinMealsFromLogs', () => {
  it('groups by name case-insensitively and ranks by average protein', () => {
    const top = topProteinMealsFromLogs([
      log(0, 13, 'lunch', 600, 34, 'Chicken curry'),
      log(1, 13, 'lunch', 620, 36, 'chicken curry'),
      log(2, 8, 'breakfast', 300, 18, 'Greek yoghurt'),
      log(3, 8, 'breakfast', 320, 26, 'Egg breakfast'),
    ])
    expect(top.map((t) => t.name)).toEqual(['Chicken curry', 'Egg breakfast', 'Greek yoghurt'])
    expect(top[0]).toMatchObject({ count: 2, avgProtein: 35 })
  })
})

describe('deriveInsights', () => {
  const goals = { calorieGoal: 2000, proteinGoal: 120 }
  // 7 logged days: Mon..Sun ending today (Sun). Weekdays near goal, weekend high.
  const logs: InsightLog[] = []
  for (let ago = 6; ago >= 0; ago--) {
    const dow = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ago).getDay()
    const weekend = dow === 0 || dow === 6
    logs.push(log(ago, 8, 'breakfast', 400, 25))
    logs.push(log(ago, 13, 'lunch', 700, 50))
    logs.push(log(ago, 20, 'dinner', weekend ? 1400 : 850, 40))
  }
  const daily = aggregateLogsToDaily(logs)
  const insights = deriveInsights({ daily, topProtein: [], goals, range: 7, streak: 7, today })

  it('computes averages, target adherence and logged days', () => {
    // weekdays 1950 ×5, weekend 2500 ×2 → avg 2107
    expect(insights.overview.avgCalories).toBe(2107)
    expect(insights.overview.deltaToGoal).toBe(-107)
    expect(insights.overview.onTargetDays).toBe(5)     // 1950 is within ±10% of 2000; 2500 is not
    expect(insights.overview.loggedDays).toBe(7)
    expect(insights.overview.proteinGoalDays).toBe(0)  // 115g < 120g every day
    expect(insights.range.enough).toBe(true)
  })

  it('builds 7 bars in chronological order with over-goal flags', () => {
    expect(insights.overview.bars).toHaveLength(7)
    expect(insights.overview.bars.filter((b) => b.over)).toHaveLength(2)
    expect(insights.overview.bars[6].label).toBe('S') // today is Sunday
  })

  it('splits calories by meal and finds the strongest days / protein meal', () => {
    const lunch = insights.calories.byMeal.find((m) => m.type === 'lunch')!
    expect(lunch.pct).toBeGreaterThan(30)
    expect(insights.overview.cards[0].title).toBe('Weekdays are your strongest days')
    expect(insights.overview.cards[1].title).toBe('Protein is most consistent at lunch')
    expect(insights.calories.card?.title).toMatch(/Saturday|Sunday/)
  })

  it('reports the protein shortfall and the lightest meal', () => {
    expect(insights.macros.protein.avg).toBe(115)
    expect(insights.macros.shortfall).toBe(5)
    expect(insights.macros.callout.title).toBe('5g short on average')
    expect(insights.macros.callout.body).toContain('Breakfast')
    expect(insights.macros.series).toHaveLength(7)
  })

  it('classifies the 28-day calendar and habit rates', () => {
    const c = insights.consistency
    expect(c.days).toBe(28)
    expect(c.calendar).toHaveLength(28)
    expect(c.calendar.filter((d) => d.state === 'complete')).toHaveLength(7)
    expect(c.calendar.filter((d) => d.state === 'missed')).toHaveLength(21)
    expect(c.loggedDays).toBe(7)
    expect(c.mealsTotal).toBe(21)
    expect(c.habits.breakfastPct).toBe(100)
    expect(c.habits.dinnerPct).toBe(100)
    expect(c.card.title).toBe('Your first month of logging')
  })

  it('handles an empty period without throwing', () => {
    const empty = deriveInsights({ daily: [], topProtein: [], goals, range: 30, streak: 0, today })
    expect(empty.overview.avgCalories).toBe(0)
    expect(empty.range.enough).toBe(false)
    expect(empty.overview.bars).toHaveLength(7)
    expect(empty.consistency.card.title).toBe('Start your logging habit')
  })
})
