import { describe, expect, it } from 'vitest'
import { suggestCalorieGoal } from './calorieGoal'

describe('suggestCalorieGoal', () => {
  it('computes a sedentary suggestion for a male', () => {
    // BMR = 10*70 + 6.25*175 - 5*30 + 5 = 700 + 1093.75 - 150 + 5 = 1648.75
    // TDEE = 1648.75 * 1.2 = 1978.5 -> rounds to nearest 10 -> 1980
    const result = suggestCalorieGoal({ weightKg: 70, heightCm: 175, age: 30, sex: 'male', activityLevel: 'sedentary' })
    expect(result).toBe(1980)
  })

  it('computes a sedentary suggestion for a female', () => {
    // BMR = 10*70 + 6.25*175 - 5*30 - 161 = 700 + 1093.75 - 150 - 161 = 1482.75
    // TDEE = 1482.75 * 1.2 = 1779.3 -> rounds to nearest 10 -> 1780
    const result = suggestCalorieGoal({ weightKg: 70, heightCm: 175, age: 30, sex: 'female', activityLevel: 'sedentary' })
    expect(result).toBe(1780)
  })

  it('scales up with higher activity level', () => {
    const sedentary = suggestCalorieGoal({ weightKg: 70, heightCm: 175, age: 30, sex: 'male', activityLevel: 'sedentary' })
    const active = suggestCalorieGoal({ weightKg: 70, heightCm: 175, age: 30, sex: 'male', activityLevel: 'active' })
    expect(active).toBeGreaterThan(sedentary)
  })

  it('rounds to the nearest 10 calories', () => {
    const result = suggestCalorieGoal({ weightKg: 62, heightCm: 160, age: 25, sex: 'female', activityLevel: 'light' })
    expect(result % 10).toBe(0)
  })

  it('gives a higher result for male than female with identical other inputs', () => {
    const male = suggestCalorieGoal({ weightKg: 70, heightCm: 175, age: 30, sex: 'male', activityLevel: 'moderate' })
    const female = suggestCalorieGoal({ weightKg: 70, heightCm: 175, age: 30, sex: 'female', activityLevel: 'moderate' })
    expect(male).toBeGreaterThan(female)
  })
})
