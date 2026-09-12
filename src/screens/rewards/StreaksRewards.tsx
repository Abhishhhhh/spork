import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStreakData } from '../../hooks/useStreakData'
import { useRewards, useRedeemReward, type EnrichedReward } from '../../hooks/useRewards'
import { StreakCalendar } from '../../components/StreakCalendar'
import { MILESTONE_LABELS } from '../../lib/streakMeta'

const MILESTONE_ICONS: Record<number, string> = { 7: '🔥', 30: '⚡', 100: '🏆' }

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
    return <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center"><p className="text-muted">Loading…</p></div>
  }

  const effectiveStreak = streak?.effectiveStreak ?? 0
  const todayLogged     = streak?.todayLogged ?? false
  const nextMilestone   = streak?.nextMilestone ?? 7
  const daysToMilestone = streak?.daysToMilestone ?? 7
  const milestoneProgress = streak?.milestoneProgress ?? 0
  const logDates        = streak?.recentLogDates ?? new Set<string>()

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-0 pb-6">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-2 px-6 pt-10 pb-6">
        <p className="text-7xl leading-none">🔥</p>
        <p className="text-4xl font-bold text-primary">{effectiveStreak}</p>
        <p className="text-base text-muted">{effectiveStreak === 1 ? 'day streak' : 'day streak'}</p>
        {effectiveStreak === 0 && (
          <p className="mt-1 text-sm text-muted text-center">Log your first meal to start your streak</p>
        )}
      </div>

      {/* ── At-risk banner ───────────────────────────────────────── */}
      {!todayLogged && effectiveStreak > 0 && (
        <div className="mx-5 mb-4 flex items-center gap-3 rounded-2xl border banner-warning px-4 py-3">
            <span className="text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold banner-warning-text">Don't break your streak!</p>
              <p className="text-xs banner-warning-text opacity-80">Log a meal today to keep your {effectiveStreak}-day streak alive.</p>
            </div>
          <button
            onClick={() => navigate('/home/log')}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-background"
          >
            Log now
          </button>
        </div>
      )}

      {!todayLogged && effectiveStreak === 0 && (
        <div className="mx-5 mb-4 flex items-center gap-3 card bg-background px-4 py-3">
          <span className="text-lg">📝</span>
          <p className="flex-1 text-sm text-muted">Log a meal today to start building your streak.</p>
          <button
            onClick={() => navigate('/home/log')}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-background"
          >
            Log
          </button>
        </div>
      )}

      {todayLogged && (
        <div className="mx-5 mb-4 flex items-center gap-3 card bg-background px-4 py-3">
          <span className="text-lg">✅</span>
          <p className="text-sm font-medium text-primary">Logged today — streak safe!</p>
        </div>
      )}

      {/* ── Progress to next milestone ───────────────────────────── */}
      {nextMilestone !== null && (
        <div className="mx-5 mb-5 card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-primary">
              {MILESTONE_ICONS[nextMilestone]} Next unlock: {MILESTONE_LABELS[nextMilestone] ?? `${nextMilestone}-day`}
            </p>
            <p className="text-xs text-muted">{daysToMilestone} day{daysToMilestone !== 1 ? 's' : ''} to go</p>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-2.5 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.round(milestoneProgress * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted text-right">
            {Math.round(milestoneProgress * 100)}% there
          </p>
        </div>
      )}

      {/* ── 14-day calendar ─────────────────────────────────────── */}
      <div className="mx-5 mb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Last 14 days</p>
        <StreakCalendar logDates={logDates} days={14} />
      </div>

      {/* ── Milestone badges ─────────────────────────────────────── */}
      <div className="mx-5 mb-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Milestones</p>
        <div className="flex gap-2">
          {[7, 30, 100].map((m) => {
            const reached = effectiveStreak >= m
            return (
              <div
                key={m}
                className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border py-3 transition-colors ${
                  reached ? 'border-primary bg-primary/10' : 'border-border bg-background opacity-50'
                }`}
              >
                <span className="text-xl">{MILESTONE_ICONS[m]}</span>
                <span className={`text-xs font-semibold ${reached ? 'text-primary' : 'text-muted'}`}>
                  {m} days
                </span>
                {reached && <span className="text-[10px] text-primary">Unlocked!</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Rewards marketplace ──────────────────────────────────── */}
      <div className="mx-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Rewards</p>
        {rewardsLoading ? (
          <p className="text-sm text-muted">Loading rewards…</p>
        ) : (
          <div className="flex flex-col gap-3">
            {(rewards ?? []).map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                currentStreak={effectiveStreak}
                onRedeem={() => handleRedeem(reward)}
                redeeming={redeemingId === reward.id}
              />
            ))}
            {(rewards ?? []).length === 0 && (
              <p className="text-sm text-muted">No rewards available yet.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Code modal ───────────────────────────────────────────── */}
      {codeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-sm rounded-3xl bg-surface-elevated p-6 text-center shadow-xl border border-border">
            <p className="text-3xl mb-3">🎉</p>
            <p className="text-base font-bold text-primary mb-1">You unlocked a reward!</p>
            <p className="text-sm text-muted mb-4">{codeModal.partner}</p>
            <div className="card bg-background px-6 py-4 mb-4">
              <p className="text-xs text-muted mb-1">Your code</p>
              <p className="text-xl font-bold tracking-widest text-primary">{codeModal.code}</p>
            </div>
            <p className="text-xs text-muted mb-5">Screenshot or copy this code before closing.</p>
            <button
              onClick={() => setCodeModal(null)}
              className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-background"
            >
              Done
            </button>
          </div>
        </div>
      )}
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
    <div className={`rounded-2xl border p-4 transition-opacity ${locked ? 'opacity-60 border-border' : 'border-primary/30'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            {locked && <span className="text-sm">🔒</span>}
            <p className="text-sm font-bold text-primary">{reward.partner_name}</p>
          </div>
          <p className="text-sm text-muted mb-2">{reward.offer_description}</p>
          {locked ? (
            <p className="text-xs text-muted">
              🔥 {streakNeeded} more day{streakNeeded !== 1 ? 's' : ''} to unlock
            </p>
          ) : reward.isExpired ? (
            <p className="text-xs text-error">Expired</p>
          ) : reward.isRedeemed ? (
            <div>
              <p className="text-xs text-muted mb-1">Your code:</p>
              <p className="text-sm font-bold tracking-widest text-primary">{reward.redemptionCode}</p>
            </div>
          ) : null}
        </div>
        {!locked && !reward.isExpired && !reward.isRedeemed && (
          <button
            onClick={onRedeem}
            disabled={redeeming}
            className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-background disabled:opacity-50"
          >
            {redeeming ? '…' : 'Redeem'}
          </button>
        )}
        {!locked && reward.isRedeemed && (
          <span className="shrink-0 rounded-full bg-surface shadow-[var(--shadow-card)] px-3 py-1.5 text-xs font-medium text-muted">
            Redeemed ✓
          </span>
        )}
      </div>
    </div>
  )
}
