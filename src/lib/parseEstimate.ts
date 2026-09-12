export interface ParsedEstimateItem {
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface ParsedEstimate {
  items: ParsedEstimateItem[]
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  confidence: 'low' | 'medium' | 'high'
}

const CONFIDENCE_LEVELS = new Set(['low', 'medium', 'high'])

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function parseItems(raw: unknown): ParsedEstimateItem[] {
  if (!Array.isArray(raw)) return []
  const items: ParsedEstimateItem[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const { name, calories, protein_g, carbs_g, fat_g } = item as Record<string, unknown>
    if (
      typeof name !== 'string' ||
      !isFiniteNonNegativeNumber(calories) ||
      !isFiniteNonNegativeNumber(protein_g) ||
      !isFiniteNonNegativeNumber(carbs_g) ||
      !isFiniteNonNegativeNumber(fat_g)
    ) continue
    items.push({
      name,
      calories: Math.round(calories),
      protein_g: Math.round(protein_g),
      carbs_g: Math.round(carbs_g),
      fat_g: Math.round(fat_g),
    })
  }
  return items
}

/**
 * Validates/normalizes whatever the estimate-meal Edge Function returned.
 * Returns null on anything malformed. Items array is parsed leniently —
 * a malformed item is silently skipped, not used to invalidate the whole response.
 */
export function parseEstimateResponse(raw: unknown): ParsedEstimate | null {
  if (typeof raw !== 'object' || raw === null) return null

  const { calories, protein_g, carbs_g, fat_g, confidence, items } = raw as Record<string, unknown>

  if (
    !isFiniteNonNegativeNumber(calories) ||
    !isFiniteNonNegativeNumber(protein_g) ||
    !isFiniteNonNegativeNumber(carbs_g) ||
    !isFiniteNonNegativeNumber(fat_g) ||
    typeof confidence !== 'string' ||
    !CONFIDENCE_LEVELS.has(confidence)
  ) {
    return null
  }

  return {
    items: parseItems(items),
    calories: Math.round(calories),
    protein_g: Math.round(protein_g),
    carbs_g: Math.round(carbs_g),
    fat_g: Math.round(fat_g),
    confidence: confidence as 'low' | 'medium' | 'high',
  }
}
