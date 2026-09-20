import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useSession } from '../../hooks/useSession'
import { useOnboardingStore } from '../../store/onboardingStore'
import { TopBar } from '../../components/TopBar'
import { GoogleButton } from '../../components/GoogleButton'
import { isValidEmail, sendEmailCode } from '../../lib/auth'

/**
 * "Save your plan" — creates the account at the end of onboarding.
 * Passwordless: email → 6-digit code, or Google. No confirmation-link step.
 */
export default function CreateAccount() {
  const navigate  = useNavigate()
  const store     = useOnboardingStore()
  const { session, loading } = useSession()
  const [email, setEmail]             = useState('')
  const [error, setError]             = useState<string | null>(null)
  const [submitting, setSubmitting]   = useState(false)

  const calorieGoal = store.calorieGoal ?? 2000
  const proteinGoal = store.proteinGoal ?? 0

  // Already signed in (e.g. came back from Google) — the plan is saved in the
  // store, so go straight to profile setup.
  if (!loading && session) return <Navigate to="/onboarding/profile" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!isValidEmail(addr)) { setError('Enter a valid email address.'); return }
    setError(null)
    setSubmitting(true)
    const { error: sendError } = await sendEmailCode(addr)
    setSubmitting(false)
    if (sendError) { setError(sendError); return }
    navigate('/sign-in/code', { state: { email: addr, back: '/onboarding/create-account' } })
  }

  return (
    <div className="screen min-h-screen animate-fade-in">
      <TopBar title="Your plan" back="/onboarding/your-plan" />
      <div style={{ height: 28 }} />

      <h2>Save your plan</h2>
      <p className="muted">Create your free account to keep your targets, meals and streak</p>
      <div style={{ height: 20 }} />

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="card tint">
          <p className="small">Your plan is ready to save</p>
          <div className="flex items-end justify-between" style={{ marginTop: 7 }}>
            <b className="stat">{calorieGoal.toLocaleString()} kcal</b>
            {proteinGoal > 0 && <span>{proteinGoal}g protein</span>}
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" disabled={submitting} className="btn">
          {submitting ? 'Sending code…' : 'Send me a sign-in code →'}
        </button>
      </form>

      <GoogleButton onError={setError} />

      <button type="button" onClick={() => navigate('/sign-in')} className="btn ghost">
        Already have an account? Sign in
      </button>

      <p className="hint">We’ll email you a 6-digit code — no password to remember · By continuing you agree to our <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link></p>
    </div>
  )
}
