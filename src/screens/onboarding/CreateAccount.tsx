import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ForkLogo } from '../../components/ForkLogo'
import { useOnboardingStore } from '../../store/onboardingStore'

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
  const goalType    = store.goalType

  const GOAL_SNIPPET: Record<string, string> = {
    lose:     'and start losing weight',
    maintain: 'and maintain your weight',
    gain:     'and build muscle',
  }

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center animate-fade-in">
        <div className="flex h-14 w-14 items-center justify-center card text-2xl">📬</div>
        <div>
          <h1 className="mb-2 text-xl font-bold text-primary">Check your email</h1>
          <p className="text-sm text-muted">
            We sent a confirmation link to{' '}
            <span className="font-semibold text-primary">{email}</span>.
            <br />
            Click it and you'll be taken straight to profile setup.
          </p>
        </div>
        <p className="text-xs text-muted">
          No email? Check spam, or{' '}
          <button
            onClick={() => setAwaitingConfirmation(false)}
            className="text-primary underline font-medium"
          >
            try a different address
          </button>
          .
        </p>
      </div>
    )
  }

  // ── Sign-up form ─────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col px-6 py-8 animate-fade-in">
      <button
        onClick={() => navigate('/onboarding/your-plan')}
        aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-card)] text-primary"
      >
        ←
      </button>

      {/* Logo */}
      <div className="mb-6 flex h-12 w-12 items-center justify-center card">
        <ForkLogo className="h-6 w-6 text-primary" />
      </div>

      {/* Framing: save, don't "register" */}
      <h1 className="mb-1 text-xl font-bold text-primary">Save your plan</h1>
      <p className="mb-2 text-sm text-muted">
        Create a free account to lock in your{' '}
        <span className="font-semibold text-primary">{calorieGoal.toLocaleString()} kcal goal</span>
        {' '}{GOAL_SNIPPET[goalType] ?? ''}.
      </p>
      <p className="mb-8 text-xs text-muted">Takes 30 seconds. No credit card.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder="you@email.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-full bg-surface border border-border/60 px-5 py-3 text-base text-primary placeholder:text-muted"
        />

        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            placeholder="Password (min. 6 characters)"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-full bg-surface border border-border/60 px-5 py-3 pr-16 text-base text-primary placeholder:text-muted"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted font-medium"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-error/30 bg-error/5 px-4 py-3">
            <p className="text-sm text-error">{error}</p>
            {error.includes('already has an account') && (
              <button
                type="button"
                onClick={() => navigate('/sign-in')}
                className="mt-1.5 text-sm font-semibold text-primary underline"
              >
                Sign in instead →
              </button>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-primary py-3.5 text-base font-semibold text-background disabled:opacity-50"
        >
          {submitting ? 'Creating account…' : 'Save my plan — free →'}
        </button>
      </form>

      {/* Legal */}
      <p className="mt-5 text-center text-xs text-muted">
        By continuing you agree to our Terms of Service and Privacy Policy.
        Your data is never sold.
      </p>

      {/* Existing user escape */}
      <button
        onClick={() => navigate('/sign-in')}
        className="mt-4 text-center text-sm text-muted"
      >
        Already have an account? Sign in
      </button>
    </div>
  )
}
