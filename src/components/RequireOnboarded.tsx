import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'

/** Guards /home/* routes: sends a not-yet-onboarded user back to Profile Setup. */
export function RequireOnboarded({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-400">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/onboarding/profile" replace />
  }

  return <>{children}</>
}
