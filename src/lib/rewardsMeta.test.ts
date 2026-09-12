import { describe, expect, it } from 'vitest'
import { enrichReward, type RawReward, type RawRedemption } from './rewardsMeta'

const BASE_REWARD: RawReward = {
  id: 'r1',
  partner_name: 'Cult.fit',
  offer_description: '20% off',
  milestone_required: 30,
  expiry_date: '2099-12-31',
}

describe('enrichReward', () => {
  it('locked when streak < milestone', () => {
    const r = enrichReward(BASE_REWARD, 10, [], new Date('2026-01-01'))
    expect(r.isUnlocked).toBe(false)
    expect(r.isRedeemed).toBe(false)
    expect(r.redemptionCode).toBeNull()
    expect(r.isExpired).toBe(false)
  })

  it('unlocked when streak === milestone', () => {
    const r = enrichReward(BASE_REWARD, 30, [], new Date('2026-01-01'))
    expect(r.isUnlocked).toBe(true)
  })

  it('unlocked when streak > milestone', () => {
    const r = enrichReward(BASE_REWARD, 99, [], new Date('2026-01-01'))
    expect(r.isUnlocked).toBe(true)
  })

  it('redeemed when redemption row exists for this reward', () => {
    const redemptions: RawRedemption[] = [
      { reward_id: 'r1', code: 'ABC12345', redeemed_at: '2026-01-01T00:00:00Z', status: 'redeemed' },
    ]
    const r = enrichReward(BASE_REWARD, 30, redemptions, new Date('2026-01-01'))
    expect(r.isRedeemed).toBe(true)
    expect(r.redemptionCode).toBe('ABC12345')
  })

  it('not redeemed when redemption row for different reward', () => {
    const redemptions: RawRedemption[] = [
      { reward_id: 'r2', code: 'XYZ99999', redeemed_at: '2026-01-01T00:00:00Z', status: 'redeemed' },
    ]
    const r = enrichReward(BASE_REWARD, 30, redemptions, new Date('2026-01-01'))
    expect(r.isRedeemed).toBe(false)
    expect(r.redemptionCode).toBeNull()
  })

  it('expired when expiry_date is in the past', () => {
    const past = { ...BASE_REWARD, expiry_date: '2020-01-01' }
    const r = enrichReward(past, 30, [], new Date('2026-01-01'))
    expect(r.isExpired).toBe(true)
  })

  it('not expired when expiry_date is today', () => {
    const today = new Date('2026-06-15')
    const reward = { ...BASE_REWARD, expiry_date: '2026-06-15' }
    const r = enrichReward(reward, 30, [], today)
    expect(r.isExpired).toBe(false)
  })

  it('not expired when expiry_date is null', () => {
    const noExpiry = { ...BASE_REWARD, expiry_date: null }
    const r = enrichReward(noExpiry, 30, [], new Date('2026-01-01'))
    expect(r.isExpired).toBe(false)
  })
})
