// Deno runtime — deployed via `supabase functions deploy estimate-meal`
// (Task 4). Requires a valid user JWT (Supabase's default verify_jwt,
// left on) so this can't be hit by non-users, protecting the free-tier
// Gemini quota (spec §6 AI provider notes).

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

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
 * API later means changing only this function's body. Everything above
 * and below it (HTTP parsing, CORS, response formatting) is
 * provider-agnostic and doesn't change.
 */
async function estimateMeal(photoBase64: string, description?: string): Promise<unknown> {
  if (!GEMINI_API_KEY) {
    throw new EstimateFailure('Server misconfigured: missing GEMINI_API_KEY', 500)
  }

  const parts = [
    { inline_data: { mime_type: 'image/jpeg', data: photoBase64 } },
    { text: description ? `${PROMPT}\n\nUser's description: ${description}` : PROMPT },
  ]

  const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  })

  if (!geminiRes.ok) {
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
    return jsonResponse({ error: String(err) }, 500)
  }
})
