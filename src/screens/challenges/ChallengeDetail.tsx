import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TopBar } from '../../components/TopBar'
import { Avatar } from '../../components/Avatar'
import { Skeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { ChallengeIcon, DayMarkIcon } from '../../components/Challenges'
import { useSession } from '../../hooks/useSession'
import { useChallengeBoard, useLeaveChallenge, useMyChallenges, useRespondChallenge } from '../../hooks/useChallenges'
import { CHALLENGE_TYPES, challengeDays, challengeStatus, dayMarks, leaderboard } from '../../lib/challenges'

const MEDALS = ['🥇', '🥈', '🥉']
const weekday = (day: string) => 'SMTWTFS'[new Date(`${day}T12:00`).getDay()]
const shortDate = (day: string) => new Date(`${day}T12:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

/** One challenge: your days, rank and the leaderboard. Only hit/missed is shared — never meals or numbers. */
export default function ChallengeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session } = useSession()
  const { data: challenges, isLoading } = useMyChallenges()
  const { data: rows, isError, refetch } = useChallengeBoard(id)
  const c = challenges?.find((x) => x.challenge.id === id)
  const respond = useRespondChallenge()
  const { toast } = useToast()

  if (isLoading || (c && !rows && !isError)) {
    return <div><TopBar title="Challenge" back="/home/friends" /><Skeleton className="h-[420px] w-full rounded-[27px]" /></div>
  }
  if (!c) {
    return (
      <div>
        <TopBar title="Challenge" back="/home/friends" />
        <div className="card text-center"><b className="block font-semibold">Challenge not found</b><p className="small muted">It may have been deleted, or you left it.</p></div>
      </div>
    )
  }

  const me = session?.user.id
  const joined = c.members.filter((m) => m.status === 'joined')
  const invited = c.members.filter((m) => m.status === 'invited')
  const days = challengeDays(c.challenge.starts_on, c.challenge.ends_on)
  const { state, daysLeft, today } = challengeStatus(c.challenge.starts_on, c.challenge.ends_on)
  const board = leaderboard(rows ?? [], joined.map((m) => m.user.id))
  const mine = board.find((s) => s.userId === me)
  const marks = dayMarks(days, mine?.days ?? {}, today)
  const userById = new Map(c.members.map((m) => [m.user.id, m.user]))

  return (
    <div>
      <TopBar title={c.challenge.name} back="/home/friends"
        right={<ChallengeMenu challengeId={c.challenge.id} isCreator={c.challenge.creator_id === me} onDone={() => navigate('/home/friends')} />} />

      <div className="card text-center" style={{ marginTop: 0 }}>
        <div className="flex justify-center"><ChallengeIcon type={c.challenge.type} size={56} /></div>
        <h2 style={{ marginTop: 10 }}>
          {c.myStatus === 'invited' ? 'You’re invited' : !mine ? '—' : !board.some((s) => s.hits > 0) ? (state === 'ended' ? 'No one scored' : 'Just started') : state === 'ended' ? `You finished #${mine.rank}` : `You’re #${mine.rank}`}
        </h2>
        <p className="small muted">
          {CHALLENGE_TYPES[c.challenge.type].rule} · {mine?.hits ?? 0} of {days.length} days
          {state === 'ended' ? ' · ended' : ` · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left · ends ${shortDate(c.challenge.ends_on)}`}
        </p>
        {c.myStatus === 'invited' && (
          <div className="action-row" style={{ marginTop: 14 }}>
            <button type="button" className="btn light" style={{ marginTop: 0 }} disabled={respond.isPending}
              onClick={() => respond.mutate({ challengeId: c.challenge.id, status: 'declined' }, { onSuccess: () => navigate('/home/friends'), onError: () => toast('Couldn’t update — try again', 'error') })}>Skip</button>
            <button type="button" className="btn" style={{ marginTop: 0 }} disabled={respond.isPending}
              onClick={() => respond.mutate({ challengeId: c.challenge.id, status: 'joined' }, { onSuccess: () => toast(`Joined ${c.challenge.name} 💪`), onError: () => toast('Couldn’t update — try again', 'error') })}>Join</button>
          </div>
        )}
        {isError && <button type="button" className="small muted" onClick={() => refetch()} style={{ marginTop: 8 }}>Couldn’t load scores · Tap to retry</button>}
        <div className="challenge-days" style={{ marginTop: 16 }}>
          {days.map((d, i) => (
            <span key={d} className="text-center">
              <DayMarkIcon mark={marks[i]} size={days.length > 14 ? 26 : 34} />
              <small className="tiny muted block" style={{ marginTop: 3 }}>{weekday(d)}</small>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between" style={{ marginTop: 18 }}>
        <span className="caps">Leaderboard</span>
        <span className="tiny muted">Days hit</span>
      </div>
      <div className="card" style={{ padding: '6px 16px', marginTop: 8 }}>
        {board.map((s) => {
          const user = userById.get(s.userId)
          const isMe = s.userId === me
          return (
            <div key={s.userId} className={`board-row ${isMe ? 'me' : ''}`}>
              <span className="board-rank">{s.hits > 0 && s.rank <= 3 ? MEDALS[s.rank - 1] : s.rank}</span>
              <Avatar name={user?.name ?? '?'} photoUrl={user?.photo_url} size="sm" />
              <b className="min-w-0 flex-1 truncate font-semibold">{isMe ? 'You' : `@${user?.username ?? 'friend'}`}</b>
              <span className="meter" style={{ width: 72 }}><i style={{ width: `${(s.hits / days.length) * 100}%`, background: isMe ? 'var(--color-ink)' : 'var(--color-teal)' }} /></span>
              <b className="board-hits">{s.hits}</b>
            </div>
          )
        })}
        {invited.length > 0 && (
          <p className="tiny muted" style={{ padding: '10px 0 8px' }}>Invited: {invited.map((m) => `@${m.user.username}`).join(', ')}</p>
        )}
      </div>
      <p className="tiny muted text-center" style={{ margin: '10px 0 24px' }}>Friends see only who hit each day — never your meals or numbers.</p>
    </div>
  )
}

function ChallengeMenu({ challengeId, isCreator, onDone }: { challengeId: string; isCreator: boolean; onDone: () => void }) {
  const leave = useLeaveChallenge()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function handle() {
    setOpen(false)
    if (!window.confirm(isCreator ? 'Delete this challenge for everyone?' : 'Leave this challenge?')) return
    leave.mutate({ challengeId, isCreator }, {
      onSuccess: () => { toast(isCreator ? 'Challenge deleted' : 'You left the challenge'); onDone() },
      onError: () => toast('Couldn’t update — try again', 'error'),
    })
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="circle" aria-label="More options" aria-expanded={open} onClick={() => setOpen((v) => !v)}>•••</button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-48 overflow-hidden rounded-[19px] bg-paper shadow-[0_8px_30px_#00000020] animate-slide-down">
          <button type="button" onClick={handle} className="block w-full px-4 py-3 text-left text-[13px] text-error">
            {isCreator ? 'Delete challenge' : 'Leave challenge'}
          </button>
        </div>
      )}
    </div>
  )
}
