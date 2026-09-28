// Deno runtime — deploy as the "public-post" Edge Function.
//
// Backs the public share page spork.fit/p/<log id>, which anyone with the
// link can open — no Spork account needed. Returns ONE post's display
// fields, and only if:
//   • its owner has shared it (logs.shared_at is set — migration 0012), and
//   • it is still "Visible to friends" (visibility = 'public').
// Private posts, unshared posts and unknown ids all get the same 404.
// Nothing else about the user (email, goals, stats) is ever returned.
//
// Uses the same R2 secrets as meal-photos (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_BUCKET). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// are built in.

import { AwsClient } from 'npm:aws4fetch@1.0.20'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID') ?? ''
const R2_BUCKET = Deno.env.get('R2_BUCKET') ?? ''

const r2 = new AwsClient({
  accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID') ?? '',
  secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '',
  service: 's3',
  region: 'auto',
  retries: 2,
})

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const R2_PREFIX = 'r2/'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HALF_DAY_MS = 12 * 60 * 60 * 1000

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}

/** Same signing as meal-photos: stable for a 12-hour window so it caches. */
async function signR2(key: string): Promise<string> {
  const url = new URL(`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`)
  url.searchParams.set('X-Amz-Expires', String(24 * 60 * 60))
  const windowStart = new Date(Math.floor(Date.now() / HALF_DAY_MS) * HALF_DAY_MS)
  const datetime = windowStart.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const signed = await r2.sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true, datetime } })
  return signed.url
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const body = await req.json().catch(() => ({})) as { id?: unknown }
    const id = typeof body.id === 'string' ? body.id : ''
    if (!UUID.test(id)) return json({ error: 'Not found' }, 404)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: log, error } = await admin
      .from('logs')
      .select('id, user_id, name, caption, meal_type, photo_url, created_at, calories_final, calories_estimate, protein_final_g, protein_estimate_g, carbs_final_g, carbs_estimate_g, fat_final_g, fat_estimate_g')
      .eq('id', id).eq('visibility', 'public').not('shared_at', 'is', null)
      .maybeSingle()
    if (error) throw error
    if (!log) return json({ error: 'Not found' }, 404)

    const { data: author } = await admin.from('users').select('username, name, photo_url').eq('id', log.user_id).maybeSingle()
    if (!author) return json({ error: 'Not found' }, 404)

    let photoUrl: string | null = null
    if (log.photo_url?.startsWith(R2_PREFIX)) {
      if (R2_ACCOUNT_ID && R2_BUCKET) photoUrl = await signR2(log.photo_url.slice(R2_PREFIX.length))
    } else if (log.photo_url) {
      const { data } = await admin.storage.from('meal-photos').createSignedUrl(log.photo_url, 24 * 60 * 60)
      photoUrl = data?.signedUrl ?? null
    }

    return json({
      post: {
        id: log.id,
        name: log.name,
        caption: log.caption,
        meal_type: log.meal_type,
        created_at: log.created_at,
        calories: log.calories_final ?? log.calories_estimate,
        protein_g: log.protein_final_g ?? log.protein_estimate_g,
        carbs_g: log.carbs_final_g ?? log.carbs_estimate_g,
        fat_g: log.fat_final_g ?? log.fat_estimate_g,
        photo_url: photoUrl,
        author: { username: author.username, name: author.name, photo_url: author.photo_url },
      },
    })
  } catch (err) {
    console.error('public-post error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
