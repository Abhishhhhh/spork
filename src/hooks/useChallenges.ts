import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { challengeDates, type BoardRow, type ChallengeType } from '../lib/challenges'
import { useSession } from './useSession'
import type { Database } from '../lib/database.types'

type ChallengeRow = Database['public']['Tables']['challenges']['Row']
type MemberStatus = Database['public']['Tables']['challenge_members']['Row']['status']
export interface ChallengePerson { id: string; username: string; name: string; photo_url: string | null }
export interface MyChallenge {
  challenge: ChallengeRow
  myStatus: MemberStatus
  members: { user: ChallengePerson; status: MemberStatus }[]
}

const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' } }

/**
 * Challenges the viewer is in or invited to (newest first), with every
 * member. Returns null when the 0017 migration hasn't run, so the
 * Friends tab simply hides the section.
 */
export function useMyChallenges() {
  const { session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['challenges', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<MyChallenge[] | null> => {
      const mine = await supabase.from('challenge_members').select('challenge_id, status').eq('user_id', userId!).neq('status', 'declined')
      if (mine.error) return null
      const ids = (mine.data ?? []).map((m) => m.challenge_id)
      if (!ids.length) return []
      const [challenges, members] = await Promise.all([
        supabase.from('challenges').select('*').in('id', ids).order('created_at', { ascending: false }),
        supabase.from('challenge_members').select('challenge_id, user_id, status').in('challenge_id', ids),
      ])
      if (challenges.error) throw challenges.error
      if (members.error) throw members.error
      const userIds = [...new Set((members.data ?? []).map((m) => m.user_id))]
      const { data: users, error } = await supabase.from('users').select('id, username, name, photo_url').in('id', userIds)
      if (error) throw error
      const userById = new Map((users ?? []).map((u) => [u.id, u as ChallengePerson]))
      const myStatus = new Map((mine.data ?? []).map((m) => [m.challenge_id, m.status]))
      return (challenges.data ?? []).map((challenge) => ({
        challenge,
        myStatus: myStatus.get(challenge.id)!,
        members: (members.data ?? [])
          .filter((m) => m.challenge_id === challenge.id && userById.has(m.user_id))
          .map((m) => ({ user: userById.get(m.user_id)!, status: m.status })),
      }))
    },
  })
}

/** Per-member, per-day hit/miss for one challenge — computed on the server. */
export function useChallengeBoard(challengeId: string | undefined) {
  return useQuery({
    queryKey: ['challengeBoard', challengeId],
    enabled: Boolean(challengeId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('challenge_board' as never, { p_challenge: challengeId, p_tz: tz() } as never)
      if (error) throw error
      return (data ?? []) as unknown as BoardRow[]
    },
  })
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['challenges'] })
    queryClient.invalidateQueries({ queryKey: ['challengeBoard'] })
  }
}

export function useCreateChallenge() {
  const { session } = useSession()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: { type: ChallengeType; name: string; length: number; friendIds: string[] }) => {
      const me = session!.user.id
      const { data, error } = await supabase.from('challenges')
        .insert({ creator_id: me, type: input.type, name: input.name, ...challengeDates(input.length) })
        .select('id').single()
      if (error) throw error
      const members = [
        { challenge_id: data.id, user_id: me, status: 'joined' as const },
        ...input.friendIds.map((id) => ({ challenge_id: data.id, user_id: id, status: 'invited' as const })),
      ]
      const { error: membersError } = await supabase.from('challenge_members').insert(members)
      if (membersError) {
        await supabase.from('challenges').delete().eq('id', data.id)
        throw membersError
      }
      return data.id
    },
    onSuccess: invalidate,
  })
}

/** Join or decline an invite. */
export function useRespondChallenge() {
  const { session } = useSession()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ challengeId, status }: { challengeId: string; status: 'joined' | 'declined' }) => {
      const { error } = await supabase.from('challenge_members').update({ status })
        .eq('challenge_id', challengeId).eq('user_id', session!.user.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

/** Leave (members) or delete (creator) a challenge. */
export function useLeaveChallenge() {
  const { session } = useSession()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ challengeId, isCreator }: { challengeId: string; isCreator: boolean }) => {
      const { error } = isCreator
        ? await supabase.from('challenges').delete().eq('id', challengeId)
        : await supabase.from('challenge_members').delete().eq('challenge_id', challengeId).eq('user_id', session!.user.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
