import { describe, expect, it } from 'vitest'
import {
  computeTDEE,
  computeTDEETwoAxis,
  computePacedGoal,
  clampCalorieGoal,
  isSafeCalorieGoal,
  computeTimeline,
  suggestProteinGoal,
  suggestCalorieGoal,
  MIN_SAFE_CALORIES,
  PACE_RATES,
} from './calorieGoal'

// ─── computeTDEETwoAxis ──────────────────────────────────────────────────────

describe('computeTDEETwoAxis', () => {
  const base = { weightKg: 95, heightCm: 187.96, age: 24, sex: 'male' as const }

  it('desk job, no workouts → same as sedentary single-axis', () => {
    // BMR ≈ 2009.75; × 1.2 = 2411.7 → 2410
    const result = computeTDEETwoAxis({ ...base, jobActivity: 'desk', workoutDaysPerWeek: 0, workoutType: 'none' })
    expect(result).toBe(2410)
  })

  it('desk job + 3 strength days → adds 3×300/7 ≈ 129 kcal/day', () => {
    // base 2410 + 3*300/7 = 2410 + 128.6 = 2538.6 → 2540
    const result = computeTDEETwoAxis({ ...base, jobActivity: 'desk', workoutDaysPerWeek: 3, workoutType: 'strength' })
    expect(result).toBe(2540)
  })

  it('desk job + 5 cardio days → adds 5×400/7 ≈ 286 kcal/day', () => {
    // base 2410 + 5*400/7 = 2410 + 285.7 = 2695.7 → 2700
    const result = computeTDEETwoAxis({ ...base, jobActivity: 'desk', workoutDaysPerWeek: 5, workoutType: 'cardio' })
    expect(result).toBe(2700)
  })

  it('on-feet job, no workouts', () => {
    // BMR 2009.75 × 1.375 = 2763.4 → 2760
    const result = computeTDEETwoAxis({ ...base, jobActivity: 'on_feet', workoutDaysPerWeek: 0, workoutType: 'none' })
    expect(result).toBe(2760)
  })

  it('physical job + 4 mixed days', () => {
    // BMR 2009.75 × 1.55 = 3115.1; + 4*350/7 = 200; total 3315.1 → 3320
    const result = computeTDEETwoAxis({ ...base, jobActivity: 'physical', workoutDaysPerWeek: 4, workoutType: 'mixed' })
    expect(result).toBe(3320)
  })

  it('always rounds to nearest 10', () => {
    const result = computeTDEETwoAxis({ ...base, jobActivity: 'desk', workoutDaysPerWeek: 3, workoutType: 'mixed' })
    expect(result % 10).toBe(0)
  })

  it('more workout days → higher TDEE', () => {
    const three = computeTDEETwoAxis({ ...base, jobActivity: 'desk', workoutDaysPerWeek: 3, workoutType: 'cardio' })
    const five  = computeTDEETwoAxis({ ...base, jobActivity: 'desk', workoutDaysPerWeek: 5, workoutType: 'cardio' })
    expect(five).toBeGreaterThan(three)
  })

  it('physical job > on-feet > desk for same workout load', () => {
    const desk     = computeTDEETwoAxis({ ...base, jobActivity: 'desk',     workoutDaysPerWeek: 3, workoutType: 'mixed' })
    const onFeet   = computeTDEETwoAxis({ ...base, jobActivity: 'on_feet',  workoutDaysPerWeek: 3, workoutType: 'mixed' })
    const physical = computeTDEETwoAxis({ ...base, jobActivity: 'physical', workoutDaysPerWeek: 3, workoutType: 'mixed' })
    expect(onFeet).toBeGreaterThan(desk)
    expect(physical).toBeGreaterThan(onFeet)
  })
})

// ─── computeTDEE ────────────────────────────────────────────────────────────

describe('computeTDEE', () => {
  it('computes maintenance for a sedentary male', () => {
    // BMR = 10*70 + 6.25*175 − 5*30 + 5 = 700 + 1093.75 − 150 + 5 = 1648.75
    // TDEE = 1648.75 × 1.2 = 1978.5 → rounds to 1980
    expect(computeTDEE({ weightKg: 70, heightCm: 175, age: 30, sex: 'male', activityLevel: 'sedentary' })).toBe(1980)
  })

  it('computes maintenance for a sedentary female', () => {
    // BMR = 10*70 + 6.25*175 − 5*30 − 161 = 1482.75
    // TDEE = 1482.75 × 1.2 = 1779.3 → 1780
    expect(computeTDEE({ weightKg: 70, heightCm: 175, age: 30, sex: 'female', activityLevel: 'sedentary' })).toBe(1780)
  })

  it('scales up with higher activity level', () => {
    const sedentary = computeTDEE({ weightKg: 70, heightCm: 175, age: 30, sex: 'male', activityLevel: 'sedentary' })
    const active = computeTDEE({ weightKg: 70, heightCm: 175, age: 30, sex: 'male', activityLevel: 'active' })
    expect(active).toBeGreaterThan(sedentary)
  })

  it('always rounds to the nearest 10 calories', () => {
    const result = computeTDEE({ weightKg: 62, heightCm: 160, age: 25, sex: 'female', activityLevel: 'light' })
    expect(result % 10).toBe(0)
  })

  it('gives a higher result for male than female with identical inputs', () => {
    const male = computeTDEE({ weightKg: 70, heightCm: 175, age: 30, sex: 'male', activityLevel: 'moderate' })
    const female = computeTDEE({ weightKg: 70, heightCm: 175, age: 30, sex: 'female', activityLevel: 'moderate' })
    expect(male).toBeGreaterThan(female)
  })

  it('real-world: 6ft2 (187.96cm), 95kg, 24yo male, moderate → 3120 kcal maintenance', () => {
    // BMR = 10*95 + 6.25*187.96 − 5*24 + 5 = 950 + 1174.75 − 120 + 5 = 2009.75
    // TDEE = 2009.75 × 1.55 = 3115.1 → 3120
    expect(computeTDEE({ weightKg: 95, heightCm: 187.96, age: 24, sex: 'male', activityLevel: 'moderate' })).toBe(3120)
  })
})

// ─── computePacedGoal ───────────────────────────────────────────────────────

describe('computePacedGoal', () => {
  const TDEE = 3120 // our real-world baseline

  it('maintain returns TDEE unchanged for all paces', () => {
    expect(computePacedGoal(TDEE, 'maintain', 'slow')).toBe(TDEE)
    expect(computePacedGoal(TDEE, 'maintain', 'recommended')).toBe(TDEE)
    expect(computePacedGoal(TDEE, 'maintain', 'fast')).toBe(TDEE)
  })

  it('lose slow: 0.25 kg/wk → 275 kcal/day deficit → 2850', () => {
    // 0.25 × 7700 / 7 = 275; 3120 − 275 = 2845 → round to 2850
    expect(computePacedGoal(TDEE, 'lose', 'slow')).toBe(2850)
  })

  it('lose recommended: 0.5 kg/wk → 550 kcal/day deficit → 2570', () => {
    // 0.5 × 7700 / 7 = 550; 3120 − 550 = 2570
    expect(computePacedGoal(TDEE, 'lose', 'recommended')).toBe(2570)
  })

  it('lose fast: 0.75 kg/wk → 825 kcal/day deficit → 2300', () => {
    // 0.75 × 7700 / 7 = 825; 3120 − 825 = 2295 → round to 2300
    expect(computePacedGoal(TDEE, 'lose', 'fast')).toBe(2300)
  })

  it('gain slow: 0.15 kg/wk → 165 kcal/day surplus → 3290', () => {
    // 0.15 × 7700 / 7 = 165; 3120 + 165 = 3285 → round to 3290
    expect(computePacedGoal(TDEE, 'gain', 'slow')).toBe(3290)
  })

  it('gain recommended: 0.25 kg/wk → 275 kcal/day surplus → 3400', () => {
    // 0.25 × 7700 / 7 = 275; 3120 + 275 = 3395 → round to 3400
    expect(computePacedGoal(TDEE, 'gain', 'recommended')).toBe(3400)
  })

  it('gain fast: 0.4 kg/wk → 440 kcal/day surplus → 3560', () => {
    // 0.4 × 7700 / 7 = 440; 3120 + 440 = 3560
    expect(computePacedGoal(TDEE, 'gain', 'fast')).toBe(3560)
  })

  it('result always rounds to nearest 10', () => {
    // Use an odd TDEE to force a non-round intermediate
    expect(computePacedGoal(3000, 'lose', 'slow') % 10).toBe(0)
    expect(computePacedGoal(3050, 'lose', 'recommended') % 10).toBe(0)
    expect(computePacedGoal(2777, 'gain', 'fast') % 10).toBe(0)
  })

  it('lose goal < maintain < gain goal for the same pace', () => {
    const lose = computePacedGoal(TDEE, 'lose', 'recommended')
    const maintain = computePacedGoal(TDEE, 'maintain', 'recommended')
    const gain = computePacedGoal(TDEE, 'gain', 'recommended')
    expect(lose).toBeLessThan(maintain)
    expect(maintain).toBeLessThan(gain)
  })

  it('faster pace → lower goal for lose', () => {
    const slow = computePacedGoal(TDEE, 'lose', 'slow')
    const rec = computePacedGoal(TDEE, 'lose', 'recommended')
    const fast = computePacedGoal(TDEE, 'lose', 'fast')
    expect(fast).toBeLessThan(rec)
    expect(rec).toBeLessThan(slow)
  })

  it('faster pace → higher goal for gain', () => {
    const slow = computePacedGoal(TDEE, 'gain', 'slow')
    const rec = computePacedGoal(TDEE, 'gain', 'recommended')
    const fast = computePacedGoal(TDEE, 'gain', 'fast')
    expect(slow).toBeLessThan(rec)
    expect(rec).toBeLessThan(fast)
  })
})

// ─── clampCalorieGoal / isSafeCalorieGoal ───────────────────────────────────

describe('clampCalorieGoal', () => {
  it('does not change a goal above the safe floor for male', () => {
    expect(clampCalorieGoal(2000, 'male')).toBe(2000)
    expect(clampCalorieGoal(1500, 'male')).toBe(1500) // exactly at floor
  })

  it('clamps a goal below the safe floor for male', () => {
    expect(clampCalorieGoal(1400, 'male')).toBe(MIN_SAFE_CALORIES.male)
    expect(clampCalorieGoal(500, 'male')).toBe(MIN_SAFE_CALORIES.male)
  })

  it('does not change a goal above the safe floor for female', () => {
    expect(clampCalorieGoal(1500, 'female')).toBe(1500)
    expect(clampCalorieGoal(1200, 'female')).toBe(1200) // exactly at floor
  })

  it('clamps a goal below the safe floor for female', () => {
    expect(clampCalorieGoal(1100, 'female')).toBe(MIN_SAFE_CALORIES.female)
  })
})

describe('isSafeCalorieGoal', () => {
  it('returns true at or above the male floor', () => {
    expect(isSafeCalorieGoal(1500, 'male')).toBe(true)
    expect(isSafeCalorieGoal(2000, 'male')).toBe(true)
  })

  it('returns false below the male floor', () => {
    expect(isSafeCalorieGoal(1499, 'male')).toBe(false)
    expect(isSafeCalorieGoal(900, 'male')).toBe(false)
  })

  it('returns true at or above the female floor', () => {
    expect(isSafeCalorieGoal(1200, 'female')).toBe(true)
  })

  it('returns false below the female floor', () => {
    expect(isSafeCalorieGoal(1199, 'female')).toBe(false)
  })
})

// ─── computeTimeline ────────────────────────────────────────────────────────

describe('computeTimeline', () => {
  it('returns null for maintain goal type', () => {
    expect(computeTimeline(95, 80, 'maintain', 'recommended')).toBeNull()
  })

  it('lose, recommended (0.5 kg/wk): 15kg to lose → 30 weeks', () => {
    const result = computeTimeline(95, 80, 'lose', 'recommended')
    expect(result).toEqual({ weeksToGoal: 30, weeklyRateKg: 0.5 })
  })

  it('lose, fast (0.75 kg/wk): 15kg to lose → 20 weeks', () => {
    // ceil(15 / 0.75) = ceil(20) = 20
    const result = computeTimeline(95, 80, 'lose', 'fast')
    expect(result).toEqual({ weeksToGoal: 20, weeklyRateKg: 0.75 })
  })

  it('lose, slow (0.25 kg/wk): 15kg to lose → 60 weeks', () => {
    const result = computeTimeline(95, 80, 'lose', 'slow')
    expect(result).toEqual({ weeksToGoal: 60, weeklyRateKg: 0.25 })
  })

  it('gain, recommended (0.25 kg/wk): 10kg to gain → 40 weeks', () => {
    const result = computeTimeline(70, 80, 'gain', 'recommended')
    expect(result).toEqual({ weeksToGoal: 40, weeklyRateKg: 0.25 })
  })

  it('gain, fast (0.4 kg/wk): 8kg to gain → 20 weeks', () => {
    // ceil(8 / 0.4) = ceil(20) = 20
    const result = computeTimeline(70, 78, 'gain', 'fast')
    expect(result).toEqual({ weeksToGoal: 20, weeklyRateKg: 0.4 })
  })

  it('uses absolute difference (handles target > current for lose input gracefully)', () => {
    // Should still compute a non-negative number of weeks
    const result = computeTimeline(80, 95, 'lose', 'recommended')
    expect(result!.weeksToGoal).toBe(30) // |80-95|=15 same as the canonical case
  })

  it('rounds up partial weeks (ceil)', () => {
    // 7kg at 0.5/wk = 14 exactly; 7.1kg at 0.5/wk = ceil(14.2) = 15
    const exact = computeTimeline(87, 80, 'lose', 'recommended')
    expect(exact!.weeksToGoal).toBe(14)
    const partial = computeTimeline(87.1, 80, 'lose', 'recommended')
    expect(partial!.weeksToGoal).toBe(15)
  })
})

// ─── suggestProteinGoal ─────────────────────────────────────────────────────

describe('suggestProteinGoal', () => {
  it('lose: 2.0g/kg → 190g for 95kg', () => {
    expect(suggestProteinGoal(95, 'lose')).toBe(190)
  })

  it('maintain: 1.6g/kg → 152g for 95kg', () => {
    expect(suggestProteinGoal(95, 'maintain')).toBe(152)
  })

  it('gain: 1.8g/kg → 171g for 95kg', () => {
    expect(suggestProteinGoal(95, 'gain')).toBe(171)
  })

  it('rounds to nearest whole gram', () => {
    // 72kg × 2.0 = 144 exactly
    expect(suggestProteinGoal(72, 'lose')).toBe(144)
    // 73kg × 1.6 = 116.8 → 117
    expect(suggestProteinGoal(73, 'maintain')).toBe(117)
  })

  it('lose goal is higher than gain which is higher than maintain (muscle retention priority)', () => {
    const lose = suggestProteinGoal(80, 'lose')
    const gain = suggestProteinGoal(80, 'gain')
    const maintain = suggestProteinGoal(80, 'maintain')
    expect(lose).toBeGreaterThan(gain)
    expect(gain).toBeGreaterThan(maintain)
  })
})

// ─── suggestCalorieGoal (convenience wrapper) ───────────────────────────────

describe('suggestCalorieGoal', () => {
  const baseInputs = { weightKg: 70, heightCm: 175, age: 30, sex: 'male' as const, activityLevel: 'moderate' as const }

  it('returns tdee and goal as separate values', () => {
    const { tdee, goal } = suggestCalorieGoal(baseInputs, 'maintain')
    expect(tdee).toBeGreaterThan(0)
    expect(goal).toBe(tdee)
  })

  it('lose goal is below TDEE', () => {
    const { tdee, goal } = suggestCalorieGoal(baseInputs, 'lose')
    expect(goal).toBeLessThan(tdee)
  })

  it('gain goal is above TDEE', () => {
    const { tdee, goal } = suggestCalorieGoal(baseInputs, 'gain')
    expect(goal).toBeGreaterThan(tdee)
  })

  it('real-world: 6ft2, 95kg, 24M moderate + lose → tdee=3120, goal=2570', () => {
    const { tdee, goal } = suggestCalorieGoal(
      { weightKg: 95, heightCm: 187.96, age: 24, sex: 'male', activityLevel: 'moderate' },
      'lose',
    )
    expect(tdee).toBe(3120)
    expect(goal).toBe(2570) // 3120 − 550 (0.5kg/wk × 7700/7)
  })
})

// ─── PACE_RATES sanity checks ────────────────────────────────────────────────

describe('PACE_RATES', () => {
  it('lose: fast > recommended > slow', () => {
    expect(PACE_RATES.lose.fast).toBeGreaterThan(PACE_RATES.lose.recommended)
    expect(PACE_RATES.lose.recommended).toBeGreaterThan(PACE_RATES.lose.slow)
  })

  it('gain: fast > recommended > slow', () => {
    expect(PACE_RATES.gain.fast).toBeGreaterThan(PACE_RATES.gain.recommended)
    expect(PACE_RATES.gain.recommended).toBeGreaterThan(PACE_RATES.gain.slow)
  })

  it('maintain rates are all zero', () => {
    expect(PACE_RATES.maintain.slow).toBe(0)
    expect(PACE_RATES.maintain.recommended).toBe(0)
    expect(PACE_RATES.maintain.fast).toBe(0)
  })
})
