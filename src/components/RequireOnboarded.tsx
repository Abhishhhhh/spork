import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useSession } from '../hooks/useSession'

/** Guards /home/* routes: sends a not-yet-onboarded user back to Profile Setup. */
export function RequireOnboarded({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading } = useSession()
  const { data: user, isLoading, isFetching } = useCurrentUser()

  // Wait for session check first
  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  // If we have a session but the user query hasn't settled yet (either
  // actively loading or fetching for the first time), hold — don't redirect.
  // This prevents the stale-null cache from triggering a loop right after
  // completeOnboarding() clears the cache and navigates here.
  if (session && (isLoading || (isFetching && user === undefined))) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/onboarding/profile" replace />
  }

  return <>{children}</>
}
