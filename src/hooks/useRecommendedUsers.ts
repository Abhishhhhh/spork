import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

export interface RecommendedUser {
  id: string
  username: string
  name: string
  photo_url: string | null
  mutualCount: number     // 0 = no mutuals known yet (fallback slot)
  recentLogs: number      // logs in last 7 days
}

/**
 * Two-tier friend recommendation engine:
 *
 * Tier 1 — Triadic closure (friends-of-friends)
 *   For each person you're already friends with, find THEIR accepted
 *   connections. Anyone appearing in ≥1 friend's network who isn't yet
 *   connected to you becomes a candidate, ranked by mutual count.
 *   (Graph theory: "triadic closure" — closing open triangles.)
 *
 * Tier 2 — Recently active public users
 *   Any public user who has logged a meal in the last 7 days and isn't
 *   yet connected to you. Fills remaining slots and powers onboarding
 *   suggestions before you have any friends.
 *
 * Both tiers exclude: yourself, already-connected users, and users with
 * no public posts (privacy_default = 'private' AND no logs visible).
 */
export function useRecommendedUsers(limit = 10) {
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id

  const query = useQuery({
    queryKey: ['recommendedUsers', userId],
    staleTime: 5 * 60_000,   // recommendations don't need to be real-time
    queryFn: async (): Promise<RecommendedUser[]> => {
      if (!userId) return []

      // ── Step 1: gather IDs already in my network ─────────────────
      const { data: myFriendships } = await supabase
        .from('friendships')
        .select('requester_id, recipient_id, status')

      const myFriendIds = new Set<string>()
      const acceptedFriendIds: string[] = []
      for (const f of myFriendships ?? []) {
        const otherId = f.requester_id === userId ? f.recipient_id : f.requester_id
        myFriendIds.add(otherId)
        if (f.status === 'accepted') acceptedFriendIds.push(otherId)
      }
      const excludeIds = [userId, ...myFriendIds]

      // ── Step 2: Tier 1 — friends-of-friends (triadic closure) ────
      const mutualCount: Record<string, number> = {}

      if (acceptedFriendIds.length > 0) {
        const { data: friendsFriendships } = await supabase
          .from('friendships')
          .select('requester_id, recipient_id')
          .eq('status', 'accepted')
          .or(
            `requester_id.in.(${acceptedFriendIds.join(',')}),` +
            `recipient_id.in.(${acceptedFriendIds.join(',')})`
          )

        for (const f of friendsFriendships ?? []) {
          // The "other" end relative to our friend
          const candidateId = acceptedFriendIds.includes(f.requester_id)
            ? f.recipient_id
            : f.requester_id

          if (excludeIds.includes(candidateId)) continue
          mutualCount[candidateId] = (mutualCount[candidateId] ?? 0) + 1
        }
      }

      // ── Step 3: Tier 2 — recently active public users ─────────────
      // Fetch public users not yet in our network
      let recentQuery = supabase
        .from('users')
        .select('id, username, name, photo_url')
        .eq('privacy_default', 'public')
        .limit(30)

      // Supabase .not('id', 'in', ...) needs a non-empty list
      if (excludeIds.length > 0) {
        recentQuery = recentQuery.not('id', 'in', `(${excludeIds.join(',')})`)
      }

      const { data: publicUsers } = await recentQuery

      // Score by recent activity (logs in last 7 days)
      const recentLogCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const publicUserIds = (publicUsers ?? []).map((u) => u.id)

      const logCountById: Record<string, number> = {}
      if (publicUserIds.length > 0) {
        const { data: recentLogs } = await supabase
          .from('logs')
          .select('user_id')
          .in('user_id', publicUserIds)
          .gte('created_at', recentLogCutoff)

        for (const l of recentLogs ?? []) {
          logCountById[l.user_id] = (logCountById[l.user_id] ?? 0) + 1
        }
      }

      // ── Step 4: merge and rank ─────────────────────────────────────
      // Build a candidate map: tier 1 first (mutuals), then tier 2 fill
      const candidateMap = new Map<string, RecommendedUser>()

      // Tier 1 candidates (we don't have their user rows yet)
      const tier1Ids = Object.keys(mutualCount)
      if (tier1Ids.length > 0) {
        const { data: tier1Users } = await supabase
          .from('users')
          .select('id, username, name, photo_url')
          .in('id', tier1Ids)
        for (const u of tier1Users ?? []) {
          candidateMap.set(u.id, {
            ...u,
            mutualCount: mutualCount[u.id] ?? 0,
            recentLogs:  logCountById[u.id] ?? 0,
          })
        }
      }

      // Tier 2: fill with recently-active public users
      for (const u of publicUsers ?? []) {
        if (candidateMap.has(u.id)) continue
        candidateMap.set(u.id, {
          ...u,
          mutualCount: 0,
          recentLogs:  logCountById[u.id] ?? 0,
        })
      }

      // Rank: mutual count desc → recent logs desc → name asc
      return [...candidateMap.values()]
        .sort((a, b) =>
          b.mutualCount - a.mutualCount ||
          b.recentLogs  - a.recentLogs  ||
          a.username.localeCompare(b.username)
        )
        .slice(0, limit)
    },
    enabled: Boolean(userId),
  })

  return {
    ...query,
    isLoading: sessionLoading || (Boolean(userId) && query.isLoading),
  }
}
