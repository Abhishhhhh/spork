import { useNavigate } from 'react-router-dom'
import { useSession } from '../../hooks/useSession'
import { Navigate } from 'react-router-dom'

const FEATURES = [
  { icon: '▣', title: 'Photo-first logging', subtitle: 'Snap a meal, get a calorie estimate in seconds' },
  { icon: '♨', title: 'Daily streaks',        subtitle: 'Milestones at 7, 30 and 100 days' },
  { icon: '♧', title: 'A friend feed',        subtitle: 'See what your circle is eating' },
]

export default function Welcome() {
  const navigate = useNavigate()
  const { session, loading } = useSession()

  // Already signed in — skip the welcome screen entirely
  if (!loading && session) return <Navigate to="/home/feed" replace />

  return (
    <div className="screen min-h-screen animate-fade-in">
      <div className="topbar">
        <span className="clay" style={{ fontSize: 30 }}>spork</span>
      </div>

      {/* Hero card */}
      <div className="card flex flex-col justify-end" style={{ padding: '28px 24px', minHeight: 275 }}>
        <p className="caps" style={{ marginBottom: 18 }}>Welcome to Spork</p>
        <h2>Your personal food plan, built in 2 minutes</h2>
        <p className="muted small mt-2">
          Answer a few questions, get a personalised calorie target, then start tracking with friends
        </p>
      </div>

      <div style={{ height: 15 }} />

      {/* Feature list */}
      <ul className="list">
        {FEATURES.map(({ icon, title, subtitle }) => (
          <li key={title} className="choice">
            <span className="icon">{icon}</span>
            <span className="min-w-0 flex-1">
              <b>{title}</b>
              <small>{subtitle}</small>
            </span>
          </li>
        ))}
      </ul>

      {/* CTAs */}
      <button type="button" onClick={() => navigate('/onboarding/basics')} className="btn">
        Build my plan →
      </button>
      <button type="button" onClick={() => navigate('/sign-in')} className="btn ghost">
        I already have an account
      </button>
    </div>
  )
}
