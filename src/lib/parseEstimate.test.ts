import { describe, expect, it } from 'vitest'
import { parseEstimateResponse } from './parseEstimate'

describe('parseEstimateResponse', () => {
  const validItem = { name: 'Rice', calories: 200, protein_g: 4, carbs_g: 45, fat_g: 0.5 }
  const valid = {
    items: [validItem],
    calories: 542.4,
    protein_g: 30.1,
    carbs_g: 60.9,
    fat_g: 12.2,
    confidence: 'medium',
  }

  it('parses and rounds a valid response including items', () => {
    const result = parseEstimateResponse(valid)
    expect(result).toEqual({
      items: [{ name: 'Rice', calories: 200, protein_g: 4, carbs_g: 45, fat_g: 1 }],
      calories: 542,
      protein_g: 30,
      carbs_g: 61,
      fat_g: 12,
      confidence: 'medium',
    })
  })

  it('returns empty items array when items field is absent', () => {
    const { items: _items, ...noItems } = valid
    const result = parseEstimateResponse(noItems)
    expect(result).not.toBeNull()
    expect(result!.items).toEqual([])
  })

  it('skips malformed items but keeps well-formed ones', () => {
    const raw = {
      ...valid,
      items: [
        validItem,
        { name: 'Bad', calories: 'oops', protein_g: 4, carbs_g: 20, fat_g: 2 }, // bad
        { name: 'Good', calories: 100, protein_g: 5, carbs_g: 10, fat_g: 3 },
      ],
    }
    const result = parseEstimateResponse(raw)
    expect(result).not.toBeNull()
    expect(result!.items).toHaveLength(2)
    expect(result!.items[0].name).toBe('Rice')
    expect(result!.items[1].name).toBe('Good')
  })

  it('returns null when a top-level required field is missing', () => {
    const { calories: _calories, ...rest } = valid
    expect(parseEstimateResponse(rest)).toBeNull()
  })

  it('returns null when a numeric field has the wrong type', () => {
    expect(parseEstimateResponse({ ...valid, calories: '542' })).toBeNull()
  })

  it('returns null for a negative top-level value', () => {
    expect(parseEstimateResponse({ ...valid, protein_g: -5 })).toBeNull()
  })

  it('returns null for an invalid confidence string', () => {
    expect(parseEstimateResponse({ ...valid, confidence: 'very high' })).toBeNull()
  })

  it('returns null for null input', () => {
    expect(parseEstimateResponse(null)).toBeNull()
  })

  it('returns null for a non-object input', () => {
    expect(parseEstimateResponse('not an object')).toBeNull()
  })
})
