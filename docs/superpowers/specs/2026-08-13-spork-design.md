# Spork — Design Spec

**Date:** 2026-08-13 (visual design system and navigation revised 2026-08-15 — see §2 and §10; Phase 3 Friends+Feed scoped 2026-08-15 — see §5, §10, §12)
**Status:** Approved. Phase 1 (Foundation/Onboarding), Phase 2 (visual/nav retrofit), and Phase 3 (Friends + Feed) implemented and merged.

## 1. Concept

Spork is a social-first calorie & nutrition tracker — "Hevy, but for food." Users log meals via photo, get an AI-generated calorie/macro estimate, and post publicly to a friend feed or keep the log private. Daily logging streaks are the retention loop; streak milestones unlock partner reward offers.

Mobile-first web app, iOS-styled UI, installable as a PWA. Ship as a web app first — no native App Store distribution in this phase (see §10, Platform Decision).

## 2. Visual Design System

Adopted 2026-08-15 from a reference design the user provided, replacing the original generic "Hevy-style, lots of white space" direction with concrete tokens. Fully neutral palette — no accent color anywhere (including the streak flame), by explicit choice over keeping a warm accent.

| Token | Value | Usage |
|---|---|---|
| `background` | `#FAF7F0` | App background |
| `primary` | `#231815` | Buttons, active tab, selected states, filled elements |
| `text` | `#231815` | Body text |
| `muted` | `#8B8680` | Secondary text, placeholders, unselected tab icons/labels |
| `border` | `#E8E2D8` | Card borders, input outlines |
| `error` | `#C0392B` | Error/validation text |

- **Typography:** system font stack (no external web font) — avoids an extra network request for a PWA; close enough to the reference's clean geometric sans.
- **Shape language:** buttons are fully pill-shaped (`rounded-full`), not the original `rounded-2xl`.
- **Logo:** a small custom inline SVG fork mark in a rounded-square badge, replacing the 🍴 emoji everywhere the wordmark appears (Welcome, Sign In).
- **Copy:** Welcome and Sign In adopt the reference's copy — Welcome gets the tagline "Track food like you train." plus three feature bullets (photo-first logging, daily streaks, a friend feed) with icons; Sign In becomes "Create your account" / "Email and password for now — phone sign-in is coming." with a single "Continue" button whose label doesn't change between sign-up/sign-in modes.
- **Explicitly deferred:** a "Forgot password?" link appears in the reference design but is **not** being built now — real password reset (email delivery + reset-confirmation screen) is new functionality, not a visual change, and is scoped as its own future addition rather than bundled into this retrofit.

## 3. Tech Stack & Project Structure

- **React + Vite + TypeScript + Tailwind CSS** — SPA, not Next.js. No SEO/SSR need for an auth-gated app; Vite keeps the build simple.
- **Vite PWA plugin** — manifest + service worker so the app is installable via "Add to Home Screen," with iOS status-bar/splash-screen meta tags. PWA manifest `theme_color` matches the `primary` token in §2.
- **React Router** — bottom tab bar navigation + stack-style pushes for detail screens (e.g. Feed → Meal Detail).
- **Supabase** — Auth (email only for this phase — see §10), Postgres, Storage (meal/profile photos), Edge Functions (AI proxy).
- **TanStack Query** — server state/caching (logs, friends, feed, rewards).
- **Zustand** — the one piece of client-only state: the in-progress log-flow draft (photo → estimate → edits before posting).
- **Folder structure:**
  - `src/screens/*` — one folder per tab/flow
  - `src/components/*` — shared UI (cards, tab bar, progress ring, flame icon)
  - `src/lib/*` — supabase client, calorie-estimate client, streak logic
  - `src/hooks/*` — data-fetching hooks per entity

## 4. Data Model

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
  reminder_time time,              -- UI-only preference, no real push notification (see §10)
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

A redemption row is only ever created at the moment of redemption, so it's inserted with status `'redeemed'` directly — there's no separate "code generated but not yet redeemed" step in this flow. `'expired'` is a **derived display state**, computed by comparing the reward's `expiry_date` to the current date at read time, the same no-cron pattern used for streaks (§4) — no background job flips the stored status.

**Photo storage**: a **private** Supabase Storage bucket (not public), with storage policies mirroring the `logs` RLS — object paths encode `user_id`, and a photo is only fetchable by its owner or by an accepted friend when the corresponding log is public. This is belt-and-suspenders: even a leaked URL doesn't work without passing the same policy check.

**Streak logic — lazy evaluation, no cron job needed:**

`streak_count` and `streak_last_log_date` update inside the same `log_meal()` RPC that inserts a log:
- Same day as last log → no change (already logged today)
- Exactly one day after last log → increment
- Gap of more than one day → reset to 1

To *display* a broken streak before the user's next log (there's no background job to proactively zero it out), the UI derives an "effective streak" from `streak_last_log_date` at read time: if it's today or yesterday, show the stored count; if older, show 0. The stored value gets corrected to 0 lazily on the next `log_meal()` call.

## 5. Screens & Navigation

Bottom tab bar, **5 items: Feed / Streaks / Log (center, raised, unlabeled "+" button) / Friends / Profile**. The center button is visually distinct — a filled circle with no label — and always opens the Log flow; `Feed`, `Streaks`, `Friends`, and `Profile` keep icon+label. (Revised 2026-08-15 from the original 4-tab layout — Friends is now a first-class tab rather than reached only through onboarding or a Feed icon.)

**Onboarding:** Welcome → Sign in (email) → Profile setup (name, unique username, photo) → Calorie goal (manual input or auto-suggest from height/weight/age/**sex**/activity, editable; defaults to 2000 kcal as a starting point) → Privacy default choice ("Public by default" / "Private by default") → Add first friends (skip option).

Height/weight/age/sex/activity are used only to compute the suggested calorie goal client-side at that moment — they are not persisted. Only the resulting `calorie_goal` is stored on the user record; if the user wants to recompute the suggestion later, they re-enter those inputs. The `sex` field (`'male' | 'female'`) selects the correct Mifflin-St Jeor constant (+5 male / −161 female) instead of the sex-neutral approximation used in the initial Phase 1 build — see §10.

**Feed:** Empty state prompts adding friends / logging first meal. Populated state: chronological cards, no algorithm — friend avatar/handle, meal photo (omitted for now if absent — no log flow exists yet to attach one, see §12 Phase 3 seeding notes), calorie count, meal tag, timestamp, flame icon if the friend's effective streak is > 0 (streak is treated as broken once a day is missed, even before `streak_count` itself is next updated — see `getEffectiveStreak` in §4/§10). Feed shows friends' logs only, not the viewer's own (their own history lives on Profile). Tap card → friend profile. Query: `logs` joined to `users`, filtered to `user_id <> auth.uid()`, ordered by `created_at desc` — RLS (§4) transparently returns only what's permitted, so the feed can never over-fetch a private log.

**Log flow (see §6 for detail).**

**Meal detail view:** full photo, calories + each macro (estimate vs. final), meal type, timestamp, edit option (own logs only).

**Friend profile:** public logs grid (photo + calories + meal type), current streak (`users.streak_count`), quick stats if permitted (avg daily calories from public logs, most logged meal type — both computed client-side from the same RLS-filtered query the feed uses, so a private log is excluded by construction, not by a second rule that could drift out of sync) — fully private-default users show no streak/stats to friends at all, regardless of individual public logs.

**Friends (tab):** search by username, "Your Circle" (accepted friends list), incoming/outgoing pending request sections with Accept/Decline. "Find from Contacts" (mocked, no real contacts access — spec'd for this tab originally, not built in Phase 3, revisit if it becomes a priority) and the suggested-users section for cold-start discovery (per user feedback during Phase 1 testing — see §10) remain deferred; Phase 3 seeds enough real friend data that suggestions could be revisited, but weren't scoped into this pass. Built in Phase 3: real search, Your Circle, incoming/outgoing requests with Accept/Decline, all backed by live Supabase data (the tab existed only as a placeholder starting with the Phase 2 visual retrofit).

**Streaks & Rewards:** current streak (big flame + number), progress bar to next milestone (7/30/100 days). Rewards marketplace: grid/list of partner offers, locked (grayed, shows milestone needed) vs. unlocked. Reward detail → Redeem → mock code generated → status becomes "Redeemed" with expiry countdown.

**Profile & Settings:** own stats (daily calorie total vs. goal, progress ring), history as a **calendar view** (tap a day to see that day's log(s) — matches Hevy's proven pattern for streak visualization). Settings: edit profile, privacy default, notification preference (streak-risk reminder time — UI-only, no real push), block/report list.

## 6. Log Flow (core feature)

1. Tap the center **+** tab → camera/upload → photo preview shown.
2. Optional text field: *"Add details (improves accuracy)"* — e.g. "3 breads and 5 eggs" or "200g rice, 400g chicken breast with mustard."
3. Tap **Get Estimate** → one call to a Supabase Edge Function (`estimate-meal`), which holds the Gemini API key server-side (never exposed to the client) and calls **Gemini 2.5 Flash** with the photo + description together. The prompt instructs the model to: identify each food item, prioritize stated quantities over visual guessing when text is given, apply standard per-100g nutrition values, and return structured JSON — per-item breakdown plus totals for calories/protein/carbs/fat, and a confidence level (`low`/`medium`/`high`).
4. ~3–5s loading state → editable **calories, protein, carbs, fat** fields + meal name + meal type (auto-suggested by time of day, editable) + visibility toggle (defaults to the user's onboarding privacy setting).
5. **Fallback rule:** if the Edge Function call fails, times out, or returns something unparseable, silently fall back to blank manual-entry fields on the same screen. The log is never blocked by an AI failure.
6. Disclaimer shown on the first few logs: *"Estimate — tap to adjust."*
7. Tap **Post** → brief celebratory animation → streak increments per the logic in §4.

**AI provider notes:**
- Free tier (Google AI Studio key) supports multimodal (photo + text) input at no cost, but has modest rate limits (roughly 10–15 requests/minute, 250–1,500/day depending on model/account — Google has been tightening free-tier terms) and its terms allow content to be used to improve Google's products. Acceptable for this phase (a handful of friends testing); revisit with a paid key if usage grows.
- The Edge Function is written provider-agnostically (a single `estimateMeal(photo, description)` interface) so swapping to a paid key or a different vision API later is a config change, not a rewrite.
- Even with precise quantities, this is an LLM approximation, not a lab measurement or database lookup — "close," not certified-accurate, for well-documented foods. The "Estimate — tap to adjust" framing manages this honestly.

## 7. Key Rules (unchanged from original requirements)

- Private logs must never appear in any friend-facing feed/query, and must never leak into aggregate stats (enforced at the RLS layer, not just app code).
- Streak increments once per day if the user logs at least one meal (public or private); resets to 0 if a full calendar day passes with no log.
- No comments/likes — the feed is for visibility/accountability only.
- No dark patterns on rewards — no paywalled streak-freeze, no manipulative copy.

## 8. Error Handling & Edge Cases

- AI estimate failure → manual entry fallback (§6) — the primary error path called out by the spec.
- Duplicate/invalid usernames at signup → inline validation before submit.
- Friend request to self, or duplicate pending requests → blocked at the `friendships` unique constraint (§4).
- Ineligible reward redemption → blocked server-side by `redeem_reward()`, not just hidden in the UI.
- Photo upload failure (bad network) → retry affordance; the in-progress log draft is preserved in the Zustand store so the user doesn't lose it.
- Empty states: Feed (no friends / no logs yet), Rewards (nothing unlocked yet).

## 9. Testing Approach

Following the **test-driven-development** skill during implementation:
- Unit tests for logic that's easy to get subtly wrong: streak lazy-evaluation math, meal-type time-of-day suggestion, parsing calories/macros out of the AI response, the calorie-goal formula (both sexes, per §10).
- RLS policies get their own test queries — verifying a private log truly returns zero rows to a non-owner is the one guarantee the app's entire trust model depends on.
- No end-to-end browser test suite in this phase — YAGNI for a prototype at this stage.

## 10. Decisions Log

- **Auth:** email-only for this phase. Phone auth needs an SMS provider (Twilio) configured in Supabase — deferred, can be added later without a data model change.
- **Notifications:** streak-risk reminder time is a UI-only preference stored on the user record. No real push notification delivery (would need a service worker, push subscriptions, VAPID keys, and a scheduled server-side job — out of scope for this phase).
- **Deployment:** local dev only for now (`npm run dev` against a Supabase project). It's a static SPA build, so deploying to Vercel/Netlify later is straightforward.
- **Platform:** web app first, installable as a PWA. Native iOS App Store distribution was evaluated and explicitly deferred — it requires an Apple Developer Program account ($99/yr), a Mac + Xcode (or a paid cloud build service), wrapping the React app in a native shell (e.g. Capacitor, since Apple rejects bare "website-in-a-wrapper" submissions), in-app content moderation/account deletion for App Review's user-generated-content requirements, and typically weeks of review-cycle buffer. None of the web app work is wasted if this is revisited — Capacitor wraps the same codebase later.
- **AI tier:** free-tier Gemini for this phase (see §6 for caveats), with a provider-agnostic interface to ease a future upgrade.
- **Visual design system (2026-08-15):** replaced the original generic "Hevy-style" direction with concrete tokens (§2) drawn from a reference design the user provided, after Phase 1 was already built and merged. Chose the fully neutral palette option over keeping a warm accent color for streaks/rewards.
- **Navigation restructure (2026-08-15):** Friends promoted to a first-class 5th tab (previously reachable only during onboarding); Log becomes a visually distinct raised, unlabeled center button rather than an equal-weight labeled tab. Triggers a retrofit of all already-built Phase 1 screens to the new tokens and tab structure.
- **Calorie formula accuracy (2026-08-15):** added a required `sex` field to the calorie-goal calculator, switching from the sex-neutral −78 midpoint approximation (Phase 1's original implementation) to the exact Mifflin-St Jeor constants (+5 male / −161 female).
- **Forgot password — explicitly deferred (2026-08-15):** the reference design includes a "Forgot password?" link; real password reset is new functionality (email delivery + confirmation screen), not a visual change, and is intentionally left out of the visual/nav retrofit.
- **Suggested friends in onboarding — deferred to Phase 3 (flagged 2026-08-14):** user feedback during Phase 1 testing asked for the Add Friends screen to proactively recommend users, not just search on demand. No signal to recommend from yet at cold-start (zero mutual friends/activity); Phase 3 seeds mock friends/logs, which is where recommendations become meaningful. The Friends tab's "you might know" section (§5) is the eventual home for this.
- **Mock friend seeding approach (2026-08-15):** `users.id references auth.users`, so a seeded "friend" needs a real Supabase Auth account behind it, not just a database row. Rather than scripting this via the Supabase Admin API (which needs the more sensitive service-role key), 5 real test accounts are signed up through the app itself — same as Phase 1's own testing — then backfilled with realistic profile/log/streak data via a one-time SQL seed script once their real user IDs are known. These 5 accounts are explicitly throwaway/demo data, to be deleted later.
- **Seed data shape (2026-08-15):** 3 accepted friends with varying streak counts (0, 3, 15) and a private log each (to exercise the privacy guarantee, not just the happy path), 1 pending incoming request (exercises Accept/Decline), 1 unconnected user (exercises search-and-discover). Avatars use the existing colored-initial fallback; seeded logs omit `photo_url` (nullable, matches a photo-less manual entry) since no image assets are available in this environment.
- **Friends tab and Friend Profile scope (2026-08-15):** Phase 3 builds the full Friends tab (search, Your Circle, incoming/outgoing requests, Accept/Decline) and a real Friend Profile screen powered by seeded data, rather than deferring either — both were originally scoped for later phases only because Log flow/Streaks didn't exist yet to populate them; seeding sidesteps that dependency.

## 11. Explicitly Out of Scope

Barcode scanning, restaurant menu database, Apple Health/wearable sync, in-app messaging, algorithmic feed ranking, Android-specific anything, real push notifications, native App Store distribution, comments/likes on the feed, an admin UI for managing rewards, real password reset (see §10).

## 12. Build Phasing

1. **Foundation + Onboarding/Auth** — project scaffold, Supabase setup, RLS policies, auth + onboarding screens. **Complete, merged to master.**
2. **Visual & navigation retrofit** — apply §2's design system and §5's 5-tab structure to Phase 1's already-built screens; no backend/schema changes. *(New phase, inserted 2026-08-15 — not part of the original phasing.)* **Complete, merged to master.**
3. **Friends + Feed** — seed 5 mock friend accounts, full Friends tab (search, Your Circle, requests, Accept/Decline), populated Feed, and a real Friend Profile screen — all backed by the seeded data since Log flow/Streaks don't exist yet to generate it organically. **Complete, merged to master.**
4. **Log flow** — photo capture, optional description, Gemini estimate via Edge Function, editable fields, post + streak increment.
5. **Streaks & Rewards** — streak display, rewards marketplace, redemption RPC.
6. **Profile & Settings polish** — own stats, calendar history, settings screen.
