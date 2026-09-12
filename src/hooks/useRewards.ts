import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { enrichReward, type EnrichedReward, type RawRedemption } from '../lib/rewardsMeta'
import { useCurrentUser } from './useCurrentUser'

export type { EnrichedReward }

export function useRewards() {
  const { data: user } = useCurrentUser()
  const streak = user?.streak_count ?? 0

  return useQuery<EnrichedReward[]>({
    queryKey: ['rewards', streak],
    enabled: true,
    staleTime: 300_000,
    queryFn: async () => {
      const [{ data: rewards }, { data: redemptions }] = await Promise.all([
        supabase.from('rewards').select('*').order('milestone_required'),
        supabase.from('redemptions').select('reward_id, code, redeemed_at, status'),
      ])
      const today = new Date()
      return (rewards ?? []).map((r) =>
        enrichReward(r, streak, (redemptions ?? []) as RawRedemption[], today)
      )
    },
  })
}

export function useRedeemReward() {
  const queryClient = useQueryClient()
  return useMutation<string, Error, string>({
    mutationFn: async (rewardId: string) => {
      const { data, error } = await supabase.rpc('redeem_reward', { p_reward_id: rewardId } as never)
      if (error) throw new Error(error.message)
      return data as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards'] })
    },
  })
}
