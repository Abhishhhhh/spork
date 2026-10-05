/** Metric / imperial helpers. Everything is stored in cm and kg; this is display only. */
export type Units = 'metric' | 'imperial'

const KEY = 'spork-units'
const LB_PER_KG = 2.20462

export function loadUnits(): Units {
  try { return localStorage.getItem(KEY) === 'imperial' ? 'imperial' : 'metric' } catch { return 'metric' }
}

export function saveUnits(units: Units) {
  try { localStorage.setItem(KEY, units) } catch { /* private mode — per-session only */ }
}

export function cmToFeetInches(cm: number): { ft: number; inch: number } {
  const totalIn = Math.round(cm / 2.54)
  return { ft: Math.floor(totalIn / 12), inch: totalIn % 12 }
}

export const feetInchesToCm = (ft: number, inch: number) => Math.round((ft * 12 + inch) * 2.54)
export const kgToLb = (kg: number) => Math.round(kg * LB_PER_KG)
export const lbToKg = (lb: number) => Math.round((lb / LB_PER_KG) * 10) / 10
