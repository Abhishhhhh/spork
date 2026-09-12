import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { GoalType, Pace, ActivityLevel } from '../lib/calorieGoal'

export type PrivacyDefault = 'public' | 'private'
export type WorkoutType = 'strength' | 'cardio' | 'mixed' | 'none'
export type DietaryPattern = 'no_restrictions' | 'vegetarian' | 'vegan' | 'other'
export type MealPrepTime = 'quick' | 'moderate' | 'enjoys_cooking'
export type TrackedBefore = 'yes' | 'tried' | 'no'

interface OnboardingState {
  // Step 1: Profile
  name: string
  username: string
  avatarFile: File | null

  // Step 2: Basics
  heightCm: number | null
  weightKg: number | null
  age: number | null
  sex: 'male' | 'female'

  // Step 3: Goal
  goalType: GoalType
  targetWeightKg: number | null
  pace: Pace

  // Step 4: Activity
  activityLevel: ActivityLevel
  workoutDaysPerWeek: number
  workoutType: WorkoutType

  // Computed (set by Activity screen once all inputs are known)
  calorieGoal: number | null
  proteinGoal: number | null

  // Step 5: Food & Lifestyle
  mealPrepTime: MealPrepTime
  mealsPerDay: number
  dietaryPattern: DietaryPattern
  allergies: string
  sleepHours: number

  // Step 6: Experience
  trackedBefore: TrackedBefore | null
  trackingChallenges: string[]

  // Step 7: Privacy
  privacyDefault: PrivacyDefault

  // Step 8: Friends
  friendUsernamesToRequest: string[]

  // ── Actions ──────────────────────────────────────────────────────────────
  setProfile: (f: { name: string; username: string; avatarFile: File | null }) => void
  setBasics: (f: { heightCm: number; weightKg: number; age: number; sex: 'male' | 'female' }) => void
  setGoal: (f: { goalType: GoalType; targetWeightKg: number | null; pace: Pace }) => void
  setActivity: (f: {
    activityLevel: ActivityLevel
    workoutDaysPerWeek: number
    workoutType: WorkoutType
    calorieGoal: number
    proteinGoal: number
  }) => void
  setFoodLifestyle: (f: {
    mealPrepTime: MealPrepTime
    mealsPerDay: number
    dietaryPattern: DietaryPattern
    allergies: string
    sleepHours: number
  }) => void
  setExperience: (f: { trackedBefore: TrackedBefore; trackingChallenges: string[] }) => void
  setPrivacyDefault: (value: PrivacyDefault) => void
  addFriendUsername: (username: string) => void
  // Legacy setters (AddFirstFriends still reads calorieGoal directly)
  setCalorieGoal: (goal: number) => void
  setGoalSelection: (f: {
    goalType: GoalType
    targetWeightKg: number | null
    pace: Pace
    calorieGoal: number
    proteinGoal: number
  }) => void
  setBodyStats: (f: { weightKg: number; sex: 'male' | 'female' }) => void
  reset: () => void
}

const initialState = {
  // Profile
  name: '',
  username: '',
  avatarFile: null as File | null,
  // Basics
  heightCm: null as number | null,
  weightKg: null as number | null,
  age: null as number | null,
  sex: 'male' as 'male' | 'female',
  // Goal
  goalType: 'lose' as GoalType,
  targetWeightKg: null as number | null,
  pace: 'recommended' as Pace,
  // Activity
  activityLevel: 'moderate' as ActivityLevel,
  workoutDaysPerWeek: 3,
  workoutType: 'mixed' as WorkoutType,
  // Computed
  calorieGoal: null as number | null,
  proteinGoal: null as number | null,
  // Food & Lifestyle
  mealPrepTime: 'moderate' as MealPrepTime,
  mealsPerDay: 3,
  dietaryPattern: 'no_restrictions' as DietaryPattern,
  allergies: '',
  sleepHours: 7,
  // Experience
  trackedBefore: null as TrackedBefore | null,
  trackingChallenges: [] as string[],
  // Privacy
  privacyDefault: 'public' as PrivacyDefault,
  // Friends
  friendUsernamesToRequest: [] as string[],
}

export const useOnboardingStore = create<OnboardingState>()(persist((set) => ({
  ...initialState,
  setProfile: (f) => set(f),
  setBasics: (f) => set(f),
  setGoal: (f) => set(f),
  setActivity: (f) =>
    set({
      activityLevel: f.activityLevel,
      workoutDaysPerWeek: f.workoutDaysPerWeek,
      workoutType: f.workoutType,
      calorieGoal: f.calorieGoal,
      proteinGoal: f.proteinGoal,
    }),
  setFoodLifestyle: (f) => set(f),
  setExperience: (f) =>
    set({ trackedBefore: f.trackedBefore, trackingChallenges: f.trackingChallenges }),
  setPrivacyDefault: (value) => set({ privacyDefault: value }),
  addFriendUsername: (username) =>
    set((s) => ({ friendUsernamesToRequest: [...s.friendUsernamesToRequest, username] })),
  // Legacy setters — kept so AddFirstFriends compiles without changes
  setCalorieGoal: (goal) => set({ calorieGoal: goal }),
  setGoalSelection: (f) =>
    set({
      goalType: f.goalType,
      targetWeightKg: f.targetWeightKg,
      pace: f.pace,
      calorieGoal: f.calorieGoal,
      proteinGoal: f.proteinGoal,
    }),
  setBodyStats: (f) => set(f),
  reset: () => set(initialState),
}), {
  name: 'spork-onboarding-v1',
  version: 1,
  storage: createJSONStorage(() => localStorage),
  // Browser File objects cannot survive JSON. Never restore a fake File.
  partialize: (state) => Object.fromEntries(
    Object.entries(state).filter(([key, value]) => key !== 'avatarFile' && typeof value !== 'function'),
  ),
}))
