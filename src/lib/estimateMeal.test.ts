import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }))

const { estimateMeal } = await import('./estimateMeal')

const reply = {
  items: [{ name: 'Roti', quantity: '2 medium rotis', grams: 80, calories: 240, protein_g: 8, carbs_g: 44, fat_g: 4, confidence: 'high' }],
  calories: 240, protein_g: 8, carbs_g: 44, fat_g: 4, confidence: 'high', assumptions: [],
}

beforeEach(() => invoke.mockReset())

describe('estimateMeal — log by typing', () => {
  it('sends the description in text mode, with no photo', async () => {
    invoke.mockResolvedValue({ data: reply, error: null })
    const result = await estimateMeal(null, '2 rotis')
    expect(invoke).toHaveBeenCalledWith('estimate-meal', { body: { description: '2 rotis', mode: 'text' } })
    expect(result?.parsed.calories).toBe(240)
  })

  it('passes corrected items through on Recalculate', async () => {
    invoke.mockResolvedValue({ data: reply, error: null })
    await estimateMeal(null, '2 rotis', [{ name: 'Roti', quantity: '3' }])
    expect(invoke.mock.calls[0][1].body).toEqual({ description: '2 rotis', mode: 'text', confirmedItems: [{ name: 'Roti', quantity: '3' }] })
  })

  it('does not call the AI with neither a photo nor text', async () => {
    expect(await estimateMeal(null, '   ')).toBeNull()
    expect(invoke).not.toHaveBeenCalled()
  })
})
