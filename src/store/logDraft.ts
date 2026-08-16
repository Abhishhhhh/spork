import { create } from 'zustand'
import type { ParsedEstimate } from '../lib/parseEstimate'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type Visibility = 'public' | 'private'

export interface EstimateResult {
  parsed: ParsedEstimate
  raw: unknown
}

/**
 * Pulls a sensible default meal name out of the AI's raw response —
 * `estimate-meal`'s prompt asks Gemini for an `items` array of
 * `{ name, calories, ... }`; the raw response's shape isn't otherwise
 * typed (it's `unknown` all the way through, per parseEstimate.ts's own
 * reasoning), so this reads defensively and falls back to '' rather than
 * ever throwing on an unexpected shape.
 */
function defaultMealNameFromRaw(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null) return ''
  const items = (raw as Record<string, unknown>).items
  if (!Array.isArray(items) || items.length === 0) return ''
  const first = items[0]
  if (typeof first !== 'object' || first === null) return ''
  const name = (first as Record<string, unknown>).name
  return typeof name === 'string' ? name : ''
}

interface LogDraftState {
  photoFile: File | null
  description: string
  estimate: EstimateResult | null
  mealName: string
  calories: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  mealType: MealType
  visibility: Visibility
  setPhoto: (file: File) => void
  setDescription: (value: string) => void
  applyEstimate: (estimate: EstimateResult | null, mealType: MealType, visibility: Visibility) => void
  setMealName: (value: string) => void
  setField: (field: 'calories' | 'proteinG' | 'carbsG' | 'fatG', value: number | null) => void
  setMealType: (value: MealType) => void
  setVisibility: (value: Visibility) => void
  reset: () => void
}

const initialState = {
  photoFile: null as File | null,
  description: '',
  estimate: null as EstimateResult | null,
  mealName: '',
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
      mealName: defaultMealNameFromRaw(estimate?.raw),
      calories: estimate?.parsed.calories ?? null,
      proteinG: estimate?.parsed.protein_g ?? null,
      carbsG: estimate?.parsed.carbs_g ?? null,
      fatG: estimate?.parsed.fat_g ?? null,
    }),
  setMealName: (value) => set({ mealName: value }),
  setField: (field, value) => set({ [field]: value === null ? null : Math.max(0, Math.round(value)) }),
  setMealType: (value) => set({ mealType: value }),
  setVisibility: (value) => set({ visibility: value }),
  reset: () => set(initialState),
}))
