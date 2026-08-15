import { describe, expect, it } from 'vitest'
import { parseEstimateResponse } from './parseEstimate'

describe('parseEstimateResponse', () => {
  const valid = { calories: 542.4, protein_g: 30.1, carbs_g: 60.9, fat_g: 12.2, confidence: 'medium' }

  it('parses and rounds a valid response', () => {
    expect(parseEstimateResponse(valid)).toEqual({
      calories: 542,
      protein_g: 30,
      carbs_g: 61,
      fat_g: 12,
      confidence: 'medium',
    })
  })

  it('returns null when a required field is missing', () => {
    const { calories: _calories, ...rest } = valid
    expect(parseEstimateResponse(rest)).toBeNull()
  })

  it('returns null when a numeric field has the wrong type', () => {
    expect(parseEstimateResponse({ ...valid, calories: '542' })).toBeNull()
  })

  it('returns null for a negative value', () => {
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
