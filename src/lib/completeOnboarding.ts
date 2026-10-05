import { supabase } from './supabase'
import { compressImage } from './compressImage'

export interface CompleteOnboardingInput {
  userId: string
  name: string
  username: string
  avatarFile: File | null
  calorieGoal: number
  proteinGoal: number | null
  privacyDefault: 'public' | 'private'
  friendUsernamesToRequest: string[]
  /** Body stats for Insights (weight chart, BMI). Optional and best-effort. */
  heightCm?: number | null
  weightKg?: number | null
  targetWeightKg?: number | null
}

async function uploadAvatar(userId: string, original: File): Promise<string> {
  const file = await compressImage(original, 512)
  const extension = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/avatar.${extension}`

  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
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

  // Insert core user row first — optional columns are persisted separately
  // so a pending migration doesn't block account creation.
  const { error: insertError } = await supabase.from('users').insert({
    id: input.userId,
    username: input.username,
    name: input.name,
    photo_url: photoUrl,
    calorie_goal: input.calorieGoal,
    privacy_default: input.privacyDefault,
  })

  if (insertError) throw insertError

  // Best-effort extras: protein_goal (migration 0005) and body stats for
  // Insights (migration 0013). If a migration hasn't run yet the write just
  // returns an error, which we ignore — the account is already created.
  // These must be awaited: a Supabase query only sends when awaited, so the
  // old `void supabase…update()` here never actually reached the database.
  // Separate requests, so a missing 0013 column can't take protein_goal down with it.
  await Promise.all([
    input.proteinGoal !== null ? supabase.from('users').update({ protein_goal: input.proteinGoal }).eq('id', input.userId) : null,
    input.heightCm || input.targetWeightKg
      ? supabase.from('users').update({ height_cm: input.heightCm ?? null, target_weight_kg: input.targetWeightKg ?? null }).eq('id', input.userId)
      : null,
    input.weightKg ? supabase.from('weight_logs').insert({ user_id: input.userId, weight_kg: input.weightKg }) : null,
  ].map((query) => Promise.resolve(query).catch(() => null)))

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
