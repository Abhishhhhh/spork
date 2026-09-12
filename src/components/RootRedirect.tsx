import { Navigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { Skeleton } from './Skeleton'

/**
 * Smart entry-point redirect.
 *
 * Mounted at "/" and as the wildcard fallback "/*".
 *
 * - Loading (session or user fetch in flight) → spinner, wait
 * - Session present + users row exists          → /home/feed  (returning user, skip everything)
 * - Session present + no users row             → /onboarding/profile (auth'd but incomplete)
 * - No session                                 → /welcome
 *
 * This is what makes the app "remember" you between visits — Supabase
 * persists the JWT in localStorage, so session is restored automatically
 * on every page load. We just need to route correctly once we know it.
 */
export function RootRedirect() {
  const { session, loading: sessionLoading } = useSession()
  const { data: user, isLoading: userLoading, isFetching } = useCurrentUser()

  // Still resolving auth state — don't flash anything
  if (sessionLoading || (session && (userLoading || (isFetching && user === undefined)))) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 flex-col">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-32" />
      </div>
    )
  }

  // Not signed in → marketing / onboarding entry
  if (!session) return <Navigate to="/welcome" replace />

  // Signed in but profile not yet created (abandoned mid-onboarding)
  if (!user) return <Navigate to="/onboarding/profile" replace />

  // Fully onboarded → go straight to the feed
  return <Navigate to="/home/feed" replace />
}
