import { describe, expect, it } from 'vitest'
import { suggestMealType } from './mealType'

describe('suggestMealType', () => {
  it('suggests breakfast at 8:30am', () => {
    expect(suggestMealType(new Date(2026, 7, 15, 8, 30))).toBe('breakfast')
  })

  it('suggests breakfast right at the 5:00am boundary', () => {
    expect(suggestMealType(new Date(2026, 7, 15, 5, 0))).toBe('breakfast')
  })

  it('suggests snack just before the breakfast boundary, at 4:59am', () => {
    expect(suggestMealType(new Date(2026, 7, 15, 4, 59))).toBe('snack')
  })

  it('suggests lunch at noon', () => {
    expect(suggestMealType(new Date(2026, 7, 15, 12, 0))).toBe('lunch')
  })

  it('suggests snack in the afternoon gap, at 4:59pm', () => {
    expect(suggestMealType(new Date(2026, 7, 15, 16, 59))).toBe('snack')
  })

  it('suggests dinner right at the 5:00pm boundary', () => {
    expect(suggestMealType(new Date(2026, 7, 15, 17, 0))).toBe('dinner')
  })

  it('suggests dinner at 9:59pm', () => {
    expect(suggestMealType(new Date(2026, 7, 15, 21, 59))).toBe('dinner')
  })

  it('suggests snack late at night, at 10:00pm', () => {
    expect(suggestMealType(new Date(2026, 7, 15, 22, 0))).toBe('snack')
  })
})
