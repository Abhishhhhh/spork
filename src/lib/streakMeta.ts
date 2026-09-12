export interface StreakMeta {
  nextMilestone: number | null
  daysToMilestone: number | null
  milestoneProgress: number   // 0–1 clamped
  prevMilestone: number
}

const MILESTONES = [7, 30, 100] as const

/**
 * Derives display metadata from a raw streak count.
 * Pure — no I/O, safe to call anywhere.
 */
export function computeStreakMeta(streak: number): StreakMeta {
  const next = MILESTONES.find((m) => m > streak) ?? null
  const prev = [...MILESTONES].filter((m) => m <= streak).at(-1) ?? 0

  if (next === null) {
    return { nextMilestone: null, daysToMilestone: null, milestoneProgress: 1, prevMilestone: prev }
  }

  const range = next - prev
  const done  = streak - prev
  return {
    nextMilestone: next,
    daysToMilestone: next - streak,
    milestoneProgress: range > 0 ? done / range : 0,
    prevMilestone: prev,
  }
}

export const MILESTONE_LABELS: Record<number, string> = {
  7:   '7-day',
  30:  '30-day',
  100: '100-day',
}
