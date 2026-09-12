import { useNavigate } from 'react-router-dom'
import { ForkLogo } from '../../components/ForkLogo'
import { CameraIcon, FlameIcon, PeopleIcon } from '../../components/icons'
import { useSession } from '../../hooks/useSession'
import { Navigate } from 'react-router-dom'

const FEATURES = [
  { Icon: CameraIcon, title: 'Photo-first logging',  subtitle: 'Snap a meal, get a calorie estimate in seconds.' },
  { Icon: FlameIcon,  title: 'Daily streaks',         subtitle: 'Milestones at 7, 30, and 100 days.' },
  { Icon: PeopleIcon, title: 'A friend feed',          subtitle: 'See what your circle is eating. Stay accountable.' },
]

export default function Welcome() {
  const navigate = useNavigate()
  const { session, loading } = useSession()

  // Already signed in — skip the welcome screen entirely
  if (!loading && session) return <Navigate to="/home/feed" replace />

  return (
    <div className="flex min-h-screen flex-col justify-between px-6 py-12 animate-fade-in">

      {/* Logo + wordmark */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center card bg-background">
          <ForkLogo className="h-5 w-5 text-primary" />
        </div>
        <span className="text-base font-bold text-primary">Spork</span>
      </div>

      {/* Hero */}
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold leading-tight text-primary">
            Your personal food plan,<br />built in 2 minutes.
          </h1>
          <p className="mt-4 text-muted">
            Answer a few questions, get a personalised calorie target, then start tracking with friends.
          </p>
        </div>

        {/* Feature list */}
        <ul className="flex flex-col gap-4">
          {FEATURES.map(({ Icon, title, subtitle }) => (
            <li key={title} className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-primary">{title}</p>
                <p className="text-sm text-muted">{subtitle}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Social proof */}
        <div className="flex items-center justify-center gap-2">
          <div className="flex -space-x-2">
            {['A', 'B', 'C', 'D'].map((l) => (
              <div key={l} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-background text-[10px] font-bold text-muted">
                {l}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">
            <span className="font-semibold text-primary">10,000+</span> people tracking their meals today
          </p>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => navigate('/onboarding/basics')}
          className="w-full rounded-full bg-primary py-3.5 text-base font-semibold text-background"
        >
          Build my plan — it's free →
        </button>
        <button
          onClick={() => navigate('/sign-in')}
          className="text-center text-sm text-muted"
        >
          I already have an account
        </button>
      </div>
    </div>
  )
}