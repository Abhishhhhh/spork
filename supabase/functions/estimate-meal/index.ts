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

const PROMPT = `You are a nutrition expert assistant specialising in Indian and South Asian cuisine, with broad knowledge of global foods.

TASK: Estimate the nutritional content of the meal in this photo.

RULES (follow in strict order):
1. IDENTIFY each distinct food item visible in the photo.
2. QUANTITIES — if the user's description states specific quantities (e.g. "2 rotis", "200g rice", "3 eggs"), use those EXACTLY. Only estimate visually where the description is silent.
3. PORTIONS — when quantities are not stated, default to these typical Indian household serving sizes:
   • Roti / chapati: 35g each (one piece)
   • Rice (cooked): 150g per serving
   • Dal / lentil curry: 150ml per serving
   • Sabzi / dry vegetable: 100g per serving
   • Curry / gravy dish: 150ml per serving
   • Paratha: 60g each
   • Idli: 40g each (one piece)
   • Dosa: 75g each
   For non-Indian items use standard international single-serve portions.
4. NUTRITION — always use cooked/prepared nutritional values, not raw. For Indian dishes, use home-cooked values with typical oil/ghee (not restaurant, which runs 2–3× higher in fat).
5. NAMING — write item names descriptively: include quantity in the name (e.g. "Roti (2 pieces)", "Steamed Rice (1 cup)", "Masoor Dal") so the user understands exactly what was counted.
6. CONFIDENCE — rate "high" only when items AND portions are clearly visible. Rate "low" for blurry, overhead, or heavily mixed/stacked plates.

Return ONLY valid JSON matching this exact shape, no other text:
{
  "items": [{ "name": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number }],
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "confidence": "low" | "medium" | "high"
}
"calories"/"protein_g"/"carbs_g"/"fat_g" at the top level are the SUM across all items.`

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

    console.error(
      'estimate-meal request diagnostics: photoBase64 length',
      body.photoBase64.length,
      'first 30 chars',
      body.photoBase64.slice(0, 30),
      'description',
      JSON.stringify(body.description),
    )

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
