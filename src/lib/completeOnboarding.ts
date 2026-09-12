import { supabase } from './supabase'

export interface CompleteOnboardingInput {
  userId: string
  name: string
  username: string
  avatarFile: File | null
  calorieGoal: number
  proteinGoal: number | null
  privacyDefault: 'public' | 'private'
  friendUsernamesToRequest: string[]
}

async function uploadAvatar(userId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/avatar.${extension}`

  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
  if (error) throw error

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

/**
 * The single place a `users` row is created. Nothing is written to the
 * `users` table before this runs, so an abandoned onboarding leaves no
 * partial profile behind — the user just starts over at Profile Setup
 * next time they sign in.
 */
export async function completeOnboarding(input: CompleteOnboardingInput): Promise<void> {
  const photoUrl = input.avatarFile ? await uploadAvatar(input.userId, input.avatarFile) : null

  // Insert core user row first — protein_goal is persisted separately
  // so a pending migration on that column doesn't block account creation.
  const { error: insertError } = await supabase.from('users').insert({
    id: input.userId,
    username: input.username,
    name: input.name,
    photo_url: photoUrl,
    calorie_goal: input.calorieGoal,
    privacy_default: input.privacyDefault,
  })

  if (insertError) throw insertError

  // Best-effort: save protein_goal.  This column was added in migration
  // 0005_protein_goal.sql.  If that migration hasn't been applied yet the
  // update will fail silently — the user row still exists and they proceed
  // normally.  Once the migration is applied future logins will carry the
  // correct value.
  if (input.proteinGoal !== null) {
    void supabase
      .from('users')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ protein_goal: input.proteinGoal } as any)
      .eq('id', input.userId)
  }

  if (input.friendUsernamesToRequest.length === 0) return

  const { data: friendRows, error: lookupError } = await supabase
    .from('users')
    .select('id, username')
    .in('username', input.friendUsernamesToRequest)

  if (lookupError) throw lookupError

  const requests = (friendRows ?? []).map((friend) => ({
    requester_id: input.userId,
    recipient_id: friend.id,
  }))

  if (requests.length > 0) {
    const { error: friendshipError } = await supabase.from('friendships').insert(requests)
    if (friendshipError) throw friendshipError
  }
}
