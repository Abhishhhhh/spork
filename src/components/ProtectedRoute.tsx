import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { Skeleton } from './Skeleton'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
    )
  }

  // Unauthenticated → back to Welcome (not /sign-in — that's for returning users only)
  if (!session) {
    return <Navigate to="/welcome" replace />
  }

  return <>{children}</>
}
