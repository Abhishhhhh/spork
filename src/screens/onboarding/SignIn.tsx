import { useState, type FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ForkLogo } from '../../components/ForkLogo'
import { useSession } from '../../hooks/useSession'

/**
 * Sign-in screen for RETURNING users only.
 * New users go through /onboarding/basics → /onboarding/create-account instead.
 */
export default function SignIn() {
  const navigate      = useNavigate()
  const { session, loading } = useSession()
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Already signed in — no need to sign in again
  if (!loading && session) return <Navigate to="/home/feed" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setSubmitting(false)
      setError(
        authError.message.toLowerCase().includes('invalid')
          ? 'Incorrect email or password. Try again.'
          : authError.message
      )
      return
    }

    // Check if they've completed onboarding
    const userId = data.user?.id
    const { data: existingProfile } = userId
      ? await supabase.from('users').select('id').eq('id', userId).maybeSingle()
      : { data: null }

    setSubmitting(false)
    navigate(existingProfile ? '/home/feed' : '/onboarding/profile', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={() => navigate('/welcome')}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-card)] text-primary"
        >
          ←
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface shadow-[var(--shadow-card)] bg-background">
            <ForkLogo className="h-4 w-4 text-primary" />
          </div>
          <span className="font-bold text-primary">Spork</span>
        </div>
      </div>

      <div className="mb-6 flex h-14 w-14 items-center justify-center card bg-background">
        <ForkLogo className="h-7 w-7 text-primary" />
      </div>

      <h1 className="mb-1 text-xl font-bold text-primary">Welcome back</h1>
      <p className="mb-8 text-sm text-muted">Sign in to keep your streak going 🔥</p>

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
            placeholder="Password"
            autoComplete="current-password"
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

        {error && <p className="rounded-2xl border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-primary py-3 text-base font-semibold text-background disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => navigate('/onboarding/basics')}
        className="mt-6 text-center text-sm text-muted"
      >
        Don't have an account? Build your plan →
      </button>
    </div>
  )
}