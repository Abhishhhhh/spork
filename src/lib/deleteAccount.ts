import { supabase } from './supabase'
import { deleteMealPhotos } from './mealPhotos'

const AVATAR_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif']

/**
 * Permanently deletes the signed-in user's account.
 *
 * 1. Removes their photos from Supabase Storage / R2 (best effort — a
 *    leftover file is unreachable anyway once the account is gone).
 * 2. Calls delete_my_account(), which deletes the auth user; every table
 *    cascades from it (migration 0011).
 */
export async function deleteAccount(userId: string): Promise<void> {
  const { data: logs } = await supabase.from('logs').select('photo_url').eq('user_id', userId)
  const mealPhotos = (logs ?? [])
    .map((l) => l.photo_url as string | null)
    .filter((p): p is string => !!p && (p.startsWith(`${userId}/`) || p.startsWith(`r2/${userId}/`)))
  await deleteMealPhotos(mealPhotos)
  await supabase.storage.from('avatars').remove(AVATAR_EXTENSIONS.map((ext) => `${userId}/avatar.${ext}`))

  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw error
}
