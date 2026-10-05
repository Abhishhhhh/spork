import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

export interface BlockedUser { id: string; username: string; name: string; photo_url: string | null }

/**
 * `blocked`: people the viewer blocked (for Settings / Unblock).
 * `hidden`: everyone to keep out of search, suggestions and profiles —
 * people the viewer blocked plus people who blocked the viewer.
 * Both are empty if the 0015 migration hasn't run yet.
 */
export function useBlocks() {
  const { session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['blocks', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [mine, hidden] = await Promise.all([
        supabase.from('blocks').select('blocked_id').eq('blocker_id', userId!),
        supabase.rpc('my_hidden_user_ids' as never),
      ])
      const blockedIds = mine.error ? [] : (mine.data ?? []).map((b) => b.blocked_id)
      const { data: users } = blockedIds.length
        ? await supabase.from('users').select('id, username, name, photo_url').in('id', blockedIds)
        : { data: [] as BlockedUser[] }
      return {
        blocked: (users ?? []) as BlockedUser[],
        blockedIds: new Set(blockedIds),
        hidden: new Set<string>(hidden.error ? blockedIds : [...((hidden.data as unknown as string[] | null) ?? []), ...blockedIds]),
      }
    },
  })
}

function useInvalidateSocial() {
  const queryClient = useQueryClient()
  return () => {
    for (const key of ['blocks', 'friendships', 'feed', 'friendProfile', 'recommendedUsers']) queryClient.invalidateQueries({ queryKey: [key] })
  }
}

export function useBlockUser() {
  const { session } = useSession()
  const invalidate = useInvalidateSocial()
  return useMutation({
    mutationFn: async (otherId: string) => {
      const { error } = await supabase.from('blocks').insert({ blocker_id: session!.user.id, blocked_id: otherId })
      // Already blocked counts as done.
      if (error && error.code !== '23505') throw error
    },
    onSuccess: invalidate,
  })
}

export function useUnblockUser() {
  const { session } = useSession()
  const invalidate = useInvalidateSocial()
  return useMutation({
    mutationFn: async (otherId: string) => {
      const { error } = await supabase.from('blocks').delete().eq('blocker_id', session!.user.id).eq('blocked_id', otherId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
