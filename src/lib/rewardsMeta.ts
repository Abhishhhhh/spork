export interface RawReward {
  id: string
  partner_name: string
  offer_description: string
  milestone_required: number
  expiry_date: string | null
}

export interface RawRedemption {
  reward_id: string
  code: string
  redeemed_at: string
  status: string
}

export interface EnrichedReward extends RawReward {
  isUnlocked: boolean
  isRedeemed: boolean
  isExpired: boolean
  redemptionCode: string | null
}

/**
 * Pure enrichment — no I/O. Takes the raw DB rows and derives display state.
 * `today` is injected so tests can control date without mocking.
 */
export function enrichReward(
  reward: RawReward,
  currentStreak: number,
  redemptions: RawRedemption[],
  today: Date,
): EnrichedReward {
  const isUnlocked = currentStreak >= reward.milestone_required
  const redemption = redemptions.find((r) => r.reward_id === reward.id) ?? null
  const isRedeemed = redemption !== null

  let isExpired = false
  if (reward.expiry_date) {
    // Compare date strings lexicographically — works for ISO yyyy-mm-dd
    const todayStr = today.toISOString().slice(0, 10)
    isExpired = reward.expiry_date < todayStr
  }

  return {
    ...reward,
    isUnlocked,
    isRedeemed,
    isExpired,
    redemptionCode: redemption?.code ?? null,
  }
}
