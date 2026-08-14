import { describe, expect, it } from 'vitest'
import { suggestCalorieGoal } from './calorieGoal'

describe('suggestCalorieGoal', () => {
  it('computes a sedentary suggestion', () => {
    // BMR = 10*70 + 6.25*175 - 5*30 - 78 = 700 + 1093.75 - 150 - 78 = 1565.75
    // TDEE = 1565.75 * 1.2 = 1878.9 -> rounds to nearest 10 -> 1880
    const result = suggestCalorieGoal({ weightKg: 70, heightCm: 175, age: 30, activityLevel: 'sedentary' })
    expect(result).toBe(1880)
  })

  it('scales up with higher activity level', () => {
    const sedentary = suggestCalorieGoal({ weightKg: 70, heightCm: 175, age: 30, activityLevel: 'sedentary' })
    const active = suggestCalorieGoal({ weightKg: 70, heightCm: 175, age: 30, activityLevel: 'active' })
    expect(active).toBeGreaterThan(sedentary)
  })

  it('rounds to the nearest 10 calories', () => {
    const result = suggestCalorieGoal({ weightKg: 62, heightCm: 160, age: 25, activityLevel: 'light' })
    expect(result % 10).toBe(0)
  })
})
