# Phase 4: Log Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Log tab placeholder with the real Log flow — photo capture, an AI-generated calorie/macro estimate via a Supabase Edge Function calling Gemini 2.5 Flash, editable fields, posting, and streak increment.

**Architecture:** A three-step client flow (Capture → Estimating → Edit & Post) backed by a Zustand draft store, calling a new `estimate-meal` Edge Function for the AI estimate and a new `postLog` orchestration function (mirroring the existing `completeOnboarding.ts` shape) that uploads the photo, inserts the `logs` row, and updates the streak — all via the same RLS-protected client calls every other feature in this app already uses. No new backend logic pattern (no Postgres RPC) is introduced.

**Tech Stack:** React + Vite + TypeScript + Tailwind CSS v4, Supabase (Postgres/RLS/Storage/Edge Functions), TanStack Query v5, Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-13-spork-design.md` — §6 (Log Flow), §7 (Key Rules), §8 (Error Handling), §9 (Testing Approach), §10 (Decisions Log, 2026-08-16 entries).

## Global Constraints

- Tailwind v4 via `@theme` tokens in `src/index.css` — use only `bg-background`, `text-primary`, `text-muted`, `border-border`, `text-error` and the existing shape/spacing conventions (`rounded-full` for buttons/inputs, `rounded-2xl` for cards). No new tokens.
- Supabase RLS is the sole privacy enforcement mechanism — never filter private data in app code alone. Every new query/policy must be verified against RLS, not just "the UI won't show it."
- Never write an embedded Supabase select (`.select('*, foo(...))')`) — the hand-written `Database` type in `src/lib/database.types.ts` doesn't model `Relationships`, so these silently break type inference. Always two plain queries, batch-fetch related rows by id, join client-side via `Map`.
- TanStack Query v5: a *disabled* query reports `isLoading: false`, not `true`. Any new/modified query gated on session state must fold `sessionLoading` into `isLoading`, exactly like `src/hooks/useCurrentUser.ts` already does.
- TDD (red→green) for every pure logic module — Vitest, colocated `*.test.ts`, explicit `import { describe, expect, it } from 'vitest'` (matches every existing test file; do not rely on the `vitest/globals` type-only include).
- AI tier: free-tier Gemini 2.5 Flash, called from a Supabase Edge Function that holds the API key server-side — never expose it to the client. The Edge Function's own default `verify_jwt` protection stays on.
- Fallback rule (spec §6): any Edge Function failure, timeout, or unparseable response → fall back to blank manual-entry fields on the same screen. The log is never blocked by an AI failure.
- Photo persistence timing (spec §10, 2026-08-16): the captured photo stays in-memory (Zustand draft) through capture and estimation; it is only uploaded to Storage at the moment the user taps Post.
- Streak increment (spec §10, 2026-08-16): a plain TypeScript pure function, not a Postgres RPC, run client-side after a successful log insert.
- **Naming note carried across Tasks 2, 6, and 7:** for the new private `meal-photos` bucket, `logs.photo_url` stores the raw **Storage object path** (e.g. `"<user_id>/<log_id>.jpg"`), *not* a fetchable URL — unlike the `avatars` bucket (public, so `users.photo_url` there is a full public URL). A path only becomes a usable URL by generating a short-lived signed URL at render time (Task 7). Every task touching `logs.photo_url` must treat it as a path.
- Git commits on anything tied to email `singhrohaan14@gmail.com` must use that identity (already configured locally) — applies to every commit in this plan.

---

### Task 1: Pure Functions — Streak Increment, Meal-Type Suggestion, Estimate Parsing

**Files:**
- Modify: `src/lib/streak.ts` (add `computeNextStreak`, sibling to the existing `getEffectiveStreak`)
- Modify: `src/lib/streak.test.ts` (add tests for `computeNextStreak`)
- Create: `src/lib/mealType.ts`
- Create: `src/lib/mealType.test.ts`
- Create: `src/lib/parseEstimate.ts`
- Create: `src/lib/parseEstimate.test.ts`

**Interfaces:**
- Produces: `computeNextStreak(streakCount: number, streakLastLogDate: string | null, today: Date): { streak_count: number; streak_last_log_date: string }` — exported from `src/lib/streak.ts`, used by Task 5's `postLog`.
- Produces: `suggestMealType(now: Date): 'breakfast' | 'lunch' | 'dinner' | 'snack'` — exported from `src/lib/mealType.ts`, used by Task 6's `LogFlow.tsx`.
- Produces: `ParsedEstimate` interface `{ calories: number; protein_g: number; carbs_g: number; fat_g: number; confidence: 'low' | 'medium' | 'high' }` and `parseEstimateResponse(raw: unknown): ParsedEstimate | null` — exported from `src/lib/parseEstimate.ts`, used by Task 5's `estimateMeal.ts`.

- [ ] **Step 1: Write the failing tests for `computeNextStreak`**

Add to `src/lib/streak.test.ts` (below the existing `getEffectiveStreak` describe block):

```ts
import { computeNextStreak, getEffectiveStreak } from './streak'

describe('computeNextStreak', () => {
  // Uses new Date(year, monthIndex, day) rather than a date-only ISO
  // string like '2026-08-15'. An ISO date-only string parses as UTC
  // midnight; this function's own return value encodes a *local*
  // calendar-day string, so asserting against it needs `today` to be
  // unambiguously local from the start (unlike getEffectiveStreak, which
  // only returns a number and is insensitive to this).
  it('does not increment if already logged today', () => {
    expect(computeNextStreak(15, '2026-08-15', new Date(2026, 7, 15))).toEqual({
      streak_count: 15,
      streak_last_log_date: '2026-08-15',
    })
  })

  it('increments by 1 if the last log was yesterday', () => {
    expect(computeNextStreak(15, '2026-08-14', new Date(2026, 7, 15))).toEqual({
      streak_count: 16,
      streak_last_log_date: '2026-08-15',
    })
  })

  it('resets to 1 if the last log was 2+ days ago', () => {
    expect(computeNextStreak(15, '2026-08-12', new Date(2026, 7, 15))).toEqual({
      streak_count: 1,
      streak_last_log_date: '2026-08-15',
    })
  })

  it('starts at 1 for a first-ever log (no prior last-log date)', () => {
    expect(computeNextStreak(0, null, new Date(2026, 7, 15))).toEqual({
      streak_count: 1,
      streak_last_log_date: '2026-08-15',
    })
  })
})
```

(The existing `import { describe, expect, it } from 'vitest'` line at the top of the file already covers these — just add `computeNextStreak` to the existing `import ... from './streak'` line.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `computeNextStreak` is not exported from `./streak`.

- [ ] **Step 3: Implement `computeNextStreak`**

Add to `src/lib/streak.ts` (below the existing `getEffectiveStreak`):

```ts
function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Run once, client-side, right after a successful log insert (postLog.ts).
 * Already logged today → no change (posting a second meal the same day
 * doesn't double-increment). Last log was yesterday → +1. Any earlier gap
 * (or no prior log at all) → reset to 1. Chosen over a Postgres RPC (spec
 * §10, 2026-08-16) — this app has no realistic concurrent-post race.
 */
export function computeNextStreak(
  streakCount: number,
  streakLastLogDate: string | null,
  today: Date,
): { streak_count: number; streak_last_log_date: string } {
  const todayStr = formatLocalDate(today)

  if (streakLastLogDate === todayStr) {
    return { streak_count: streakCount, streak_last_log_date: todayStr }
  }

  if (!streakLastLogDate) {
    return { streak_count: 1, streak_last_log_date: todayStr }
  }

  const last = new Date(streakLastLogDate + 'T00:00:00')
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffDays = Math.round((todayMidnight.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))

  return {
    streak_count: diffDays === 1 ? streakCount + 1 : 1,
    streak_last_log_date: todayStr,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all `computeNextStreak` tests green, plus the existing `getEffectiveStreak` tests still green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/streak.ts src/lib/streak.test.ts
git commit -m "feat: add computeNextStreak for Log flow streak increment"
```

- [ ] **Step 6: Write the failing tests for `suggestMealType`**

Create `src/lib/mealType.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { suggestMealType } from './mealType'

describe('suggestMealType', () => {
  it('suggests breakfast at 8:30am', () => {
    expect(suggestMealType(new Date(2026, 7, 15, 8, 30))).toBe('breakfast')
  })

  it('suggests breakfast right at the 5:00am boundary', () => {
    expect(suggestMealType(new Date(2026, 7, 15, 5, 0))).toBe('breakfast')
  })

  it('suggests snack just before the breakfast boundary, at 4:59am', () => {
    expect(suggestMealType(new Date(2026, 7, 15, 4, 59))).toBe('snack')
  })

  it('suggests lunch at noon', () => {
    expect(suggestMealType(new Date(2026, 7, 15, 12, 0))).toBe('lunch')
  })

  it('suggests snack in the afternoon gap, at 4:59pm', () => {
    expect(suggestMealType(new Date(2026, 7, 15, 16, 59))).toBe('snack')
  })

  it('suggests dinner right at the 5:00pm boundary', () => {
    expect(suggestMealType(new Date(2026, 7, 15, 17, 0))).toBe('dinner')
  })

  it('suggests dinner at 9:59pm', () => {
    expect(suggestMealType(new Date(2026, 7, 15, 21, 59))).toBe('dinner')
  })

  it('suggests snack late at night, at 10:00pm', () => {
    expect(suggestMealType(new Date(2026, 7, 15, 22, 0))).toBe('snack')
  })
})
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find module `./mealType`.

- [ ] **Step 8: Implement `suggestMealType`**

Create `src/lib/mealType.ts`:

```ts
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/**
 * Auto-suggestion shown on the Edit & Post step (spec §6) — always
 * editable, never enforced. Boundaries: breakfast 5:00-10:59, lunch
 * 11:00-14:59, dinner 17:00-21:59, snack otherwise (late-morning gap,
 * afternoon gap, late night). Reads the local hour directly — no
 * timezone ambiguity, since real call sites always pass a live `Date`.
 */
export function suggestMealType(now: Date): MealType {
  const hour = now.getHours()
  if (hour >= 5 && hour < 11) return 'breakfast'
  if (hour >= 11 && hour < 15) return 'lunch'
  if (hour >= 17 && hour < 22) return 'dinner'
  return 'snack'
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all 8 `suggestMealType` tests green.

- [ ] **Step 10: Commit**

```bash
git add src/lib/mealType.ts src/lib/mealType.test.ts
git commit -m "feat: add suggestMealType pure function"
```

- [ ] **Step 11: Write the failing tests for `parseEstimateResponse`**

Create `src/lib/parseEstimate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseEstimateResponse } from './parseEstimate'

describe('parseEstimateResponse', () => {
  const valid = { calories: 542.4, protein_g: 30.1, carbs_g: 60.9, fat_g: 12.2, confidence: 'medium' }

  it('parses and rounds a valid response', () => {
    expect(parseEstimateResponse(valid)).toEqual({
      calories: 542,
      protein_g: 30,
      carbs_g: 61,
      fat_g: 12,
      confidence: 'medium',
    })
  })

  it('returns null when a required field is missing', () => {
    const { calories: _calories, ...rest } = valid
    expect(parseEstimateResponse(rest)).toBeNull()
  })

  it('returns null when a numeric field has the wrong type', () => {
    expect(parseEstimateResponse({ ...valid, calories: '542' })).toBeNull()
  })

  it('returns null for a negative value', () => {
    expect(parseEstimateResponse({ ...valid, protein_g: -5 })).toBeNull()
  })

  it('returns null for an invalid confidence string', () => {
    expect(parseEstimateResponse({ ...valid, confidence: 'very high' })).toBeNull()
  })

  it('returns null for null input', () => {
    expect(parseEstimateResponse(null)).toBeNull()
  })

  it('returns null for a non-object input', () => {
    expect(parseEstimateResponse('not an object')).toBeNull()
  })
})
```

- [ ] **Step 12: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find module `./parseEstimate`.

- [ ] **Step 13: Implement `parseEstimateResponse`**

Create `src/lib/parseEstimate.ts`:

```ts
export interface ParsedEstimate {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  confidence: 'low' | 'medium' | 'high'
}

const CONFIDENCE_LEVELS = new Set(['low', 'medium', 'high'])

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/**
 * Validates/normalizes whatever the estimate-meal Edge Function returned.
 * Returns null on anything malformed — that's what triggers the Log
 * flow's fallback to blank manual-entry fields (spec §6); the log is
 * never blocked by a bad or missing AI response. This is the ONLY place
 * the response shape is validated — the Edge Function itself (Task 3)
 * only checks that Gemini's text is parseable JSON, not that it matches
 * this shape, to avoid duplicating validation logic across two runtimes.
 */
export function parseEstimateResponse(raw: unknown): ParsedEstimate | null {
  if (typeof raw !== 'object' || raw === null) return null

  const { calories, protein_g, carbs_g, fat_g, confidence } = raw as Record<string, unknown>

  if (
    !isFiniteNonNegativeNumber(calories) ||
    !isFiniteNonNegativeNumber(protein_g) ||
    !isFiniteNonNegativeNumber(carbs_g) ||
    !isFiniteNonNegativeNumber(fat_g) ||
    typeof confidence !== 'string' ||
    !CONFIDENCE_LEVELS.has(confidence)
  ) {
    return null
  }

  return {
    calories: Math.round(calories),
    protein_g: Math.round(protein_g),
    carbs_g: Math.round(carbs_g),
    fat_g: Math.round(fat_g),
    confidence: confidence as 'low' | 'medium' | 'high',
  }
}
```

- [ ] **Step 14: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all 7 `parseEstimateResponse` tests green, plus every pre-existing test file still green (should read something like "8 test files, N tests" total across the whole suite).

- [ ] **Step 15: Commit**

```bash
git add src/lib/parseEstimate.ts src/lib/parseEstimate.test.ts
git commit -m "feat: add parseEstimateResponse pure function"
```

---

### Task 2: `meal-photos` Storage Bucket & RLS

**Before you start:** this task is pure SQL run against the live Supabase project's Dashboard SQL Editor — no coding subagent can execute it (same exception as Phase 3's Task 1). The controller runs this task directly rather than dispatching an implementer.

**Files:**
- Create: `supabase/migrations/0002_meal_photos.sql`

**Interfaces:**
- Produces: a private Storage bucket named `meal-photos`, with `select`/`insert` policies that Task 6's `postLog` (upload) and Task 7's signed-URL generation (read) both depend on existing.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0002_meal_photos.sql`:

```sql
-- Phase 4 (Log flow): private Storage bucket for meal photos.
-- Run this once, in full, via the Supabase Dashboard SQL Editor
-- (Project → SQL Editor → New query → paste this file → Run) —
-- same process as 0001_init.sql.

insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false);

-- Path convention: {user_id}/{log_id}.<ext> — mirrors logs' own RLS
-- (logs_select_own_or_public_friend in 0001_init.sql): an object is only
-- fetchable by its owner, or by an accepted friend when the log it
-- belongs to is public. Belt-and-suspenders (spec §4): even a leaked
-- signed URL doesn't outlive its short expiry, and a guessed path still
-- has to pass this same check. logs.photo_url stores exactly this path
-- (not a URL) for rows whose photo lives in this bucket.
create policy "meal_photos_select_own_or_public_friend"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'meal-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from logs l
        join friendships f
          on f.status = 'accepted'
          and (
            (f.requester_id = auth.uid() and f.recipient_id = l.user_id)
            or (f.recipient_id = auth.uid() and f.requester_id = l.user_id)
          )
        where l.photo_url = storage.objects.name
          and l.visibility = 'public'
      )
    )
  );

create policy "meal_photos_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

- [ ] **Step 2: Run it against the live Supabase project**

Open the Supabase Dashboard → SQL Editor → New query, paste the file's contents, Run. Expect no errors — `storage.buckets` gets one new row (`meal-photos`, `public: false`), and `storage.objects` gets two new policies.

- [ ] **Step 3: Verify the bucket and policies exist**

In the Dashboard: Storage → confirm `meal-photos` is listed and shows as private (not public). Database → Policies → `storage.objects` → confirm `meal_photos_select_own_or_public_friend` and `meal_photos_insert_own_folder` are both listed.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_meal_photos.sql
git commit -m "feat: add meal-photos private Storage bucket and RLS policies"
```

---

### Task 3: `estimate-meal` Edge Function

**Files:**
- Create: `supabase/functions/estimate-meal/index.ts`

**Interfaces:**
- Produces: a deployed-later HTTP endpoint accepting `POST { photoBase64: string, description?: string }`, requiring a valid Supabase user JWT, returning `200` with a JSON body shaped `{ items: [...], calories: number, protein_g: number, carbs_g: number, fat_g: number, confidence: 'low'|'medium'|'high' }` on success, or a non-200 response on any failure. Task 5's `estimateMeal.ts` client wrapper calls this by name (`supabase.functions.invoke('estimate-meal', ...)`) and Task 1's `parseEstimateResponse` validates the body shape client-side.

**Note on testing:** this file runs on Deno, not Node — it's outside `tsconfig.json`'s `include` (`src`, `vite.config.ts`, `scripts` only) and outside Vitest's reach, so neither `npm test` nor `tsc --noEmit` touches it. There is no automated test for this step; correctness is verified by careful review against this task's exact code, and by the live smoke test in Task 4 once it's actually deployed.

- [ ] **Step 1: Write the Edge Function**

Create `supabase/functions/estimate-meal/index.ts`:

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/estimate-meal/index.ts
git commit -m "feat: add estimate-meal Edge Function"
```

---

### Task 4: Deploy & Configure `estimate-meal`

**Before you start:** this task cannot be dispatched to a coding subagent — it needs a live Gemini API key from the human, and either a local Supabase CLI install or the Dashboard's Edge Functions editor, both outside any sandboxed workspace. The controller does this task directly, pausing for the human where noted.

- [ ] **Step 1: Get a Gemini API key (human)**

The user creates a free key at Google AI Studio (https://aistudio.google.com/apikey) and provides it. Note: pasted into this conversation, the key becomes part of the transcript — acceptable for a free-tier personal dev key, but the user can rotate/delete it later from AI Studio if they'd rather it not persist there.

- [ ] **Step 2: Check for the Supabase CLI**

Run: `supabase --version`
- If found: skip to Step 4.
- If not found: Step 3.

- [ ] **Step 3: Install the Supabase CLI (no admin rights) — or fall back to the Dashboard**

Try a no-admin-rights install (same pattern as this project's Node.js install: download a prebuilt Windows binary from the CLI's GitHub Releases, extract to a user-writable directory, add to `PATH` for the session). If that hits friction, use the Supabase Dashboard's Edge Functions editor instead — it can create and deploy a function from pasted code with no local CLI at all. Either path produces the same deployed function; note in the commit message (Step 6) which path was used.

- [ ] **Step 4: Set the Gemini key as a Supabase secret**

CLI: `supabase secrets set GEMINI_API_KEY=<the key from Step 1>`
Dashboard fallback: Project → Edge Functions → Secrets → add `GEMINI_API_KEY`.

- [ ] **Step 5: Deploy the function**

CLI: `supabase functions deploy estimate-meal` (run `supabase init` first if this project has no local `supabase/config.toml` yet — it doesn't, as of this plan).
Dashboard fallback: paste `supabase/functions/estimate-meal/index.ts`'s contents into a new Edge Function named `estimate-meal` and deploy from there.

- [ ] **Step 6: Live smoke test**

Call the deployed function directly with a real user's access token (any of the Phase 3 seed accounts' credentials work, e.g. `spork.friend.maya@gmail.com` / `friendseed123`, signed in the same way Phase 3's seeding scripts did) and a small test image, base64-encoded:

```
POST https://<project-ref>.supabase.co/functions/v1/estimate-meal
Authorization: Bearer <seed account's access token>
Content-Type: application/json

{ "photoBase64": "<base64 of any small test JPEG>", "description": "a slice of bread" }
```

Expected: `200` with a JSON body containing `calories`, `protein_g`, `carbs_g`, `fat_g`, and a valid `confidence` string. Confirm `parseEstimateResponse` (Task 1) would accept this exact shape by eye — same field names, same types.

- [ ] **Step 7: Ledger the outcome**

Record in the SDD ledger which deploy path was used (CLI or Dashboard), and the smoke test's result (paste the response body). If the smoke test fails, this is a live bug in Task 3's code — fix it directly (no subagent needed for a one-file Deno fix) and re-run Step 6 before moving on.

---

### Task 5: Log Draft Store & Client Helpers

**Files:**
- Create: `src/store/logDraft.ts`
- Create: `src/lib/estimateMeal.ts`
- Create: `src/lib/postLog.ts`

**Interfaces:**
- Consumes: `ParsedEstimate` and `parseEstimateResponse` from `src/lib/parseEstimate.ts` (Task 1); `computeNextStreak` from `src/lib/streak.ts` (Task 1); the deployed `estimate-meal` function (Task 3/4); the `meal-photos` bucket (Task 2).
- Produces: `useLogDraftStore` (Zustand store) with state `{ photoFile, description, estimate, calories, proteinG, carbsG, fatG, mealType, visibility }` and actions `setPhoto`, `setDescription`, `applyEstimate`, `setField`, `setMealType`, `setVisibility`, `reset` — consumed by Task 6's `Capture.tsx`, `EstimateEdit.tsx`, and `LogFlow.tsx`. `estimateMeal(photo: File, description: string): Promise<EstimateResult | null>` and `EstimateResult = { parsed: ParsedEstimate; raw: unknown }` from `src/lib/estimateMeal.ts` — consumed by `LogFlow.tsx`. `postLog(input: PostLogInput): Promise<void>` from `src/lib/postLog.ts` — consumed by `LogFlow.tsx`'s Post handler.

**Note on testing:** `estimateMeal.ts`'s image-resize step uses `createImageBitmap`/Canvas/`FileReader` — real browser APIs this project's jsdom test environment doesn't meaningfully emulate (no `canvas` package installed). Consistent with how this project already treats browser-API-touching code (no unit tests for hooks/screens that call Supabase directly either — see spec §9), this file is verified via the live smoke test (Task 4) and the manual LAN walkthrough (Task 6), not Vitest.

- [ ] **Step 1: Create the Zustand draft store**

Create `src/store/logDraft.ts`:

```ts
import { create } from 'zustand'
import type { ParsedEstimate } from '../lib/parseEstimate'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type Visibility = 'public' | 'private'

export interface EstimateResult {
  parsed: ParsedEstimate
  raw: unknown
}

interface LogDraftState {
  photoFile: File | null
  description: string
  estimate: EstimateResult | null
  calories: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  mealType: MealType
  visibility: Visibility
  setPhoto: (file: File) => void
  setDescription: (value: string) => void
  applyEstimate: (estimate: EstimateResult | null, mealType: MealType, visibility: Visibility) => void
  setField: (field: 'calories' | 'proteinG' | 'carbsG' | 'fatG', value: number | null) => void
  setMealType: (value: MealType) => void
  setVisibility: (value: Visibility) => void
  reset: () => void
}

const initialState = {
  photoFile: null as File | null,
  description: '',
  estimate: null as EstimateResult | null,
  calories: null as number | null,
  proteinG: null as number | null,
  carbsG: null as number | null,
  fatG: null as number | null,
  mealType: 'snack' as MealType,
  visibility: 'public' as Visibility,
}

export const useLogDraftStore = create<LogDraftState>((set) => ({
  ...initialState,
  setPhoto: (file) => set({ photoFile: file }),
  setDescription: (value) => set({ description: value }),
  applyEstimate: (estimate, mealType, visibility) =>
    set({
      estimate,
      mealType,
      visibility,
      calories: estimate?.parsed.calories ?? null,
      proteinG: estimate?.parsed.protein_g ?? null,
      carbsG: estimate?.parsed.carbs_g ?? null,
      fatG: estimate?.parsed.fat_g ?? null,
    }),
  setField: (field, value) => set({ [field]: value }),
  setMealType: (value) => set({ mealType: value }),
  setVisibility: (value) => set({ visibility: value }),
  reset: () => set(initialState),
}))
```

- [ ] **Step 2: Create the estimateMeal client wrapper**

Create `src/lib/estimateMeal.ts`:

```ts
import { supabase } from './supabase'
import { parseEstimateResponse } from './parseEstimate'
import type { EstimateResult } from '../store/logDraft'

const MAX_DIMENSION_PX = 1024
const JPEG_QUALITY = 0.8

async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(bitmap, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image compression failed'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Calls the estimate-meal Edge Function. Returns null on ANY failure —
 * network error, non-2xx response, or a shape parseEstimateResponse
 * rejects — never throws. The Log flow's fallback rule (spec §6) treats
 * every failure mode identically: blank manual-entry fields, log never
 * blocked.
 */
export async function estimateMeal(photo: File, description: string): Promise<EstimateResult | null> {
  try {
    const resized = await resizeImage(photo)
    const photoBase64 = await blobToBase64(resized)

    const { data, error } = await supabase.functions.invoke('estimate-meal', {
      body: { photoBase64, description },
    })

    if (error) return null

    const parsed = parseEstimateResponse(data)
    if (!parsed) return null

    return { parsed, raw: data }
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Create the postLog orchestration function**

Create `src/lib/postLog.ts`:

```ts
import { supabase } from './supabase'
import { computeNextStreak } from './streak'
import type { EstimateResult, MealType, Visibility } from '../store/logDraft'

export interface PostLogInput {
  userId: string
  photoFile: File | null
  description: string
  mealType: MealType
  visibility: Visibility
  estimate: EstimateResult | null
  finalCalories: number | null
  finalProteinG: number | null
  finalCarbsG: number | null
  finalFatG: number | null
  currentStreakCount: number
  currentStreakLastLogDate: string | null
}

async function uploadMealPhoto(userId: string, logId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/${logId}.${extension}`

  const { error } = await supabase.storage.from('meal-photos').upload(path, file)
  if (error) throw error

  return path
}

/**
 * Runs on tapping Post (spec §6): uploads the photo — the first point
 * anything is persisted — inserts the logs row, then updates the streak.
 * Mirrors completeOnboarding.ts's single-orchestration-function shape;
 * no new backend pattern (no RPC) is introduced. `photo_url` is stored as
 * the raw Storage object path, not a URL — see this plan's Global
 * Constraints note (also relevant to Task 7).
 */
export async function postLog(input: PostLogInput): Promise<void> {
  const logId = crypto.randomUUID()

  const photoPath = input.photoFile ? await uploadMealPhoto(input.userId, logId, input.photoFile) : null

  const { error: insertError } = await supabase.from('logs').insert({
    id: logId,
    user_id: input.userId,
    photo_url: photoPath,
    description: input.description || null,
    meal_type: input.mealType,
    visibility: input.visibility,
    calories_estimate: input.estimate?.parsed.calories ?? null,
    calories_final: input.finalCalories,
    protein_estimate_g: input.estimate?.parsed.protein_g ?? null,
    protein_final_g: input.finalProteinG,
    carbs_estimate_g: input.estimate?.parsed.carbs_g ?? null,
    carbs_final_g: input.finalCarbsG,
    fat_estimate_g: input.estimate?.parsed.fat_g ?? null,
    fat_final_g: input.finalFatG,
    ai_confidence: input.estimate?.parsed.confidence ?? null,
    ai_raw_response: input.estimate?.raw ?? null,
  })

  if (insertError) throw insertError

  const next = computeNextStreak(input.currentStreakCount, input.currentStreakLastLogDate, new Date())

  const { error: streakError } = await supabase
    .from('users')
    .update({ streak_count: next.streak_count, streak_last_log_date: next.streak_last_log_date })
    .eq('id', input.userId)

  if (streakError) throw streakError
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean — no errors. (`src/store/logDraft.ts`, `src/lib/estimateMeal.ts`, `src/lib/postLog.ts` all typecheck against `database.types.ts`'s `logs` Insert type, which is `Partial<Row> & { user_id, meal_type, visibility }` — permissive enough for every field `postLog` sets.)

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — unchanged from Task 1 (this task adds no new `*.test.ts` files, per the testing note above).

- [ ] **Step 6: Commit**

```bash
git add src/store/logDraft.ts src/lib/estimateMeal.ts src/lib/postLog.ts
git commit -m "feat: add log draft store, estimateMeal client wrapper, and postLog"
```

---

### Task 6: LogFlow UI (Capture, Estimating, Edit & Post)

**Files:**
- Create: `src/screens/log/Capture.tsx`
- Create: `src/screens/log/EstimateEdit.tsx`
- Create: `src/screens/log/LogFlow.tsx`
- Modify: `src/App.tsx:9,78` (replace the `LogPlaceholder` import and route with `LogFlow`)
- Delete: `src/screens/log/LogPlaceholder.tsx`

**Interfaces:**
- Consumes: `useLogDraftStore` (Task 5), `estimateMeal` (Task 5), `postLog` (Task 5), `suggestMealType` (Task 1), `useSession` (`src/hooks/useSession.ts`), `useCurrentUser` (`src/hooks/useCurrentUser.ts`).
- Produces: the `/home/log` route renders `LogFlow`, replacing the Phase 2 placeholder.

**Scope note:** the spec's "disclaimer shown on the first few logs" (§6) is simplified here to "shown whenever an estimate exists" — tracking a per-user log count just for this disclaimer isn't worth the added state for a prototype, and the message is accurate every time, not just early on. The "brief celebratory animation" (§6) is implemented as a simple 700ms full-screen overlay, not a fuller animation library — consistent with this project's no-new-dependencies-for-polish pattern so far.

**Retry scope note (spec §8):** `postLog` (Task 5) does photo upload → log insert → streak update as three sequential, non-transactional steps — there's no rollback if a later step fails after an earlier one already succeeded. A retry after a partial failure could rarely leave an orphaned photo (upload succeeded, insert didn't) or, more rarely, a duplicate log row (insert succeeded, streak update didn't, user retries and the whole thing runs again). This mirrors the same non-transactional shape `completeOnboarding.ts` already has in this codebase (upload avatar → insert user → insert friendships, no rollback) — accepted there and accepted here for the same reason: real transactional retry (tracking "which step of this specific attempt already succeeded" across a retry) is meaningfully more complex than a prototype with a handful of users justifies. What §8 actually requires — the user sees a clear error and can retry without losing their draft — is fully met below.

- [ ] **Step 1: Create the Capture screen**

Create `src/screens/log/Capture.tsx`:

```tsx
import { useEffect, useMemo } from 'react'
import { useLogDraftStore } from '../../store/logDraft'

interface CaptureProps {
  onGetEstimate: () => void
}

export default function Capture({ onGetEstimate }: CaptureProps) {
  const photoFile = useLogDraftStore((s) => s.photoFile)
  const description = useLogDraftStore((s) => s.description)
  const setPhoto = useLogDraftStore((s) => s.setPhoto)
  const setDescription = useLogDraftStore((s) => s.setDescription)

  const previewUrl = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : null), [photoFile])

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold text-primary">Log a meal</h1>

      <label className="mb-4 flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-border bg-border/60 text-center text-sm text-muted">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          'Tap to take a photo'
        )}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) setPhoto(file)
          }}
        />
      </label>

      <label className="mb-2 text-sm font-semibold text-muted" htmlFor="description">
        Add details (improves accuracy)
      </label>
      <input
        id="description"
        placeholder='e.g. "3 breads and 5 eggs" or "200g rice, 400g chicken breast"'
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="mb-6 rounded-full bg-border/60 px-5 py-3 text-base text-primary placeholder:text-muted"
      />

      <button
        disabled={!photoFile}
        onClick={onGetEstimate}
        className="mt-auto rounded-full bg-primary py-3 text-base font-semibold text-background disabled:opacity-50"
      >
        Get Estimate
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create the Estimate & Edit screen**

Create `src/screens/log/EstimateEdit.tsx`:

```tsx
import { useLogDraftStore, type MealType } from '../../store/logDraft'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

interface EstimateEditProps {
  onPost: () => void
  posting: boolean
  postError: string | null
}

export default function EstimateEdit({ onPost, posting, postError }: EstimateEditProps) {
  const calories = useLogDraftStore((s) => s.calories)
  const proteinG = useLogDraftStore((s) => s.proteinG)
  const carbsG = useLogDraftStore((s) => s.carbsG)
  const fatG = useLogDraftStore((s) => s.fatG)
  const mealType = useLogDraftStore((s) => s.mealType)
  const visibility = useLogDraftStore((s) => s.visibility)
  const estimate = useLogDraftStore((s) => s.estimate)
  const setField = useLogDraftStore((s) => s.setField)
  const setMealType = useLogDraftStore((s) => s.setMealType)
  const setVisibility = useLogDraftStore((s) => s.setVisibility)

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col px-6 py-8">
      <h1 className="mb-2 text-2xl font-bold text-primary">
        {estimate ? 'Review your estimate' : "Couldn't get an estimate"}
      </h1>
      <p className="mb-6 text-sm text-muted">
        {estimate ? 'Estimate — tap to adjust.' : 'Enter the details manually.'}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Calories</span>
          <input
            type="number"
            value={calories ?? ''}
            onChange={(e) => setField('calories', e.target.value === '' ? null : Number(e.target.value))}
            className="rounded-full bg-border/60 px-4 py-2 text-base text-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Protein (g)</span>
          <input
            type="number"
            value={proteinG ?? ''}
            onChange={(e) => setField('proteinG', e.target.value === '' ? null : Number(e.target.value))}
            className="rounded-full bg-border/60 px-4 py-2 text-base text-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Carbs (g)</span>
          <input
            type="number"
            value={carbsG ?? ''}
            onChange={(e) => setField('carbsG', e.target.value === '' ? null : Number(e.target.value))}
            className="rounded-full bg-border/60 px-4 py-2 text-base text-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Fat (g)</span>
          <input
            type="number"
            value={fatG ?? ''}
            onChange={(e) => setField('fatG', e.target.value === '' ? null : Number(e.target.value))}
            className="rounded-full bg-border/60 px-4 py-2 text-base text-primary"
          />
        </label>
      </div>

      <label className="mb-2 text-sm font-semibold text-muted" htmlFor="mealType">
        Meal type
      </label>
      <select
        id="mealType"
        value={mealType}
        onChange={(e) => setMealType(e.target.value as MealType)}
        className="mb-4 rounded-full bg-border/60 px-5 py-3 text-base capitalize text-primary"
      >
        {MEAL_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      <div className="mb-6 flex items-center justify-between rounded-full border border-border px-5 py-3">
        <span className="text-sm font-semibold text-primary">Visible to friends</span>
        <button
          onClick={() => setVisibility(visibility === 'public' ? 'private' : 'public')}
          aria-label="Toggle visibility"
          className={`h-7 w-12 rounded-full transition-colors ${visibility === 'public' ? 'bg-primary' : 'bg-border'}`}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-background transition-transform ${
              visibility === 'public' ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {postError && <p className="mb-3 text-sm text-error">{postError}</p>}

      <button
        disabled={posting || calories === null}
        onClick={onPost}
        className="mt-auto rounded-full bg-primary py-3 text-base font-semibold text-background disabled:opacity-50"
      >
        {posting ? 'Posting…' : postError ? 'Retry Post' : 'Post'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Create the LogFlow orchestrator and wire up routing**

Create `src/screens/log/LogFlow.tsx`:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Capture from './Capture'
import EstimateEdit from './EstimateEdit'
import { useLogDraftStore } from '../../store/logDraft'
import { estimateMeal } from '../../lib/estimateMeal'
import { suggestMealType } from '../../lib/mealType'
import { postLog } from '../../lib/postLog'
import { useSession } from '../../hooks/useSession'
import { useCurrentUser } from '../../hooks/useCurrentUser'

type Step = 'capture' | 'loading' | 'edit'

export default function LogFlow() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session } = useSession()
  const { data: user } = useCurrentUser()
  const [step, setStep] = useState<Step>('capture')
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [celebrating, setCelebrating] = useState(false)

  const photoFile = useLogDraftStore((s) => s.photoFile)
  const applyEstimate = useLogDraftStore((s) => s.applyEstimate)
  const reset = useLogDraftStore((s) => s.reset)

  async function handleGetEstimate() {
    if (!photoFile) return
    setStep('loading')
    const result = await estimateMeal(photoFile, useLogDraftStore.getState().description)
    applyEstimate(result, suggestMealType(new Date()), user?.privacy_default ?? 'public')
    setStep('edit')
  }

  async function handlePost() {
    if (!session || !user || !photoFile) return
    setPosting(true)
    setPostError(null)

    try {
      const draft = useLogDraftStore.getState()
      await postLog({
        userId: session.user.id,
        photoFile,
        description: draft.description,
        mealType: draft.mealType,
        visibility: draft.visibility,
        estimate: draft.estimate,
        finalCalories: draft.calories,
        finalProteinG: draft.proteinG,
        finalCarbsG: draft.carbsG,
        finalFatG: draft.fatG,
        currentStreakCount: user.streak_count,
        currentStreakLastLogDate: user.streak_last_log_date,
      })

      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })

      // Only clear the draft on success — a failed attempt leaves
      // everything in place so the retry (Post button, re-enabled below)
      // has the same photo/fields to work with (spec §8: the in-progress
      // draft must survive a failed post).
      reset()
      setCelebrating(true)
      setTimeout(() => navigate('/home/feed'), 700)
    } catch {
      setPostError("Couldn't post — check your connection and try again.")
    } finally {
      setPosting(false)
    }
  }

  if (celebrating) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-2">
        <p className="text-4xl">🔥</p>
        <p className="text-lg font-semibold text-primary">Logged!</p>
      </div>
    )
  }

  if (step === 'capture') return <Capture onGetEstimate={handleGetEstimate} />

  if (step === 'loading') {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <p className="text-muted">Estimating…</p>
      </div>
    )
  }

  return <EstimateEdit onPost={handlePost} posting={posting} postError={postError} />
}
```

- [ ] **Step 4: Wire the route**

In `src/App.tsx`, replace line 9:

```tsx
import LogPlaceholder from './screens/log/LogPlaceholder'
```

with:

```tsx
import LogFlow from './screens/log/LogFlow'
```

And replace line 78:

```tsx
          <Route path="log" element={<LogPlaceholder />} />
```

with:

```tsx
          <Route path="log" element={<LogFlow />} />
```

- [ ] **Step 5: Delete the placeholder**

```bash
git rm src/screens/log/LogPlaceholder.tsx
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS — unchanged (no new `*.test.ts` files in this task).

- [ ] **Step 8: Manual verification**

Run `npm run dev -- --host` (LAN-exposed per spec §10's camera-testing decision), open the printed network URL on a phone on the same WiFi, sign in, tap the Log tab, take a real photo, add a description, tap Get Estimate, confirm the loading state appears then editable fields populate (or blank fields with the "Couldn't get an estimate" heading if the Edge Function/network fails), adjust a field, tap Post, confirm the celebration overlay appears then navigation lands on Feed with the new log visible.

- [ ] **Step 9: Commit**

```bash
git add src/screens/log/Capture.tsx src/screens/log/EstimateEdit.tsx src/screens/log/LogFlow.tsx src/App.tsx
git commit -m "feat: build LogFlow UI (Capture, Estimating, Edit & Post), replace LogPlaceholder"
```

---

### Task 7: Display Meal Photos in Feed & Friend Profile

**Files:**
- Modify: `src/hooks/useFeed.ts`
- Modify: `src/hooks/useFriendProfile.ts`
- Modify: `src/screens/feed/Feed.tsx`
- Modify: `src/screens/friends/FriendProfile.tsx`

**Interfaces:**
- Consumes: the `meal-photos` bucket and its `select` RLS policy (Task 2); `logs.photo_url` as a Storage path, per this plan's Global Constraints note.
- Produces: `FeedItem` gains a `photoSignedUrl: string | null` field; `FriendProfileData`'s `logs` entries are read the same way in `FriendProfile.tsx` via a parallel signed-URL map (no new exported type needed there — `FriendProfile.tsx` builds the map itself, mirroring `useFeed.ts`'s approach, since `useFriendProfile.ts`'s `logs` are `LogRow[]` already carrying `photo_url`).

- [ ] **Step 1: Add signed-URL batch-fetching to useFeed**

In `src/hooks/useFeed.ts`, update the `FeedItem` interface and `queryFn`:

```ts
export interface FeedItem {
  log: LogRow
  author: Pick<UserRow, 'id' | 'name' | 'username' | 'photo_url' | 'streak_count' | 'streak_last_log_date'>
  photoSignedUrl: string | null
}
```

Inside `queryFn`, after the existing `authorsById` construction and before the final `return logs.map(...)`, add:

```ts
      const photoPaths = logs.filter((log) => log.photo_url).map((log) => log.photo_url as string)
      const signedUrlByPath = new Map<string, string>()
      if (photoPaths.length > 0) {
        const { data: signedUrls } = await supabase.storage.from('meal-photos').createSignedUrls(photoPaths, 3600)
        for (const entry of signedUrls ?? []) {
          if (entry.signedUrl && entry.path) signedUrlByPath.set(entry.path, entry.signedUrl)
        }
      }
```

Then change the final `return logs.map(...)` block's body from:

```ts
          const author = authorsById.get(log.user_id)
          return author ? { log, author } : null
```

to:

```ts
          const author = authorsById.get(log.user_id)
          if (!author) return null
          return {
            log,
            author,
            photoSignedUrl: log.photo_url ? (signedUrlByPath.get(log.photo_url) ?? null) : null,
          }
```

- [ ] **Step 2: Render the photo in Feed.tsx**

In `src/screens/feed/Feed.tsx`, update the destructuring in the `.map` to include `photoSignedUrl`:

```tsx
{items.map(({ log, author, photoSignedUrl }) => {
```

Add the photo inside the card, right after the opening `<button ...>` tag and before the existing `<div className="flex items-center gap-2">` (author row):

```tsx
            {photoSignedUrl && (
              <img src={photoSignedUrl} alt="" className="h-40 w-full rounded-xl object-cover" />
            )}
```

- [ ] **Step 3: Add signed-URL batch-fetching to useFriendProfile**

In `src/hooks/useFriendProfile.ts`, update `FriendProfileData` and `queryFn`:

```ts
export interface FriendProfileLog extends LogRow {
  photoSignedUrl: string | null
}

export interface FriendProfileData {
  user: UserRow
  logs: FriendProfileLog[]
}
```

Replace the existing `return { user, logs: logs ?? [] }` with:

```ts
      const rows = logs ?? []
      const photoPaths = rows.filter((log) => log.photo_url).map((log) => log.photo_url as string)
      const signedUrlByPath = new Map<string, string>()
      if (photoPaths.length > 0) {
        const { data: signedUrls } = await supabase.storage.from('meal-photos').createSignedUrls(photoPaths, 3600)
        for (const entry of signedUrls ?? []) {
          if (entry.signedUrl && entry.path) signedUrlByPath.set(entry.path, entry.signedUrl)
        }
      }

      return {
        user,
        logs: rows.map((log) => ({
          ...log,
          photoSignedUrl: log.photo_url ? (signedUrlByPath.get(log.photo_url) ?? null) : null,
        })),
      }
```

- [ ] **Step 4: Render the photo in FriendProfile.tsx**

In `src/screens/friends/FriendProfile.tsx`, inside the logs grid `<li>`, add the photo above the existing calorie/meal-type spans:

```tsx
          <li key={log.id} className="flex flex-col items-center gap-1 rounded-2xl border border-border p-3">
            {log.photoSignedUrl && (
              <img src={log.photoSignedUrl} alt="" className="h-20 w-full rounded-xl object-cover" />
            )}
            <span className="text-lg font-bold text-primary">{log.calories_final ?? log.calories_estimate ?? '—'}</span>
```

(Leave the rest of that `<li>` — the calories/meal-type spans — exactly as it is.)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS — unchanged.

- [ ] **Step 7: Manual verification**

Using the same LAN dev-server session as Task 6's walkthrough: post a meal with a photo, confirm it appears in Feed with the photo rendered; tap into that friend's profile (or your own, if a "my profile logs" view exists — otherwise verify via another test account added as a friend) and confirm the photo renders in the logs grid too. Confirm a log posted with `visibility: private` never shows its photo (or itself at all) to a friend — this is the same RLS guarantee Phase 3 already verified for text/calorie fields, now extended to cover the photo.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useFeed.ts src/hooks/useFriendProfile.ts src/screens/feed/Feed.tsx src/screens/friends/FriendProfile.tsx
git commit -m "feat: display meal photos in Feed and Friend Profile via signed URLs"
```
