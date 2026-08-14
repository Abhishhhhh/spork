# Spork — Design Spec

**Date:** 2026-08-13
**Status:** Approved, pending implementation plan

## 1. Concept

Spork is a social-first calorie & nutrition tracker — "Hevy, but for food." Users log meals via photo, get an AI-generated calorie/macro estimate, and post publicly to a friend feed or keep the log private. Daily logging streaks are the retention loop; streak milestones unlock partner reward offers.

Mobile-first web app, iOS-styled UI, installable as a PWA. Ship as a web app first — no native App Store distribution in this phase (see §9, Platform Decision).

## 2. Tech Stack & Project Structure

- **React + Vite + TypeScript + Tailwind CSS** — SPA, not Next.js. No SEO/SSR need for an auth-gated app; Vite keeps the build simple.
- **Vite PWA plugin** — manifest + service worker so the app is installable via "Add to Home Screen," with iOS status-bar/splash-screen meta tags.
- **React Router** — bottom tab bar navigation + stack-style pushes for detail screens (e.g. Feed → Meal Detail).
- **Supabase** — Auth (email only for this phase — see §9), Postgres, Storage (meal/profile photos), Edge Functions (AI proxy).
- **TanStack Query** — server state/caching (logs, friends, feed, rewards).
- **Zustand** — the one piece of client-only state: the in-progress log-flow draft (photo → estimate → edits before posting).
- **Folder structure:**
  - `src/screens/*` — one folder per tab/flow
  - `src/components/*` — shared UI (cards, tab bar, progress ring, flame icon)
  - `src/lib/*` — supabase client, calorie-estimate client, streak logic
  - `src/hooks/*` — data-fetching hooks per entity

## 3. Data Model

Two independent privacy layers:

1. **Log-level `visibility`** (`public`/`private`, defaults to the user's `privacy_default`, editable per log) — controls whether that specific log appears in a friend's Feed, in the friend-profile log grid, or in aggregate stats.
2. **User-level `privacy_default`** — the default for new logs, and it also gates whether **streak and quick-stats** show on that user's profile to friends at all. A "private by default" user hides streak/stats from friends entirely, even if some individual logs are public.

Enforced with **Postgres Row-Level Security**, not just app-side query filters, so a UI bug can never leak a private log.

```sql
users (
  id uuid primary key references auth.users,
  username text unique not null,
  name text not null,
  photo_url text,
  calorie_goal int,
  privacy_default text check (privacy_default in ('public','private')) default 'public',
  streak_count int default 0,
  streak_last_log_date date,
  reminder_time time,              -- UI-only preference, no real push notification (see §9)
  created_at timestamptz default now()
)

logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  photo_url text,
  description text,                -- user-typed food details, e.g. "200g rice, 400g chicken breast"
  meal_type text check (meal_type in ('breakfast','lunch','dinner','snack')) not null,
  visibility text check (visibility in ('public','private')) not null,
  calories_estimate int,
  calories_final int,
  protein_estimate_g int,
  protein_final_g int,
  carbs_estimate_g int,
  carbs_final_g int,
  fat_estimate_g int,
  fat_final_g int,
  ai_confidence text check (ai_confidence in ('low','medium','high')),
  ai_raw_response jsonb,           -- itemized breakdown from the AI call, for display/debugging
  created_at timestamptz default now()
)
-- RLS: a row is readable if auth.uid() = user_id, OR
--      (visibility = 'public' AND an accepted friendship exists between auth.uid() and user_id)

friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references users(id) not null,
  recipient_id uuid references users(id) not null,
  status text check (status in ('pending','accepted')) default 'pending',
  created_at timestamptz default now(),
  check (requester_id <> recipient_id)
)
-- Uniqueness on the unordered pair is enforced by a separate expression
-- index (unique(least(...), greatest(...)) isn't valid as a table-level
-- constraint, since those only accept column names, not expressions):
-- create unique index on friendships (least(requester_id, recipient_id), greatest(requester_id, recipient_id));
-- RLS: readable/updatable by requester_id or recipient_id.
-- Only recipient_id may transition status from 'pending' to 'accepted'.

rewards (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null,
  offer_description text not null,
  milestone_required int not null,   -- streak days required, e.g. 7/30/100
  expiry_date date
)
-- Seeded via SQL migration. No client insert/update — no admin UI in this phase.

redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  reward_id uuid references rewards(id) not null,
  code text not null,
  status text check (status in ('unredeemed','redeemed','expired')) default 'redeemed',
  redeemed_at timestamptz default now()
)
-- RLS: readable/insertable only by the owning user.
```

**Redemption is a server-side Postgres RPC**, not a plain client insert: `redeem_reward(reward_id)` checks the caller's `streak_count` against the reward's `milestone_required` *in the database* before generating a code and inserting the redemption row. This prevents a client from faking eligibility by calling insert directly.

A redemption row is only ever created at the moment of redemption, so it's inserted with status `'redeemed'` directly — there's no separate "code generated but not yet redeemed" step in this flow. `'expired'` is a **derived display state**, computed by comparing the reward's `expiry_date` to the current date at read time, the same no-cron pattern used for streaks (§3) — no background job flips the stored status.

**Photo storage**: a **private** Supabase Storage bucket (not public), with storage policies mirroring the `logs` RLS — object paths encode `user_id`, and a photo is only fetchable by its owner or by an accepted friend when the corresponding log is public. This is belt-and-suspenders: even a leaked URL doesn't work without passing the same policy check.

**Streak logic — lazy evaluation, no cron job needed:**

`streak_count` and `streak_last_log_date` update inside the same `log_meal()` RPC that inserts a log:
- Same day as last log → no change (already logged today)
- Exactly one day after last log → increment
- Gap of more than one day → reset to 1

To *display* a broken streak before the user's next log (there's no background job to proactively zero it out), the UI derives an "effective streak" from `streak_last_log_date` at read time: if it's today or yesterday, show the stored count; if older, show 0. The stored value gets corrected to 0 lazily on the next `log_meal()` call.

## 4. Screens & Navigation

Bottom tab bar, 4 tabs: **Feed / Log (center action) / Streaks & Rewards / Profile**.

**Onboarding:** Welcome → Sign in (email) → Profile setup (name, unique username, photo) → Calorie goal (manual input or auto-suggest from height/weight/age/activity, editable) → Privacy default choice ("Public by default" / "Private by default") → Add first friends (skip option).

Height/weight/age/activity are used only to compute the suggested calorie goal client-side at that moment — they are not persisted. Only the resulting `calorie_goal` is stored on the user record; if the user wants to recompute the suggestion later, they re-enter those inputs.

**Feed:** Empty state prompts adding friends / logging first meal. Populated state: chronological cards, no algorithm — friend photo/handle, meal photo, calorie count, meal tag, timestamp, flame icon if the friend has an active streak. Tap card → friend profile.

**Log flow (see §5 for detail).**

**Meal detail view:** full photo, calories + each macro (estimate vs. final), meal type, timestamp, edit option (own logs only).

**Friend profile:** public logs grid (photo + calories + meal type), current streak, quick stats if permitted (avg daily calories from public logs, most logged meal type) — fully private-default users show no streak/stats to friends at all, regardless of individual public logs.

**Add Friends:** search by username, "Find from Contacts" (mocked, no real contacts access), sent/received request lists, Accept/Decline.

**Streaks & Rewards:** current streak (big flame + number), progress bar to next milestone (7/30/100 days). Rewards marketplace: grid/list of partner offers, locked (grayed, shows milestone needed) vs. unlocked. Reward detail → Redeem → mock code generated → status becomes "Redeemed" with expiry countdown.

**Profile & Settings:** own stats (daily calorie total vs. goal, progress ring), history as a **calendar view** (tap a day to see that day's log(s) — matches Hevy's proven pattern for streak visualization). Settings: edit profile, privacy default, notification preference (streak-risk reminder time — UI-only, no real push), block/report list.

## 5. Log Flow (core feature)

1. Tap **+** → camera/upload → photo preview shown.
2. Optional text field: *"Add details (improves accuracy)"* — e.g. "3 breads and 5 eggs" or "200g rice, 400g chicken breast with mustard."
3. Tap **Get Estimate** → one call to a Supabase Edge Function (`estimate-meal`), which holds the Gemini API key server-side (never exposed to the client) and calls **Gemini 2.5 Flash** with the photo + description together. The prompt instructs the model to: identify each food item, prioritize stated quantities over visual guessing when text is given, apply standard per-100g nutrition values, and return structured JSON — per-item breakdown plus totals for calories/protein/carbs/fat, and a confidence level (`low`/`medium`/`high`).
4. ~3–5s loading state → editable **calories, protein, carbs, fat** fields + meal name + meal type (auto-suggested by time of day, editable) + visibility toggle (defaults to the user's onboarding privacy setting).
5. **Fallback rule:** if the Edge Function call fails, times out, or returns something unparseable, silently fall back to blank manual-entry fields on the same screen. The log is never blocked by an AI failure.
6. Disclaimer shown on the first few logs: *"Estimate — tap to adjust."*
7. Tap **Post** → brief celebratory animation → streak increments per the logic in §3.

**AI provider notes:**
- Free tier (Google AI Studio key) supports multimodal (photo + text) input at no cost, but has modest rate limits (roughly 10–15 requests/minute, 250–1,500/day depending on model/account — Google has been tightening free-tier terms) and its terms allow content to be used to improve Google's products. Acceptable for this phase (a handful of friends testing); revisit with a paid key if usage grows.
- The Edge Function is written provider-agnostically (a single `estimateMeal(photo, description)` interface) so swapping to a paid key or a different vision API later is a config change, not a rewrite.
- Even with precise quantities, this is an LLM approximation, not a lab measurement or database lookup — "close," not certified-accurate, for well-documented foods. The "Estimate — tap to adjust" framing manages this honestly.

## 6. Key Rules (unchanged from original requirements)

- Private logs must never appear in any friend-facing feed/query, and must never leak into aggregate stats (enforced at the RLS layer, not just app code).
- Streak increments once per day if the user logs at least one meal (public or private); resets to 0 if a full calendar day passes with no log.
- No comments/likes — the feed is for visibility/accountability only.
- No dark patterns on rewards — no paywalled streak-freeze, no manipulative copy.

## 7. Error Handling & Edge Cases

- AI estimate failure → manual entry fallback (§5) — the primary error path called out by the spec.
- Duplicate/invalid usernames at signup → inline validation before submit.
- Friend request to self, or duplicate pending requests → blocked at the `friendships` unique constraint (§3).
- Ineligible reward redemption → blocked server-side by `redeem_reward()`, not just hidden in the UI.
- Photo upload failure (bad network) → retry affordance; the in-progress log draft is preserved in the Zustand store so the user doesn't lose it.
- Empty states: Feed (no friends / no logs yet), Rewards (nothing unlocked yet).

## 8. Testing Approach

Following the **test-driven-development** skill during implementation:
- Unit tests for logic that's easy to get subtly wrong: streak lazy-evaluation math, meal-type time-of-day suggestion, parsing calories/macros out of the AI response.
- RLS policies get their own test queries — verifying a private log truly returns zero rows to a non-owner is the one guarantee the app's entire trust model depends on.
- No end-to-end browser test suite in this phase — YAGNI for a prototype at this stage.

## 9. Decisions Log

- **Auth:** email-only for this phase. Phone auth needs an SMS provider (Twilio) configured in Supabase — deferred, can be added later without a data model change.
- **Notifications:** streak-risk reminder time is a UI-only preference stored on the user record. No real push notification delivery (would need a service worker, push subscriptions, VAPID keys, and a scheduled server-side job — out of scope for this phase).
- **Deployment:** local dev only for now (`npm run dev` against a Supabase project). It's a static SPA build, so deploying to Vercel/Netlify later is straightforward.
- **Platform:** web app first, installable as a PWA. Native iOS App Store distribution was evaluated and explicitly deferred — it requires an Apple Developer Program account ($99/yr), a Mac + Xcode (or a paid cloud build service), wrapping the React app in a native shell (e.g. Capacitor, since Apple rejects bare "website-in-a-wrapper" submissions), in-app content moderation/account deletion for App Review's user-generated-content requirements, and typically weeks of review-cycle buffer. None of the web app work is wasted if this is revisited — Capacitor wraps the same codebase later.
- **AI tier:** free-tier Gemini for this phase (see §5 for caveats), with a provider-agnostic interface to ease a future upgrade.

## 10. Explicitly Out of Scope

Barcode scanning, restaurant menu database, Apple Health/wearable sync, in-app messaging, algorithmic feed ranking, Android-specific anything, real push notifications, native App Store distribution, comments/likes on the feed, an admin UI for managing rewards.

## 11. Build Phasing

1. **Foundation + Onboarding/Auth** — project scaffold, Supabase setup, RLS policies, auth + onboarding screens.
2. **Friends + Feed** — friend search/requests, seeded mock friends/logs, populated feed.
3. **Log flow** — photo capture, optional description, Gemini estimate via Edge Function, editable fields, post + streak increment.
4. **Streaks & Rewards** — streak display, rewards marketplace, redemption RPC.
5. **Profile & Settings polish** — own stats, calendar history, settings screen.
