// Deno runtime — deployed via `supabase functions deploy estimate-meal`
// (Task 4). Supabase's default verify_jwt only checks that the request
// carries ANY validly-signed JWT — the public anon key satisfies that,
// so it does NOT by itself restrict this to real signed-in users. The
// explicit claims check below (role === 'authenticated' AND a subject)
// is what actually protects the free-tier Gemini quota (spec §6 AI
// provider notes) from being hit by anyone who reads the client bundle.

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROMPT = `You are a nutrition estimation assistant. Identify each distinct food item in the photo. If the user's text description mentions specific quantities (e.g. "3 breads and 5 eggs", "200g rice, 400g chicken breast"), prioritize those stated quantities over visual guessing — only estimate portions visually where the text doesn't specify them. Apply standard per-100g nutrition values for each identified food. Return ONLY valid JSON matching this exact shape, no other text:
{
  "items": [{ "name": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number }],
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "confidence": "low" | "medium" | "high"
}
"calories"/"protein_g"/"carbs_g"/"fat_g" at the top level are the SUM across all items. "confidence" reflects how certain you are given the photo and description quality.`

interface EstimateMealRequestBody {
  photoBase64: string
  description?: string
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

class EstimateFailure extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

/**
 * The single provider-specific function (spec §6/§10) — swapping to a
 * paid Gemini key, a different model, or an entirely different vision
 * API later means changing this function's body (and the GEMINI_URL/
 * PROMPT constants above it, which are Gemini-specific by nature).
 * Everything else — HTTP parsing, CORS, response formatting, the
 * Deno.serve handler — is provider-agnostic and doesn't change.
 */
async function estimateMeal(photoBase64: string, description?: string): Promise<unknown> {
  if (!GEMINI_API_KEY) {
    throw new EstimateFailure('Server misconfigured: missing GEMINI_API_KEY', 500)
  }

  const parts = [
    { inline_data: { mime_type: 'image/jpeg', data: photoBase64 } },
    { text: description ? `${PROMPT}\n\nUser's description: ${description}` : PROMPT },
  ]

  const requestBody = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  })

  // Gemini's free tier occasionally returns 503 ("high demand") or 429
  // (rate limit) — both transient, both known/expected (spec §6 AI
  // provider notes) — that typically clear within a second or two.
  // Retry those specifically before giving up to manual entry, rather
  // than treating every momentary blip as a hard failure.
  const RETRYABLE_STATUSES = new Set([429, 503])
  const MAX_ATTEMPTS = 3
  let geminiRes: Response
  let attempt = 1
  for (;;) {
    geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    })
    if (geminiRes.ok || !RETRYABLE_STATUSES.has(geminiRes.status) || attempt >= MAX_ATTEMPTS) break
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    attempt++
  }

  if (!geminiRes.ok) {
    console.error('Gemini call failed:', geminiRes.status, await geminiRes.text())
    throw new EstimateFailure(`Gemini call failed: ${geminiRes.status}`, 502)
  }

  const geminiJson = await geminiRes.json()
  const text = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text

  if (typeof text !== 'string') {
    throw new EstimateFailure('No text in Gemini response', 502)
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new EstimateFailure('Gemini returned unparseable JSON', 502)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
  let claims: { role?: string; sub?: string } | null = null
  try {
    claims = jwt ? JSON.parse(atob(jwt.split('.')[1])) : null
  } catch {
    claims = null
  }
  if (!claims || claims.role !== 'authenticated' || !claims.sub) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  try {
    const body: EstimateMealRequestBody = await req.json()

    if (!body.photoBase64) {
      return jsonResponse({ error: 'photoBase64 is required' }, 400)
    }

    const result = await estimateMeal(body.photoBase64, body.description)
    return jsonResponse(result, 200)
  } catch (err) {
    if (err instanceof EstimateFailure) {
      return jsonResponse({ error: err.message }, err.status)
    }
    console.error('estimate-meal unexpected error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
