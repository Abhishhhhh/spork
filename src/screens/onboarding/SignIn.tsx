import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ForkLogo } from '../../components/ForkLogo'

export default function SignIn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialMode = searchParams.get('mode') === 'sign-up' ? 'sign-up' : 'sign-in'
  // Defaults to sign-in unless Welcome explicitly linked here with
  // ?mode=sign-up ("Get started"): after the very first signup, nearly
  // every visit to this screen is an existing user signing back in, and
  // signing up with an email that already exists returns a visible
  // "already registered" error rather than silently succeeding.
  const [mode, setMode] = useState<'sign-up' | 'sign-in'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { data, error: authError } =
      mode === 'sign-up'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setSubmitting(false)
      setError(authError.message)
      return
    }

    // Route straight to the feed for an already-onboarded returning user,
    // instead of always landing on /onboarding/profile and relying on the
    // RequireNotOnboarded guard to redirect onward — that guard still
    // works as defense-in-depth, but doing this check here avoids ever
    // mounting the onboarding screens for a user who doesn't need them.
    const userId = data.user?.id
    const { data: existingProfile } = userId
      ? await supabase.from('users').select('id').eq('id', userId).maybeSingle()
      : { data: null }

    setSubmitting(false)
    navigate(existingProfile ? '/home/feed' : '/onboarding/profile')
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={() => navigate('/welcome')}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary"
        >
          ←
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background">
            <ForkLogo className="h-4 w-4 text-primary" />
          </div>
          <span className="font-bold text-primary">Spork</span>
        </div>
      </div>

      <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-background">
        <ForkLogo className="h-7 w-7 text-primary" />
      </div>

      <h1 className="mb-2 text-2xl font-bold text-primary">
        {mode === 'sign-up' ? 'Create your account' : 'Welcome back'}
      </h1>
      <p className="mb-8 text-sm text-muted">
        {mode === 'sign-up'
          ? 'Email and password for now — phone sign-in is coming.'
          : 'Sign in to keep your streak going.'}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-full bg-border/60 px-5 py-3 text-base text-primary placeholder:text-muted"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-full bg-border/60 px-5 py-3 text-base text-primary placeholder:text-muted"
        />
        {error && <p className="text-sm text-error">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-primary py-3 text-base font-semibold text-background disabled:opacity-50"
        >
          {submitting ? 'Please wait…' : 'Continue'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}
        className="mt-6 text-center text-sm text-muted"
      >
        {mode === 'sign-up' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
      </button>
    </div>
  )
}
