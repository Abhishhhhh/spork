# Spork — Completion Plan
*Created: 2026-09-02*

> **For Hermes:** Implement task-by-task. Every task follows RED → GREEN → REFACTOR.  
> Run `npm test` and `npx tsc --noEmit` after every task. Both must be green before moving on.

---

## Goal
Complete Spork to a fully working, retention-optimised, release-ready state.  
Every tab in the bottom bar does something real. Every migration is applied. No orphan files.

## Tech stack reminder
- React 19 + TypeScript + Vite + Tailwind CSS 4
- Supabase (Postgres + Auth + Storage + Edge Functions)  
- TanStack Query v5, Zustand v5, React Router v7
- Vitest for unit tests (`npm test`), TypeScript compiler for types (`npx tsc --noEmit`)
- Design tokens: `bg-background #FAF7F0`, `text-primary #231815`, `text-muted #8B8680`, `border-border #E8E2D8`, `text-error #C0392B`

## Overall sequence

```
Phase 0  Database migrations          (unblocks everything)
Phase 1  Cleanup orphan files
Phase 2  Streaks & Rewards screen     (the 🔥 tab — biggest visible gap)
Phase 3  Profile & Settings screen    (the 👤 tab)
Phase 4  Gemini key + AI smoke test   (unblocks real AI flow)
Phase 5  Acceptance sweep             (every tab, every flow, verify real)
```

---

## Phase 0 — Database migrations
*Unblocks caption, satiety, protein_goal. Must go first — everything downstream reads these columns.*

### Task 0.1 — Apply migration 0005 (protein_goal)
**Files:** `supabase/migrations/0005_protein_goal.sql` (already written)

**Steps:**
1. Open Supabase Dashboard → SQL Editor → New query
2. Paste contents of `0005_protein_goal.sql`:
   ```sql
   alter table users add column if not exists protein_goal int;
   ```
3. Click Run. Verify: "Success. No rows returned."
4. Verify column exists: run `select protein_goal from users limit 1;` — should not error

**Verification:** `npx tsc --noEmit` still clean (types already updated in `database.types.ts`)

---

### Task 0.2 — Apply migration 0006 (caption + satiety)
**Files:** `supabase/migrations/0006_caption_satiety.sql` (already written)

**Steps:**
1. SQL Editor → New query, paste:
   ```sql
   alter table logs add column if not exists caption text;
   alter table logs add column if not exists satiety text check (satiety in ('loved_it','good','okay','not_great'));
   ```
2. Run. Verify success.
3. Confirm: `select caption, satiety from logs limit 1;` returns without error

**Verification:** `npm test` still 101/101

---

## Phase 1 — Cleanup orphan files

### Task 1.1 — Delete orphan onboarding screens + legacy routes

**Files to delete:**
- `src/screens/onboarding/CalorieGoal.tsx` (replaced by `Basics.tsx` + `Goal.tsx`)
- `src/screens/onboarding/GoalPace.tsx` (replaced by `Activity.tsx`)
- `src/screens/onboarding/GoalPacePreview.tsx` (dev-only helper)

**Files to modify:**
- `src/App.tsx` — remove `/onboarding/calorie-goal` and `/onboarding/pace` legacy routes + their imports

**Steps:**
1. Delete the three files above
2. In `App.tsx` remove:
   - `import CalorieGoal from './screens/onboarding/CalorieGoal'`
   - `import GoalPace from './screens/onboarding/GoalPace'`
   - The two legacy `<Route>` blocks for `/onboarding/calorie-goal` and `/onboarding/pace`
3. Run `npx tsc --noEmit` — must be 0 errors
4. Run `npm test` — must be 101/101

---

## Phase 2 — Streaks & Rewards screen

The 🔥 tab currently shows "coming in a later phase." This is the core retention loop.

### What to build
- **Top section:** Big flame + effective streak count + "X day streak" headline
- **Progress bar:** days logged toward next milestone (7 / 30 / 100)
- **"At risk" warning:** if today's log hasn't happened yet, show "Log today to keep your streak"
- **Streak history mini-calendar:** last 14 days, dot = logged, empty = missed (no tap needed, visual only)
- **Rewards marketplace:** grid of partner offer cards — locked (greyed, shows milestone needed) vs unlocked
- **Reward detail + redeem:** tap unlocked → modal with offer detail + Redeem button → `redeem_reward()` RPC → shows mock code

### Retention hooks baked in
- "At risk" warning nudges same-day logging
- Milestone confetti at 7/30/100 (CSS animation, no library)
- Locked rewards create desire — you can SEE what you'll unlock at 7 days

---

### Task 2.1 — Write `useStreakData` hook + tests

**Test file:** `src/hooks/useStreakData.test.ts` (new)  
**Implementation:** `src/hooks/useStreakData.ts` (new)

**What it does:** Returns the current user's effective streak, days-to-next-milestone, whether today is logged, and last 14 days of log dates.

**RED — write tests first:**
```typescript
// src/hooks/useStreakData.test.ts
import { describe, expect, it } from 'vitest'
import { computeStreakMeta } from '../hooks/useStreakData'

describe('computeStreakMeta', () => {
  it('next milestone is 7 when streak is 0', () => {
    const r = computeStreakMeta(0)
    expect(r.nextMilestone).toBe(7)
    expect(r.daysToMilestone).toBe(7)
    expect(r.milestoneProgress).toBe(0)
  })
  it('next milestone is 7 when streak is 4', () => {
    const r = computeStreakMeta(4)
    expect(r.nextMilestone).toBe(7)
    expect(r.daysToMilestone).toBe(3)
    expect(r.milestoneProgress).toBeCloseTo(4/7, 2)
  })
  it('next milestone is 30 when streak is 7', () => {
    const r = computeStreakMeta(7)
    expect(r.nextMilestone).toBe(30)
    expect(r.daysToMilestone).toBe(23)
  })
  it('next milestone is 100 when streak is 50', () => {
    const r = computeStreakMeta(50)
    expect(r.nextMilestone).toBe(100)
  })
  it('returns null milestone when streak >= 100', () => {
    const r = computeStreakMeta(100)
    expect(r.nextMilestone).toBeNull()
    expect(r.daysToMilestone).toBeNull()
    expect(r.milestoneProgress).toBe(1)
  })
})
```

**GREEN — implement:**
```typescript
// src/hooks/useStreakData.ts
export interface StreakMeta {
  nextMilestone: number | null
  daysToMilestone: number | null
  milestoneProgress: number   // 0–1
  prevMilestone: number
}

const MILESTONES = [7, 30, 100]

export function computeStreakMeta(streak: number): StreakMeta {
  const next = MILESTONES.find((m) => m > streak) ?? null
  const prev = MILESTONES.filter((m) => m <= streak).at(-1) ?? 0
  if (next === null) return { nextMilestone: null, daysToMilestone: null, milestoneProgress: 1, prevMilestone: prev }
  return {
    nextMilestone: next,
    daysToMilestone: next - streak,
    milestoneProgress: (streak - prev) / (next - prev),
    prevMilestone: prev,
  }
}
```

Then add the React hook wrapper (uses `useCurrentUser` + `useTodayStats`).

**Run:** `npm test` → 101 + 5 new = 106 passing

---

### Task 2.2 — Write `useRewards` hook

**File:** `src/hooks/useRewards.ts` (new)

**What it does:** Fetches all `rewards` rows + current user's `redemptions`. Returns each reward enriched with `{ isUnlocked, isRedeemed, redemptionCode, isExpired }`.

No tests needed for the hook itself (it's a Supabase query wrapper — too network-coupled). The enrichment logic is pure and gets a test:

```typescript
// In useRewards.test.ts
it('marks reward as unlocked when streak >= milestone', () => { ... })
it('marks reward as locked when streak < milestone', () => { ... })
it('marks reward as expired when expiry_date is in the past', () => { ... })
it('marks reward as redeemed when redemption row exists', () => { ... })
```

---

### Task 2.3 — Write `redeem_reward` Postgres RPC migration

**File:** `supabase/migrations/0007_redeem_reward_rpc.sql` (new)

```sql
-- RPC: checks eligibility server-side, generates code, inserts redemption.
-- Returns the code on success, raises an exception if ineligible.
create or replace function redeem_reward(p_reward_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_milestone int;
  v_user_streak int;
  v_code text;
  v_already_redeemed boolean;
begin
  -- Get milestone
  select milestone_required into v_milestone from rewards where id = p_reward_id;
  if not found then raise exception 'reward_not_found'; end if;

  -- Get caller's streak
  select streak_count into v_user_streak from users where id = auth.uid();
  if not found then raise exception 'user_not_found'; end if;

  -- Check eligibility
  if v_user_streak < v_milestone then
    raise exception 'streak_too_low: need %, have %', v_milestone, v_user_streak;
  end if;

  -- Check if already redeemed
  select exists(
    select 1 from redemptions where user_id = auth.uid() and reward_id = p_reward_id
  ) into v_already_redeemed;
  if v_already_redeemed then raise exception 'already_redeemed'; end if;

  -- Generate mock code
  v_code := upper(substring(md5(random()::text || p_reward_id::text), 1, 8));

  -- Insert redemption
  insert into redemptions (user_id, reward_id, code, status)
  values (auth.uid(), p_reward_id, v_code, 'redeemed');

  return v_code;
end;
$$;
```

Apply via Supabase Dashboard SQL Editor.

---

### Task 2.4 — Seed 3 partner rewards

**File:** `supabase/migrations/0008_seed_rewards.sql` (new)

```sql
insert into rewards (partner_name, offer_description, milestone_required, expiry_date) values
  ('MyFitnessPal',   '1 month Premium free',         7,   '2027-12-31'),
  ('Cult.fit',       '20% off any monthly plan',     30,  '2027-12-31'),
  ('Decathlon India','₹500 off orders above ₹3000',  100, '2027-12-31');
```

These are clearly demo/mock offers — no deceptive copy.

---

### Task 2.5 — Build `StreaksRewards.tsx` screen

**File:** `src/screens/rewards/StreaksRewards.tsx` (new, replaces placeholder)  
**Route update:** `src/App.tsx` — change `/home/rewards` to use `StreaksRewards`

**Sections:**
1. **Hero** — big 🔥 + streak number + "X day streak" / "Start your streak today"
2. **At-risk banner** — amber warning if today not logged and streak > 0: "Log a meal today to keep your streak 🔥"
3. **Progress bar to next milestone** — "4 days to your 7-day unlock"
4. **Mini streak calendar** — last 14 days as a row of dots: filled (logged) vs empty, labelled M T W T F S S
5. **Milestone badges** — 3 badge cards (7/30/100), filled when reached
6. **Rewards marketplace** — cards with partner logo placeholder, offer text, streak needed. Locked = greyed + lock icon. Unlocked = full colour + "Redeem" button
7. **Redeem flow** — tapping "Redeem" calls RPC → success shows modal with code + expiry

**Retention design choices:**
- Show the locked rewards prominently (DESIRE loop — you can see what you'll get)
- At-risk banner is the highest-retention nudge in this whole screen
- Calendar gives the user visual proof of their consistency

---

### Task 2.6 — Wire route + run full test suite

- Update `src/App.tsx`: `import StreaksRewards` + change `/home/rewards` element
- `npm test` → all passing
- `npx tsc --noEmit` → 0 errors
- Open `localhost:5173/home/rewards` in preview → visually verify all sections

---

## Phase 3 — Profile & Settings screen

Currently: avatar, name, username, calorie goal, sign out. Missing: own stats, calendar history, protein goal, privacy toggle, reminder time, edit profile.

### What to build
- **Stats ring** — today's calories vs goal (SVG ring, no library), protein progress bar
- **Weekly summary** — last 7 days avg calories + logged days count  
- **Calendar log history** — tap-to-see. Same 14-day dot pattern used in Streaks tab, but tappable — tapping a day shows that day's logs in a bottom sheet
- **Editable settings** — privacy default toggle, calorie goal, protein goal, reminder time (UI only, no push)
- **Edit profile** — change display name (username is immutable post-onboarding)

---

### Task 3.1 — Write `useProfileStats` hook + pure function tests

**Pure functions to test:**
```typescript
// src/lib/profileStats.ts
computeWeeklyAvgCalories(logs: LogRow[]): number | null
computeWeeklyLoggedDays(logs: LogRow[]): number
computeCalorieRingPct(todayCalories: number, goal: number): number  // 0-1, clamped
```

Write tests first, implement, run suite.

---

### Task 3.2 — SVG calorie ring component

**File:** `src/components/CalorieRing.tsx` (new)

Pure presentational — takes `pct: number` (0–1), `size: number`, `label: string`.  
Uses SVG `stroke-dasharray` / `stroke-dashoffset`. No external library.

No unit test (visual component) — verify in browser.

---

### Task 3.3 — Build `ProfileScreen.tsx` (full rewrite)

**Sections:**
1. **Header** — avatar (tappable to change), name, @username, 🔥 streak badge
2. **Today's stats** — CalorieRing + calories number + "X remaining" + protein bar
3. **Weekly summary card** — avg calories this week, days logged / 7
4. **Meal history** — last 14 days dot calendar (same component as Streaks tab — extract to `src/components/StreakCalendar.tsx` so both screens share it). Tap a day → inline list of that day's log entries (meal name + calories)
5. **Settings section:**
   - Privacy default toggle (public/private) — saves via Supabase update + TanStack Query invalidate
   - Calorie goal — inline editable number, save on blur/enter
   - Protein goal — same
   - Reminder time — time picker (HTML `<input type="time">`) — saves to `reminder_time`, displayed only
6. **Edit name** — tap name → inline text field
7. **Sign out** — stays at bottom, text-error style

**Key retention call:** The "days logged / 7 this week" widget creates a weekly completion compulsion. Users who see "4/7" want to make it 7/7.

---

### Task 3.4 — Extract shared `StreakCalendar` component

**File:** `src/components/StreakCalendar.tsx` (new)

Props: `logDates: string[]` (ISO date strings), `onDayTap?: (date: string) => void`

Used by both Streaks tab AND Profile tab. Ensures consistency and cuts duplication.

No unit test (visual) — verify in browser on both routes.

---

### Task 3.5 — Profile settings save logic

For each editable field, the pattern is:
```
user taps → local state edit → save on blur → supabase.from('users').update({ field: value }).eq('id', userId) → invalidate ['currentUser']
```

Error handling: revert local state if save fails, show inline error.

**No new test** — covered by TypeScript types + manual browser verification.

---

### Task 3.6 — Run full suite + visual check

- `npm test` → all passing
- `npx tsc --noEmit` → 0 errors
- Open profile tab: verify ring, weekly summary, calendar, settings all render
- Toggle privacy → check it persists on page refresh
- Edit calorie goal → check it saves

---

## Phase 4 — Gemini key + AI smoke test

### Task 4.1 — Set Gemini API key as Supabase secret

**Steps (user action required):**
1. Go to [aistudio.google.com](https://aistudio.google.com) → Get API key → Create free key
2. Supabase Dashboard → Edge Functions → `estimate-meal` → Secrets → Add `GEMINI_API_KEY`
3. Or via CLI: `supabase secrets set GEMINI_API_KEY=<your-key>`

**Verification:**  
Take a photo of any food on the log screen → tap "Analyse with AI ✨" → should get a breakdown in 3–5 seconds instead of falling through to manual entry.

---

### Task 4.2 — Update Edge Function model alias (already done, verify)

The Edge Function already uses `gemini-flash-lite-latest` (the rolling alias). Confirm it's still valid:
- In the Supabase Dashboard → Edge Functions → `estimate-meal` → view code
- Look for `GEMINI_URL` — confirm it points to a non-deprecated model

---

## Phase 5 — Acceptance sweep

*Every tab. Every flow. Real auth session required.*

### Acceptance checklist (UAT)

#### Onboarding
- [ ] Welcome → sign up with new email → all 8 steps complete → lands on feed
- [ ] Back button on every step goes to the correct previous step
- [ ] Basics values restore correctly when navigating back
- [ ] Goal screen: lose/maintain/gain all show/hide target weight field correctly
- [ ] Activity screen: changing job type + workout days updates calorie preview live
- [ ] Calorie goal persists after onboarding completes (check Supabase `users` row)

#### Log flow
- [ ] Capture: daily budget bar shows today's logged calories
- [ ] Capture: "No photo" → goes to manual entry with blank fields
- [ ] Loading: blurred photo + animated dots appear during AI call
- [ ] EstimateEdit: AI item breakdown shows and collapses
- [ ] EstimateEdit: portion multiplier (½, 1×, 1.5×, 2×) scales all macros
- [ ] EstimateEdit: meal type chips select correctly
- [ ] EstimateEdit: satiety picker is optional, all 4 options work
- [ ] EstimateEdit: caption field text appears on feed post
- [ ] Celebration: shows meal name + streak count + budget bar + "View post" link
- [ ] "View post" → navigates to Meal Detail of that exact post

#### Feed
- [ ] Caption shows under meal name on feed cards
- [ ] Macro strip (P/C/F) shows on cards with macro data
- [ ] Like button toggles optimistically
- [ ] Comment count opens Meal Detail
- [ ] Bell icon shows unread count badge

#### Streaks & Rewards (🔥 tab)
- [ ] Effective streak shows correctly (not raw DB value if streak is broken)
- [ ] At-risk banner appears if today has no log
- [ ] Progress bar fills correctly toward next milestone
- [ ] 14-day calendar shows correct filled/empty dots
- [ ] Locked rewards show greyed with milestone text
- [ ] Unlocked reward (if streak ≥ milestone) shows "Redeem" button
- [ ] Redeem → RPC called → code shown in modal
- [ ] Already-redeemed reward shows code, not "Redeem" button

#### Friends
- [ ] Search by username finds users
- [ ] Send request → appears in "Outgoing" section
- [ ] Accept incoming request → moves to "Your Circle"
- [ ] Friend profile shows streak, avg calories, public log grid

#### Notifications
- [ ] Bell badge clears on opening inbox
- [ ] Like notification → tap → opens Meal Detail
- [ ] Comment notification → tap → opens Meal Detail

#### Profile (👤 tab)
- [ ] Calorie ring fills correctly relative to today's logs
- [ ] Protein progress bar shows
- [ ] Weekly summary correct (count logged days, avg calories)
- [ ] 14-day calendar dots match actual log dates
- [ ] Tap a calendar day → shows that day's meals inline
- [ ] Privacy toggle saves and persists on reload
- [ ] Calorie goal inline edit saves
- [ ] Protein goal inline edit saves
- [ ] Reminder time saves (UI only)
- [ ] Sign out clears session + redirects to welcome

---

## Files that will change

| File | Change |
|---|---|
| `src/screens/rewards/StreaksRewards.tsx` | New — full screen |
| `src/screens/rewards/RewardsPlaceholder.tsx` | Delete |
| `src/screens/profile/ProfileScreen.tsx` | Full rewrite |
| `src/components/CalorieRing.tsx` | New component |
| `src/components/StreakCalendar.tsx` | New shared component |
| `src/hooks/useStreakData.ts` | New |
| `src/hooks/useRewards.ts` | New |
| `src/lib/profileStats.ts` | New pure functions |
| `src/lib/profileStats.test.ts` | New tests |
| `src/lib/rewardsMeta.ts` | New pure functions (enrichment logic) |
| `src/lib/rewardsMeta.test.ts` | New tests |
| `src/App.tsx` | Route updates + orphan import removal |
| `src/screens/onboarding/CalorieGoal.tsx` | **Delete** |
| `src/screens/onboarding/GoalPace.tsx` | **Delete** |
| `src/screens/onboarding/GoalPacePreview.tsx` | **Delete** |
| `supabase/migrations/0007_redeem_reward_rpc.sql` | New |
| `supabase/migrations/0008_seed_rewards.sql` | New |

---

## Test targets after completion

```bash
npm test             # target: 115+ passing (adding ~14 new tests across profileStats + rewardsMeta + streakMeta)
npx tsc --noEmit     # target: 0 errors
```

---

## Risks & notes

| Risk | Mitigation |
|---|---|
| `redeem_reward()` RPC needs Supabase Deploy | Apply via SQL Editor like every other migration |
| Gemini key required for AI path | Document clearly — manual fallback works without it |
| Calendar component touches dates — timezone bugs possible | Always use local date strings (`yyyy-mm-dd`), never UTC midnight comparisons |
| Profile settings update race conditions | Disable field on pending save, revert on error |
| Orphan file deletion breaks no routes | Confirmed: `CalorieGoal`/`GoalPace` routes already replaced, only the legacy fallback routes use them |

---

## Definition of done

- [ ] All 5 phases complete
- [ ] `npm test` → 115+ passing, 0 failing
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Every checkbox in the UAT checklist passes
- [ ] No "coming soon" placeholder text anywhere in the app
- [ ] No orphan files in `src/screens/onboarding/`
- [ ] Both pending migrations applied and verified in Supabase
- [ ] Rewards seeded (3 demo offers visible in the 🔥 tab)
