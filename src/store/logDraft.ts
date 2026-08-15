import { create } from 'zustand'
import type { ParsedEstimate } from '../lib/parseEstimate'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type Visibility = 'public' | 'private'

export interface EstimateResult {
  parsed: ParsedEstimate
  raw: unknown
}

interface LogDraftState {
  photoFile: File | null
  description: string
  estimate: EstimateResult | null
  calories: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  mealType: MealType
  visibility: Visibility
  setPhoto: (file: File) => void
  setDescription: (value: string) => void
  applyEstimate: (estimate: EstimateResult | null, mealType: MealType, visibility: Visibility) => void
  setField: (field: 'calories' | 'proteinG' | 'carbsG' | 'fatG', value: number | null) => void
  setMealType: (value: MealType) => void
  setVisibility: (value: Visibility) => void
  reset: () => void
}

const initialState = {
  photoFile: null as File | null,
  description: '',
  estimate: null as EstimateResult | null,
  calories: null as number | null,
  proteinG: null as number | null,
  carbsG: null as number | null,
  fatG: null as number | null,
  mealType: 'snack' as MealType,
  visibility: 'public' as Visibility,
}

export const useLogDraftStore = create<LogDraftState>((set) => ({
  ...initialState,
  setPhoto: (file) => set({ photoFile: file }),
  setDescription: (value) => set({ description: value }),
  applyEstimate: (estimate, mealType, visibility) =>
    set({
      estimate,
      mealType,
      visibility,
      calories: estimate?.parsed.calories ?? null,
      proteinG: estimate?.parsed.protein_g ?? null,
      carbsG: estimate?.parsed.carbs_g ?? null,
      fatG: estimate?.parsed.fat_g ?? null,
    }),
  setField: (field, value) => set({ [field]: value }),
  setMealType: (value) => set({ mealType: value }),
  setVisibility: (value) => set({ visibility: value }),
  reset: () => set(initialState),
}))
