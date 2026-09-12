import { create } from 'zustand'
import type { ParsedEstimate } from '../lib/parseEstimate'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type Visibility = 'public' | 'private'
export type Satiety = 'loved_it' | 'good' | 'okay' | 'not_great'

export interface EstimateResult {
  parsed: ParsedEstimate
  raw: unknown
}

/**
 * Pulls a sensible default meal name from the AI's items array.
 * Uses the first item name, falling back to '' on any unexpected shape.
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
  description: string           // AI description / accuracy hint
  caption: string               // social caption shown on feed
  estimate: EstimateResult | null
  /** Portion multiplier applied on top of estimate (0.5 / 1 / 1.5 / 2) */
  portionMultiplier: number
  mealName: string
  calories: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  mealType: MealType
  visibility: Visibility
  satiety: Satiety | null

  setPhoto: (file: File) => void
  setDescription: (value: string) => void
  setCaption: (value: string) => void
  applyEstimate: (estimate: EstimateResult | null, mealType: MealType, visibility: Visibility) => void
  setPortionMultiplier: (multiplier: number) => void
  setMealName: (value: string) => void
  setField: (field: 'calories' | 'proteinG' | 'carbsG' | 'fatG', value: number | null) => void
  setMealType: (value: MealType) => void
  setVisibility: (value: Visibility) => void
  setSatiety: (value: Satiety | null) => void
  reset: () => void
}

const initialState = {
  photoFile: null as File | null,
  description: '',
  caption: '',
  estimate: null as EstimateResult | null,
  portionMultiplier: 1,
  mealName: '',
  calories: null as number | null,
  proteinG: null as number | null,
  carbsG: null as number | null,
  fatG: null as number | null,
  mealType: 'snack' as MealType,
  visibility: 'public' as Visibility,
  satiety: null as Satiety | null,
}

export const useLogDraftStore = create<LogDraftState>((set, get) => ({
  ...initialState,

  setPhoto: (file) => set({ photoFile: file }),
  setDescription: (value) => set({ description: value }),
  setCaption: (value) => set({ caption: value }),

  applyEstimate: (estimate, mealType, visibility) =>
    set({
      estimate,
      mealType,
      visibility,
      portionMultiplier: 1,
      mealName: defaultMealNameFromRaw(estimate?.raw),
      calories: estimate?.parsed.calories ?? null,
      proteinG: estimate?.parsed.protein_g ?? null,
      carbsG: estimate?.parsed.carbs_g ?? null,
      fatG: estimate?.parsed.fat_g ?? null,
    }),

  setPortionMultiplier: (multiplier) => {
    const { estimate } = get()
    if (!estimate) {
      set({ portionMultiplier: multiplier })
      return
    }
    // Scale all macros from the original estimate
    set({
      portionMultiplier: multiplier,
      calories: Math.round(estimate.parsed.calories * multiplier),
      proteinG: Math.round(estimate.parsed.protein_g * multiplier),
      carbsG: Math.round(estimate.parsed.carbs_g * multiplier),
      fatG: Math.round(estimate.parsed.fat_g * multiplier),
    })
  },

  setMealName: (value) => set({ mealName: value }),
  setField: (field, value) => set({ [field]: value === null ? null : Math.max(0, Math.round(value)) }),
  setMealType: (value) => set({ mealType: value }),
  setVisibility: (value) => set({ visibility: value }),
  setSatiety: (value) => set({ satiety: value }),
  reset: () => set(initialState),
}))
