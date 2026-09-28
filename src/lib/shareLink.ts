import { supabase } from './supabase'

/** What the public share page shows — see supabase/functions/public-post. */
export interface PublicPost {
  id: string
  name: string | null
  caption: string | null
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  created_at: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  photo_url: string | null
  author: { username: string; name: string; photo_url: string | null }
}

export function shareUrl(logId: string): string {
  return `${window.location.origin}/p/${logId}`
}

/**
 * Opens the post up to anyone with the link. Only the owner can do this
 * (RLS logs_update_own); the first share sets the timestamp, later shares
 * leave it alone.
 */
export async function enableShareLink(logId: string): Promise<void> {
  const { error } = await supabase
    .from('logs')
    .update({ shared_at: new Date().toISOString() })
    .eq('id', logId)
    .is('shared_at', null)
  if (error) throw error
}

/** null = not shared, private, deleted, or never existed (all look the same). */
export async function fetchPublicPost(logId: string): Promise<PublicPost | null> {
  const { data, error } = await supabase.functions.invoke<{ post: PublicPost }>('public-post', { body: { id: logId } })
  if (error || !data?.post) return null
  return data.post
}
