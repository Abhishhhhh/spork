import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useOnboardingStore } from '../../store/onboardingStore'
import { TopBar } from '../../components/TopBar'

export default function CreateAccount() {
  const navigate  = useNavigate()
  const store     = useOnboardingStore()
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  // When Supabase requires email confirmation, session is null after signUp.
  // We show a "check your email" state and wait for the auth listener to fire.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  const calorieGoal = store.calorieGoal ?? 2000
  const proteinGoal = store.proteinGoal ?? 0

  // ── When the session arrives (after email confirmation) navigate forward ──
  useEffect(() => {
    if (!awaitingConfirmation) return

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) return

      // Check if a users row already exists (re-confirmed existing account edge case)
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle()

      if (existing) {
        navigate('/home/feed', { replace: true })
      } else {
        navigate('/onboarding/profile')
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [awaitingConfirmation, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { data, error: authError } = await supabase.auth.signUp({ email, password })

    if (authError) {
      setSubmitting(false)
      if (authError.message.toLowerCase().includes('already registered')) {
        setError('This email already has an account.')
      } else {
        setError(authError.message)
      }
      return
    }

    // If we got a live session back (auto-confirm or existing confirmed user):
    if (data.session) {
      const userId = data.user?.id
      const { data: existing } = userId
        ? await supabase.from('users').select('id').eq('id', userId).maybeSingle()
        : { data: null }

      setSubmitting(false)

      if (existing) {
        navigate('/home/feed', { replace: true })
      } else {
        navigate('/onboarding/profile')
      }
      return
    }

    // No session yet — email confirmation required.
    // Show "check your email" UI and wait for the auth listener.
    setSubmitting(false)
    setAwaitingConfirmation(true)
  }

  // ── Email confirmation pending state ─────────────────────────────────────
  if (awaitingConfirmation) {
    return (
      <div className="screen min-h-screen animate-fade-in">
        <TopBar title="Your plan" back={null} />
        <div className="text-center" style={{ padding: '90px 10px' }}>
          <div style={{ fontSize: 70, lineHeight: 1 }}>✉︎</div>
          <h2 style={{ marginTop: 16 }}>Check your email</h2>
          <p className="muted">
            We sent a confirmation link to <b className="text-ink">{email}</b>. Open it to continue setting up your profile
          </p>
          <p className="hint" style={{ marginTop: 24 }}>
            No email? Check spam, or{' '}
            <button type="button" onClick={() => setAwaitingConfirmation(false)} className="underline text-ink font-semibold">
              try a different address
            </button>
          </p>
        </div>
      </div>
    )
  }

  // ── Sign-up form ─────────────────────────────────────────────────────────
  return (
    <div className="screen min-h-screen animate-fade-in">
      <TopBar title="Your plan" back="/onboarding/your-plan" />
      <div style={{ height: 28 }} />

      <h2>Save your plan</h2>
      <p className="muted">Create your free account to keep your targets, meals and streak</p>
      <div style={{ height: 28 }} />

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            placeholder="you@email.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              placeholder="Password · min 6 characters"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingRight: 64 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-semibold muted"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="card tint">
          <p className="small">Your plan is ready to save</p>
          <div className="flex items-end justify-between" style={{ marginTop: 7 }}>
            <b className="stat">{calorieGoal.toLocaleString()} kcal</b>
            {proteinGoal > 0 && <span>{proteinGoal}g protein</span>}
          </div>
        </div>

        {error && (
          <div className="error-text">
            <p>{error}</p>
            {error.includes('already has an account') && (
              <button type="button" onClick={() => navigate('/sign-in')} className="mt-1 font-semibold underline text-ink">
                Sign in instead →
              </button>
            )}
          </div>
        )}

        <button type="submit" disabled={submitting} className="btn">
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <button type="button" onClick={() => navigate('/sign-in')} className="btn ghost">
        Already have an account? Sign in
      </button>

      <p className="hint">By continuing you agree to our Terms of Service and Privacy Policy · Your data is never sold</p>
    </div>
  )
}
