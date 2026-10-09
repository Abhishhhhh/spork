import { describe, expect, it } from 'vitest'
import { formatLitres, mlAfterGlassTap, waterGlasses } from './water'

describe('waterGlasses', () => {
  it('draws one icon per glass', () => {
    expect(waterGlasses(1250, 2500, 250)).toMatchObject({ slots: 10, filled: 5 })
    expect(waterGlasses(3000, 2500, 250).filled).toBe(10)
  })
  it('caps at 12 icons for big goals', () => {
    expect(waterGlasses(2000, 4000, 200)).toMatchObject({ slots: 12, filled: 6 })
  })
})

describe('mlAfterGlassTap', () => {
  it('fills up to the tapped glass, or empties the last full one', () => {
    expect(mlAfterGlassTap(7, 1250, 2500, 250)).toBe(2000)
    expect(mlAfterGlassTap(4, 1250, 2500, 250)).toBe(1000)
    expect(mlAfterGlassTap(0, 0, 2500, 250)).toBe(250)
  })
})

describe('formatLitres', () => {
  it('shows litres', () => {
    expect([formatLitres(1250), formatLitres(2500), formatLitres(2000), formatLitres(750)]).toEqual(['1.25', '2.5', '2.0', '0.75'])
  })
})
