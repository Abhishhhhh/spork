import { useState, type FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../hooks/useSession'
import { TopBar } from '../../components/TopBar'

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
    <div className="screen min-h-screen animate-fade-in">
      <TopBar title="Spork" back="/welcome" />
      <div style={{ height: 28 }} />

      <h2>Welcome back</h2>
      <p className="muted">Sign in to keep your plan and your people close</p>
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
              placeholder="Password"
              autoComplete="current-password"
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

        {error && <p className="error-text">{error}</p>}

        <button type="submit" disabled={submitting} className="btn">
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <button type="button" onClick={() => navigate('/onboarding/basics')} className="btn ghost">
        New to Spork? Build my plan
      </button>
    </div>
  )
}
