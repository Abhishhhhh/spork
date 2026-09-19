import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStreakData } from '../../hooks/useStreakData'
import { useRewards, useRedeemReward, type EnrichedReward } from '../../hooks/useRewards'
import { StreakCalendar } from '../../components/StreakCalendar'
import { MILESTONE_LABELS } from '../../lib/streakMeta'
import { TopBar } from '../../components/TopBar'

const MILESTONE_ICONS: Record<number, string> = { 7: '🔥', 30: '⚡︎', 100: '🏆' }

export default function StreaksRewards() {
  const navigate = useNavigate()
  const { data: streak, isLoading: streakLoading } = useStreakData()
  const { data: rewards, isLoading: rewardsLoading } = useRewards()
  const redeemMutation = useRedeemReward()

  const [redeemingId, setRedeemingId] = useState<string | null>(null)
  const [codeModal, setCodeModal] = useState<{ code: string; partner: string } | null>(null)

  async function handleRedeem(reward: EnrichedReward) {
    setRedeemingId(reward.id)
    try {
      const code = await redeemMutation.mutateAsync(reward.id)
      setCodeModal({ code, partner: reward.partner_name })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      alert(msg.includes('streak_too_low') ? "Your streak isn't high enough yet." :
            msg.includes('already_redeemed') ? 'You already redeemed this reward.' :
            'Could not redeem — try again.')
    } finally {
      setRedeemingId(null)
    }
  }

  if (streakLoading) {
    return (
      <div>
        <TopBar title="Streaks & rewards" back="/home/profile" />
        <p className="muted text-center" style={{ padding: 60 }}>Loading…</p>
      </div>
    )
  }

  const effectiveStreak = streak?.effectiveStreak ?? 0
  const todayLogged     = streak?.todayLogged ?? false
  const nextMilestone   = streak?.nextMilestone ?? 7
  const daysToMilestone = streak?.daysToMilestone ?? 7
  const milestoneProgress = streak?.milestoneProgress ?? 0
  const logDates        = streak?.recentLogDates ?? new Set<string>()

  // ── Post-redemption code state ────────────────────────────────
  if (codeModal) {
    return (
      <div className="animate-fade-in">
        <TopBar title="Reward" back={null} />
        <div className="text-center" style={{ paddingTop: 90 }}>
          <div style={{ fontSize: 60, lineHeight: 1 }}>✦</div>
          <h2 style={{ marginTop: 12 }}>Reward unlocked</h2>
          <p className="muted">Show this code to {codeModal.partner}</p>
          <div className="card tint" style={{ padding: 30, marginTop: 30 }}>
            <p className="caps">Your code</p>
            <div className="code" style={{ marginTop: 10 }}>{codeModal.code}</div>
          </div>
          <p className="hint">Screenshot or copy this code before closing</p>
          <button type="button" onClick={() => setCodeModal(null)} className="btn">Done</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <TopBar title="Streaks & rewards" back="/home/profile" />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="card ink text-center" style={{ padding: 25 }}>
        <span style={{ fontSize: 45, lineHeight: 1 }}>🔥</span>
        <div className="big">{effectiveStreak}</div>
        <p>day streak</p>
        <p className="small muted">
          {todayLogged
            ? 'Logged today · streak safe'
            : effectiveStreak > 0
            ? `Log a meal today to keep your ${effectiveStreak}-day streak alive`
            : 'Log your first meal to start your streak'}
        </p>
        {!todayLogged && (
          <button type="button" onClick={() => navigate('/home/log')} className="btn light" style={{ marginTop: 18 }}>
            Log now
          </button>
        )}
      </div>

      {/* ── Progress to next milestone ───────────────────────────── */}
      {nextMilestone !== null && (
        <div className="card">
          <div className="flex items-center justify-between">
            <b className="font-semibold">Next unlock · {MILESTONE_LABELS[nextMilestone] ?? `${nextMilestone} days`}</b>
            <small className="muted">{daysToMilestone} day{daysToMilestone !== 1 ? 's' : ''} to go</small>
          </div>
          <div className="bar" style={{ margin: '14px 0 6px' }}>
            <i style={{ width: `${Math.round(milestoneProgress * 100)}%` }} />
          </div>
          <p className="tiny muted">{Math.round(milestoneProgress * 100)}% there</p>
        </div>
      )}

      {/* ── 14-day calendar ─────────────────────────────────────── */}
      <div className="section">
        <span className="caps">Last 14 days</span>
        <StreakCalendar logDates={logDates} days={14} />
      </div>

      {/* ── Milestone badges ─────────────────────────────────────── */}
      <div className="section">
        <span className="caps">Milestones</span>
        <div className="tile-grid three">
          {[7, 30, 100].map((m) => {
            const reached = effectiveStreak >= m
            return (
              <div key={m} className={`tile compact ${reached ? 'sel' : ''}`}>
                <span className="icon">{MILESTONE_ICONS[m]}</span>
                <span>
                  <b>{m} days</b>
                  <small className="block">{reached ? 'Unlocked' : 'Locked'}</small>
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Rewards marketplace ──────────────────────────────────── */}
      <div className="section">
        <span className="caps">Rewards</span>
        {rewardsLoading ? (
          <p className="small muted">Loading rewards…</p>
        ) : (
          <>
            {(rewards ?? []).map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                currentStreak={effectiveStreak}
                onRedeem={() => handleRedeem(reward)}
                redeeming={redeemingId === reward.id}
              />
            ))}
            {(rewards ?? []).length === 0 && <p className="small muted">No rewards available yet</p>}
          </>
        )}
      </div>
    </div>
  )
}

function RewardCard({
  reward,
  currentStreak,
  onRedeem,
  redeeming,
}: {
  reward: EnrichedReward
  currentStreak: number
  onRedeem: () => void
  redeeming: boolean
}) {
  const locked = !reward.isUnlocked
  const streakNeeded = reward.milestone_required - currentStreak

  return (
    <div className="card" style={{ marginTop: 0, opacity: locked ? 0.6 : 1 }}>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1">
          <b className="block font-semibold">{reward.partner_name}</b>
          <p className="small muted">{reward.offer_description}</p>
          {locked ? (
            <p className="small muted" style={{ marginTop: 4 }}>
              Unlock with a {reward.milestone_required} day streak · {streakNeeded} more day{streakNeeded !== 1 ? 's' : ''}
            </p>
          ) : reward.isExpired ? (
            <p className="small text-error" style={{ marginTop: 4 }}>Expired</p>
          ) : reward.isRedeemed ? (
            <p className="small" style={{ marginTop: 4 }}>Your code · <b className="code" style={{ fontSize: 14 }}>{reward.redemptionCode}</b></p>
          ) : null}
        </span>
        {!locked && !reward.isExpired && !reward.isRedeemed && (
          <button type="button" onClick={onRedeem} disabled={redeeming} className="pill sel">
            {redeeming ? '…' : 'Redeem'}
          </button>
        )}
        {!locked && reward.isRedeemed && <span className="pill tint">Redeemed ✓</span>}
        {locked && <span className="pill tint">Locked</span>}
      </div>
    </div>
  )
}
