import { useNavigate } from 'react-router-dom'
import { useChallengeBoard, useMyChallenges, useRespondChallenge, type MyChallenge } from '../hooks/useChallenges'
import { useSession } from '../hooks/useSession'
import { CHALLENGE_TYPES, challengeDays, challengeStatus, dayMarks, leaderboard, type ChallengeType, type DayMark } from '../lib/challenges'
import { useToast } from './Toast'

const ICON_PATHS: Record<ChallengeType, React.ReactNode> = {
  protein: <path d="M13.5 3 5 13.5h6l-1 7.5 8.5-10.5h-6z" />,
  on_target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  log_daily: <path d="M12 3c.5 3.5 5 5.5 5 10.5A5 5 0 0 1 7 13.5c0-2.4 1.3-3.6 2.4-4.6.3 1.6 1.1 2.6 2.1 3 0-3.4.1-6.4.5-8.9z" />,
  hydration: <path d="M12 3.5s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z" />,
}

/** The challenge type's icon on a soft tile, in its colour. */
export function ChallengeIcon({ type, size = 40 }: { type: ChallengeType; size?: number }) {
  return (
    <span className="challenge-icon" style={{ width: size, height: size, color: CHALLENGE_TYPES[type].color }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {ICON_PATHS[type]}
      </svg>
    </span>
  )
}

/** Drawn day marks: teal tick, soft red cross, ring-with-dot for today, dashed circle for days to come. */
export function DayMarkIcon({ mark, size = 30 }: { mark: DayMark; size?: number }) {
  const label = { hit: 'Hit', miss: 'Missed', today: 'Today, not hit yet', future: 'Still to come' }[mark]
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" role="img" aria-label={label}>
      {mark === 'hit' && <><circle cx="15" cy="15" r="14" fill="var(--color-teal)" /><path d="M9.5 15.5l3.6 3.6 7.4-8" fill="none" stroke="var(--mark-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></>}
      {mark === 'miss' && <><circle cx="15" cy="15" r="14" fill="var(--mark-miss-bg)" /><path d="M11 11l8 8M19 11l-8 8" stroke="var(--color-error)" strokeWidth="2.6" strokeLinecap="round" /></>}
      {mark === 'today' && <><circle cx="15" cy="15" r="13" fill="none" stroke="var(--color-ink)" strokeWidth="2" /><circle cx="15" cy="15" r="3" fill="var(--color-ink)" /></>}
      {mark === 'future' && <circle cx="15" cy="15" r="13" fill="none" stroke="var(--color-soft2)" strokeWidth="2" strokeDasharray="3 3.4" />}
    </svg>
  )
}

/** Friends tab: active challenges and invites, plus "+ New". Hidden until the 0017 migration has run. */
export function ChallengesSection() {
  const navigate = useNavigate()
  const { data } = useMyChallenges()
  if (data == null) return null

  const visible = data.filter(({ challenge }) => {
    const { state } = challengeStatus(challenge.starts_on, challenge.ends_on)
    // Keep finished challenges around for 3 days so people can see the result.
    const ended = new Date(challenge.ends_on); ended.setDate(ended.getDate() + 3)
    return state !== 'ended' || ended >= new Date()
  })

  return (
    <section className="section">
      <div className="flex items-center justify-between">
        <span className="caps">Challenges</span>
        <button type="button" className="pill sel" onClick={() => navigate('/home/challenges/new')}>+ New</button>
      </div>
      {visible.length === 0 ? (
        <button type="button" onClick={() => navigate('/home/challenges/new')} className="card tint block w-full text-left" style={{ margin: '10px 0 0' }}>
          <b className="block font-semibold">Challenge your friends</b>
          <span className="small muted">Protein week, hydration, logging streaks — 7, 14 or 30 days</span>
        </button>
      ) : (
        <div className="list" style={{ marginTop: 10 }}>
          {visible.map((c) => (c.myStatus === 'invited' ? <InviteCard key={c.challenge.id} c={c} /> : <ActiveCard key={c.challenge.id} c={c} />))}
        </div>
      )}
    </section>
  )
}

function InviteCard({ c }: { c: MyChallenge }) {
  const respond = useRespondChallenge()
  const { toast } = useToast()
  const creator = c.members.find((m) => m.user.id === c.challenge.creator_id)?.user
  const { state } = challengeStatus(c.challenge.starts_on, c.challenge.ends_on)
  const length = challengeDays(c.challenge.starts_on, c.challenge.ends_on).length
  const answer = (status: 'joined' | 'declined') =>
    respond.mutate({ challengeId: c.challenge.id, status }, {
      onSuccess: () => toast(status === 'joined' ? `Joined ${c.challenge.name} 💪` : 'Invite skipped'),
      onError: () => toast('Couldn’t update — try again', 'error'),
    })
  return (
    <div className="card tint flex items-center gap-3" style={{ margin: 0, padding: '14px 16px' }}>
      <ChallengeIcon type={c.challenge.type} />
      <span className="min-w-0 flex-1">
        <b className="block truncate font-semibold">@{creator?.username ?? 'a friend'} invited you</b>
        <small className="muted block truncate">{c.challenge.name} · {length} days{state === 'active' ? '' : ' · starts soon'}</small>
      </span>
      <button type="button" className="pill" disabled={respond.isPending} onClick={() => answer('declined')}>Skip</button>
      <button type="button" className="pill sel" disabled={respond.isPending} onClick={() => answer('joined')}>Join</button>
    </div>
  )
}

function ActiveCard({ c }: { c: MyChallenge }) {
  const navigate = useNavigate()
  const { session } = useSession()
  const { data: rows } = useChallengeBoard(c.challenge.id)
  const joined = c.members.filter((m) => m.status === 'joined')
  const { state, daysLeft, today } = challengeStatus(c.challenge.starts_on, c.challenge.ends_on)
  const days = challengeDays(c.challenge.starts_on, c.challenge.ends_on)
  const board = rows ? leaderboard(rows, joined.map((m) => m.user.id)) : null
  const me = board?.find((s) => s.userId === session?.user.id)
  // Show the latest week of the challenge (up to today).
  const idx = state === 'ended' ? days.length - 1 : state === 'upcoming' ? 0 : days.indexOf(today)
  const start = Math.min(Math.max(0, idx - 6), Math.max(0, days.length - 7))
  const strip = days.slice(start, start + 7)
  const marks = dayMarks(strip, me?.days ?? {}, today)

  return (
    <button type="button" onClick={() => navigate(`/home/challenges/${c.challenge.id}`)} className="card block w-full text-left" style={{ margin: 0 }}>
      <span className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <ChallengeIcon type={c.challenge.type} />
          <span className="min-w-0">
            <b className="block truncate font-semibold">{c.challenge.name}</b>
            <small className="muted block truncate">{CHALLENGE_TYPES[c.challenge.type].rule} · {joined.length} in</small>
          </span>
        </span>
        <span className="pill tint flex-none">{state === 'ended' ? 'Ended' : state === 'upcoming' ? 'Starts soon' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}</span>
      </span>
      <span className="flex justify-between" style={{ marginTop: 14 }}>
        {strip.map((d, i) => (
          <span key={d} className="text-center">
            <DayMarkIcon mark={marks[i]} size={30} />
            <small className="tiny muted block" style={{ marginTop: 3 }}>{'SMTWTFS'[new Date(`${d}T12:00`).getDay()]}</small>
          </span>
        ))}
      </span>
      <span className="flex items-center justify-between" style={{ marginTop: 12 }}>
        <span className="small">{!me ? 'Loading…' : board!.some((s) => s.hits > 0) ? <>You’re <b>#{me.rank}</b> · {me.hits}/{days.length} days</> : <>Just started · 0/{days.length} days</>}</span>
        <span className="flex">
          {joined.slice(0, 5).map((m, i) => (
            <span key={m.user.id} className="challenge-face" style={{ marginLeft: i ? -8 : 0 }}>
              {m.user.photo_url ? <img src={m.user.photo_url} alt="" /> : m.user.username.charAt(0).toUpperCase()}
            </span>
          ))}
        </span>
      </span>
    </button>
  )
}
