import { supabase } from './supabase'

/**
 * Meal photos live in one of two places, recorded in logs.photo_url:
 *   "<user>/<log>.jpg"     → Supabase Storage (older photos, until migrated)
 *   "r2/<user>/<log>.jpg"  → Cloudflare R2, via the meal-photos Edge Function
 *
 * Every read/upload/delete goes through here so screens don't care which.
 */

const R2_PREFIX = 'r2/'
const LEGACY_BUCKET = 'meal-photos'
const SIGN_BATCH = 50

export const isR2Path = (path: string) => path.startsWith(R2_PREFIX)

/** path → viewable URL. Photos the viewer can't see (or that failed) are simply absent. */
export async function signMealPhotos(paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>()
  const unique = [...new Set(paths.filter(Boolean))]
  const legacy = unique.filter((p) => !isR2Path(p))
  const r2 = unique.filter(isR2Path)

  await Promise.all([
    (async () => {
      if (legacy.length === 0) return
      const { data } = await supabase.storage.from(LEGACY_BUCKET).createSignedUrls(legacy, 3600)
      for (const entry of data ?? []) if (entry.signedUrl && entry.path) urls.set(entry.path, entry.signedUrl)
    })(),
    ...chunk(r2, SIGN_BATCH).map(async (batch) => {
      const { data, error } = await supabase.functions.invoke<{ urls: Record<string, string> }>('meal-photos', {
        body: { action: 'sign', paths: batch },
      })
      if (error || !data?.urls) return
      for (const [path, url] of Object.entries(data.urls)) urls.set(path, url)
    }),
  ])
  return urls
}

/**
 * Stores an (already compressed) meal photo and returns the path to save on
 * the log. Goes to R2; if that fails for any reason the photo still goes to
 * Supabase Storage as before, so posting never breaks.
 */
export async function uploadMealPhoto(userId: string, logId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop() ?? 'jpg'
  const key = `${userId}/${logId}.${extension}`

  try {
    const form = new FormData()
    form.append('action', 'upload')
    form.append('path', key)
    form.append('file', file)
    const { data, error } = await supabase.functions.invoke<{ path: string }>('meal-photos', { body: form })
    if (!error && data?.path === `${R2_PREFIX}${key}`) return data.path
    console.warn('R2 upload failed, using Supabase Storage instead', error)
  } catch (err) {
    console.warn('R2 upload failed, using Supabase Storage instead', err)
  }

  const { error } = await supabase.storage.from(LEGACY_BUCKET).upload(key, file, { contentType: file.type })
  if (error) throw error
  return key
}

/** Best-effort removal of the caller's own photos from wherever they live. */
export async function deleteMealPhotos(paths: string[]): Promise<void> {
  const legacy = paths.filter((p) => p && !isR2Path(p))
  const r2 = paths.filter((p) => p && isR2Path(p))
  for (const batch of chunk(legacy, 100)) await supabase.storage.from(LEGACY_BUCKET).remove(batch)
  for (const batch of chunk(r2, 100)) await supabase.functions.invoke('meal-photos', { body: { action: 'delete', paths: batch } })
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
