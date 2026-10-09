/** Water tracking helpers: glasses shown on the Home card. */
export const DEFAULT_WATER_GOAL_ML = 2500
export const DEFAULT_GLASS_ML = 250
export const GLASS_SIZES = [200, 250, 330, 500] as const
/** 1.0 L – 5.0 L in 250 ml steps, for the goal wheel. */
export const WATER_GOALS = Array.from({ length: 17 }, (_, i) => 1000 + i * 250)
const MAX_SLOTS = 12

/**
 * How many glass icons to draw and how many are full. Normally one icon per
 * glass; with a big goal or small glass the icons are capped at 12 and each
 * one stands for an equal share of the goal.
 */
export function waterGlasses(ml: number, goalMl: number, glassMl: number) {
  const exact = Math.max(1, Math.round(goalMl / glassMl))
  const slots = Math.min(MAX_SLOTS, exact)
  const perSlot = exact > MAX_SLOTS ? goalMl / slots : glassMl
  const filled = Math.min(slots, Math.floor((ml + 0.5) / perSlot))
  return { slots, filled, perSlot }
}

/** Tapping glass `index`: fill up to it, or — on the last full glass — empty that one. */
export function mlAfterGlassTap(index: number, ml: number, goalMl: number, glassMl: number): number {
  const { filled, perSlot } = waterGlasses(ml, goalMl, glassMl)
  const target = index === filled - 1 ? index * perSlot : (index + 1) * perSlot
  return Math.max(0, Math.round(target))
}

export function formatLitres(ml: number): string {
  const l = ml / 1000
  return `${Number.isInteger(l) ? l.toFixed(1) : l.toFixed(2).replace(/0$/, '')}`
}
