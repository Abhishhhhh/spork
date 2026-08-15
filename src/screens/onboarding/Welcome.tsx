import { useNavigate } from 'react-router-dom'
import { ForkLogo } from '../../components/ForkLogo'
import { CameraIcon, FlameIcon, PeopleIcon } from '../../components/icons'

const FEATURES = [
  { Icon: CameraIcon, title: 'Photo-first logging', subtitle: 'One tap, an estimate, done.' },
  { Icon: FlameIcon, title: 'Daily streaks', subtitle: 'Milestones at 7, 30 and 100 days.' },
  { Icon: PeopleIcon, title: 'A friend feed', subtitle: 'Chronological. Public only if you say so.' },
]

export default function Welcome() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col justify-center gap-8 px-6 py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background">
          <ForkLogo className="h-5 w-5 text-primary" />
        </div>
        <span className="text-lg font-bold text-primary">Spork</span>
      </div>

      <div>
        <h1 className="text-4xl font-bold leading-tight text-primary">Track food like you train.</h1>
        <p className="mt-4 text-muted">
          Snap a photo, get a calorie estimate in seconds, and keep the streak alive with friends watching. No
          noise, no likes — just accountability.
        </p>
      </div>

      <ul className="flex flex-col gap-4">
        {FEATURES.map(({ Icon, title, subtitle }) => (
          <li key={title} className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-border/60">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-primary">{title}</p>
              <p className="text-sm text-muted">{subtitle}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-4">
        <button
          onClick={() => navigate('/sign-in?mode=sign-up')}
          className="w-full rounded-full bg-primary py-3 text-base font-semibold text-background"
        >
          Get started
        </button>
        <button onClick={() => navigate('/sign-in?mode=sign-in')} className="text-center text-sm text-muted">
          I already have an account
        </button>
      </div>
    </div>
  )
}
