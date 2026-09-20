import { useMemo } from 'react'
import { useFriendships } from './useFriendships'

/** id → username for the viewer's accepted friends, from the cached friendships query. */
export function useFriendUsernames(): Map<string, string> {
  const { data } = useFriendships()
  return useMemo(
    () => new Map((data?.accepted ?? []).map((u) => [u.id, u.username])),
    [data],
  )
}
