export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type Sex = 'male' | 'female'
export type GoalType = 'lose' | 'maintain' | 'gain'
export type Pace = 'slow' | 'recommended' | 'fast'

// ── Two-axis activity model ─────────────────────────────────────────────────
// Daily job activity + separate workout frequency/type, combined into a
// single TDEE multiplier. More accurate than the classic single-axis model.
export type JobActivity = 'desk' | 'on_feet' | 'physical'
export type WorkoutType = 'none' | 'cardio' | 'strength' | 'mixed'

/** Base multipliers for daily non-workout activity (job + life). */
const JOB_MULTIPLIERS: Record<JobActivity, number> = {
  desk:     1.2,   // mostly sitting, minimal walking
  on_feet:  1.375, // standing/retail/teacher — light constant movement
  physical: 1.55,  // construction, warehouse, manual labour
}

/**
 * Additional kcal burned per workout session by type (~60 min, moderate intensity).
 * Added on top of job multiplier: TDEE = BMR × jobMult + workoutDays × kcal/session / 7
 */
const WORKOUT_KCAL_PER_SESSION: Record<WorkoutType, number> = {
  none:     0,
  cardio:   400,
  strength: 300,
  mixed:    350,
}

export interface TwoAxisActivityInputs {
  weightKg: number
  heightCm: number
  age: number
  sex: Sex
  jobActivity: JobActivity
  workoutDaysPerWeek: number   // 0–7
  workoutType: WorkoutType
}

/**
 * Two-axis TDEE: job/daily activity multiplier + explicit workout calories.
 *   TDEE = BMR × jobMultiplier + (workoutDays × kcalPerSession / 7)
 * Rounded to nearest 10 kcal.
 */
export function computeTDEETwoAxis(inputs: TwoAxisActivityInputs): number {
  const { weightKg, heightCm, age, sex, jobActivity, workoutDaysPerWeek, workoutType } = inputs
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + SEX_CONSTANTS[sex]
  const baseTdee = bmr * JOB_MULTIPLIERS[jobActivity]
  const workoutKcal = (workoutDaysPerWeek * WORKOUT_KCAL_PER_SESSION[workoutType]) / 7
  return Math.round((baseTdee + workoutKcal) / 10) * 10
}

export interface CalorieGoalInputs {
  weightKg: number
  heightCm: number
  age: number
  sex: Sex
  activityLevel: ActivityLevel
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

const SEX_CONSTANTS: Record<Sex, number> = {
  male: 5,
  female: -161,
}

/**
 * Minimum safe daily calories per sex (established clinical guidelines).
 * Paced goals are clamped to this floor and a UI warning is shown when hit.
 */
export const MIN_SAFE_CALORIES: Record<Sex, number> = {
  male: 1500,
  female: 1200,
}

/**
 * Weekly body-mass change rates (kg/week) for each goal + pace combination.
 * Derived from the 7700 kcal/kg fat conversion — these are the rates the
 * daily-delta calculations below target exactly.
 */
export const PACE_RATES: Record<GoalType, Record<Pace, number>> = {
  lose:     { slow: 0.25, recommended: 0.5,  fast: 0.75 },
  maintain: { slow: 0,    recommended: 0,    fast: 0    },
  gain:     { slow: 0.15, recommended: 0.25, fast: 0.4  },
}

const KCAL_PER_KG = 7700

/**
 * Protein multipliers (g per kg current bodyweight).
 * Lose: 2.0g — higher to preserve lean mass on a deficit.
 * Gain: 1.8g — supports muscle synthesis on a lean bulk.
 * Maintain: 1.6g — general health baseline.
 */
const PROTEIN_MULTIPLIERS: Record<GoalType, number> = {
  lose:     2.0,
  maintain: 1.6,
  gain:     1.8,
}

/**
 * Computes TDEE (Total Daily Energy Expenditure) = maintenance calories.
 * Mifflin-St Jeor BMR formula:
 *   BMR = 10*weightKg + 6.25*heightCm − 5*age + (5 male / −161 female)
 *   TDEE = BMR × activity multiplier
 * Result rounded to nearest 10 kcal.
 */
export function computeTDEE(inputs: CalorieGoalInputs): number {
  const { weightKg, heightCm, age, sex, activityLevel } = inputs
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + SEX_CONSTANTS[sex]
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel]
  return Math.round(tdee / 10) * 10
}

/**
 * Computes the daily calorie goal for a given TDEE, goal type, and pace.
 * The daily deficit/surplus is derived from the pace's weekly rate:
 *   daily_delta = weeklyRateKg × 7700 kcal/kg / 7 days
 * Returns the raw (unclamped) result — call clampCalorieGoal() before
 * persisting, and isSafeCalorieGoal() to decide whether to show a warning.
 */
export function computePacedGoal(tdee: number, goalType: GoalType, pace: Pace): number {
  if (goalType === 'maintain') return tdee
  const weeklyRateKg = PACE_RATES[goalType][pace]
  const dailyDelta = Math.round((weeklyRateKg * KCAL_PER_KG) / 7)
  const raw = goalType === 'lose' ? tdee - dailyDelta : tdee + dailyDelta
  return Math.round(raw / 10) * 10
}

/**
 * Clamps a calorie goal to the minimum safe floor for the given sex.
 * Always call this before persisting/displaying the final goal number.
 */
export function clampCalorieGoal(goal: number, sex: Sex): number {
  return Math.max(goal, MIN_SAFE_CALORIES[sex])
}

/** Returns false when the computed goal falls below the safe floor. */
export function isSafeCalorieGoal(goal: number, sex: Sex): boolean {
  return goal >= MIN_SAFE_CALORIES[sex]
}

/**
 * Computes weeks to reach target weight at a given pace.
 * Returns null for the maintain goal type (no target change).
 */
export function computeTimeline(
  currentWeightKg: number,
  targetWeightKg: number,
  goalType: GoalType,
  pace: Pace,
): { weeksToGoal: number; weeklyRateKg: number } | null {
  if (goalType === 'maintain') return null
  const weeklyRateKg = PACE_RATES[goalType][pace]
  if (weeklyRateKg === 0) return null
  const delta = Math.abs(currentWeightKg - targetWeightKg)
  const weeksToGoal = Math.ceil(delta / weeklyRateKg)
  return { weeksToGoal, weeklyRateKg }
}

/**
 * Suggests a daily protein target (grams) based on current bodyweight and goal.
 * Rounded to the nearest whole gram.
 */
export function suggestProteinGoal(currentWeightKg: number, goalType: GoalType): number {
  return Math.round(currentWeightKg * PROTEIN_MULTIPLIERS[goalType])
}

/**
 * Convenience: computes TDEE + applies a goal-type adjustment at
 * 'recommended' pace. Used by legacy tests and as a quick TDEE+goal pair.
 */
export function suggestCalorieGoal(
  inputs: CalorieGoalInputs,
  goalType: GoalType,
): { tdee: number; goal: number } {
  const tdee = computeTDEE(inputs)
  const goal = computePacedGoal(tdee, goalType, 'recommended')
  return { tdee, goal }
}
