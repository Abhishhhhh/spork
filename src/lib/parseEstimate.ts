export interface ParsedEstimate {
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

/**
 * Validates/normalizes whatever the estimate-meal Edge Function returned.
 * Returns null on anything malformed — that's what triggers the Log
 * flow's fallback to blank manual-entry fields (spec §6); the log is
 * never blocked by a bad or missing AI response. This is the ONLY place
 * the response shape is validated — the Edge Function itself (Task 3)
 * only checks that Gemini's text is parseable JSON, not that it matches
 * this shape, to avoid duplicating validation logic across two runtimes.
 */
export function parseEstimateResponse(raw: unknown): ParsedEstimate | null {
  if (typeof raw !== 'object' || raw === null) return null

  const { calories, protein_g, carbs_g, fat_g, confidence } = raw as Record<string, unknown>

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
    calories: Math.round(calories),
    protein_g: Math.round(protein_g),
    carbs_g: Math.round(carbs_g),
    fat_g: Math.round(fat_g),
    confidence: confidence as 'low' | 'medium' | 'high',
  }
}
