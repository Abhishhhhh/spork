import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OnboardingProgress } from '../../components/OnboardingProgress'
import { ChallengeIcon } from '../../components/Challenges'
import { Avatar } from '../../components/Avatar'
import { useToast } from '../../components/Toast'
import { useFriendships } from '../../hooks/useFriendships'
import { useCreateChallenge } from '../../hooks/useChallenges'
import { CHALLENGE_LENGTHS, CHALLENGE_TYPES, type ChallengeType } from '../../lib/challenges'

/** Two steps: pick the challenge and length, then invite friends. */
export default function NewChallenge() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { data: friendships } = useFriendships()
  const create = useCreateChallenge()
  const [step, setStep] = useState<1 | 2>(1)
  const [type, setType] = useState<ChallengeType>('protein')
  const [length, setLength] = useState<number>(7)
  const [invited, setInvited] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const friends = friendships?.accepted ?? []

  function toggle(id: string) {
    setInvited((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  function submit() {
    create.mutate({ type, length, name: name.trim() || CHALLENGE_TYPES[type].label, friendIds: [...invited] }, {
      onSuccess: (id) => { toast('Challenge started 🎉'); navigate(`/home/challenges/${id}`, { replace: true }) },
      onError: () => toast('Couldn’t create the challenge — try again', 'error'),
    })
  }

  return (
    <div className="onb">
      <OnboardingProgress step={step} total={2} back="/home/friends" onBack={step === 2 ? () => setStep(1) : undefined} />

      {step === 1 ? (
        <>
          <h2 style={{ marginTop: 12 }}>Pick a challenge</h2>
          <p className="small muted">Everyone is scored on their own goals, so it’s fair</p>
          <div className="list" style={{ marginTop: 14 }}>
            {(Object.keys(CHALLENGE_TYPES) as ChallengeType[]).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} className={`choice ${type === t ? 'sel' : ''}`} aria-pressed={type === t}>
                <ChallengeIcon type={t} />
                <span className="min-w-0 flex-1 text-left">
                  <b className="block font-semibold">{CHALLENGE_TYPES[t].label}</b>
                  <small className="block">{CHALLENGE_TYPES[t].rule}</small>
                </span>
              </button>
            ))}
          </div>
          <p className="caps" style={{ marginTop: 20 }}>How long</p>
          <div className="seg" role="group" aria-label="Challenge length">
            {CHALLENGE_LENGTHS.map((n) => (
              <button key={n} type="button" className={length === n ? 'on' : ''} aria-pressed={length === n} onClick={() => setLength(n)} style={{ flex: 1 }}>
                {n} days
              </button>
            ))}
          </div>
          <div className="cta-dock"><button type="button" className="btn" onClick={() => setStep(2)}>Next · invite friends</button></div>
        </>
      ) : (
        <>
          <h2 style={{ marginTop: 12 }}>Invite friends</h2>
          <p className="small muted">They’ll see an invite on their Friends tab. Starts today, ends in {length} days.</p>
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="challenge-name">Name</label>
            <input id="challenge-name" className="input" value={name} maxLength={40} placeholder={CHALLENGE_TYPES[type].label} onChange={(e) => setName(e.target.value)} />
          </div>
          {friends.length === 0 ? (
            <div className="card tint text-center" style={{ marginTop: 14 }}>
              <b className="block font-semibold">No friends to invite yet</b>
              <span className="small muted">You can still start it solo and invite people later.</span>
            </div>
          ) : (
            <div className="list" style={{ marginTop: 14 }}>
              {friends.map((f) => (
                <button key={f.id} type="button" onClick={() => toggle(f.id)} className={`choice ${invited.has(f.id) ? 'sel' : ''}`} aria-pressed={invited.has(f.id)}>
                  <Avatar name={f.name} photoUrl={f.photo_url} />
                  <span className="min-w-0 flex-1 text-left">
                    <b className="block truncate font-semibold">@{f.username}</b>
                    <small className="block truncate">{f.name}</small>
                  </span>
                  <span className="invite-check" aria-hidden="true">{invited.has(f.id) ? '✓' : ''}</span>
                </button>
              ))}
            </div>
          )}
          <div className="cta-dock">
            <button type="button" className="btn" disabled={create.isPending} onClick={submit}>
              {create.isPending ? 'Starting…' : invited.size ? `Start with ${invited.size} friend${invited.size === 1 ? '' : 's'}` : 'Start solo'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
