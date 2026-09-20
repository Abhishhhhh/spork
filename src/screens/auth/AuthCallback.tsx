import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../hooks/useSession'
import { routeAfterSignIn } from '../../lib/auth'
import { TopBar } from '../../components/TopBar'

/**
 * Landing page for OAuth (Google) redirects. supabase-js exchanges the
 * ?code= in the URL for a session on load; we wait for it, then route the
 * same way as an email sign-in would.
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthError = params.get('error_description') ?? params.get('error')
    if (oauthError) { setError(oauthError.replace(/\+/g, ' ')); return }
  }, [])

  useEffect(() => {
    if (loading || error) return
    if (!session) {
      // Give the code exchange a moment; if nothing arrives, bounce to sign-in.
      const t = setTimeout(async () => {
        const { data } = await supabase.auth.getSession()
        if (!data.session) navigate('/sign-in', { replace: true })
      }, 4000)
      return () => clearTimeout(t)
    }
    routeAfterSignIn(session.user.id).then((next) => navigate(next, { replace: true }))
  }, [session, loading, error, navigate])

  return (
    <div className="screen min-h-screen animate-fade-in">
      <TopBar title="Spork" back={null} />
      <div className="text-center" style={{ paddingTop: 110 }}>
        {error ? (
          <>
            <div style={{ fontSize: 56, lineHeight: 1 }}>◌</div>
            <h2 style={{ marginTop: 16 }}>Sign-in didn’t finish</h2>
            <p className="muted">{error}</p>
            <button type="button" onClick={() => navigate('/sign-in', { replace: true })} className="btn" style={{ marginTop: 30 }}>Back to sign in</button>
          </>
        ) : (
          <>
            <div className="icon-box mx-auto" style={{ width: 120, height: 120, fontSize: 56 }}><span className="animate-spin-slow">✳</span></div>
            <h2 style={{ marginTop: 28 }}>Signing you in</h2>
            <p className="muted">One moment…</p>
          </>
        )}
      </div>
    </div>
  )
}
