import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'

/** Guards onboarding routes: bounces an already-onboarded user to /home/feed. */
export function RequireNotOnboarded({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-400">Loading…</p>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/home/feed" replace />
  }

  return <>{children}</>
}
