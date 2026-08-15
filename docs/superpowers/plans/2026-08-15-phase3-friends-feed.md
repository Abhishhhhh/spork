# Phase 3: Friends + Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed 5 mock friend accounts, then build a populated Feed, a full Friends tab (search, Your Circle, incoming/outgoing requests, Accept/Decline), and a real Friend Profile screen — all working end-to-end against the seeded data, since the real Log flow and Streaks systems don't exist yet to generate this data organically.

**Architecture:** Pure application-layer feature work on top of the already-complete Phase 1 schema and RLS policies — no schema or policy changes. Every query is written to rely on RLS to filter what's visible (never an app-side `if (private) hide()` check), so the privacy guarantee holds even if a component has a bug. Two new pure-function modules (`streak.ts`, `friendStats.ts`) hold the only real business logic in this phase and get TDD unit tests; everything else is data-fetching hooks and presentational screens.

**Tech Stack:** Same as Phases 1-2 — React, Vite, TypeScript, Tailwind CSS v4, React Router, TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-13-spork-design.md` (§4 Data Model, §5 Screens & Navigation, §10 Decisions Log, §12 Build Phasing item 3)

## Global Constraints

- No backend/schema changes — Phase 1's `friendships`/`logs` tables and RLS policies already support everything this phase needs. (spec §12 item 3)
- Every query that could expose a private log must rely on RLS to filter results, never on an app-side visibility check alone. (spec §4, §7)
- Feed shows only friends' logs, not the viewer's own (their own history lives on Profile). (spec §5)
- Feed's flame icon and Friend Profile's streak must use the same "effective streak" derivation as the rest of the app: the stored `streak_count` only displays if `streak_last_log_date` is today or yesterday, otherwise 0. (spec §4)
- A friend profile's streak and quick stats (avg calories, most-logged meal type) are hidden entirely when that user's `privacy_default` is `'private'`, regardless of any individual public logs — this is a UI-level rule on top of RLS, not a replacement for it. (spec §5)
- No comments/likes anywhere. (spec §7, carried over)
- Mobile-first, `max-width: 430px` centered layout, neutral design tokens (`bg-primary`, `text-primary`, `text-background`, `text-muted`, `border-border`, `text-error`), pill-shaped (`rounded-full`) buttons — unchanged from Phase 2. (spec §2)

---

## Before You Start: Human-Action Prerequisite

Task 1 needs 5 real Supabase Auth accounts (the `users.id` column references `auth.users`, so a seeded "friend" needs a real account behind it, not just a database row) plus your own existing test account's user id. This is genuinely human-only work — no coding subagent can sign up accounts through a running browser session. If you're executing this plan via subagent-driven-development, do Task 1 yourself as the controller rather than dispatching it; Tasks 2-5 are normal implementation work.

---

### Task 1: Seed Mock Friend Accounts

**Files:**
- Create: `docs/superpowers/notes/2026-08-15-phase3-seed-accounts.md`

**Interfaces:**
- Produces: 5 real `users` rows (usernames `mayaruns`, `devlifts`, `sofiaeats`, `jonasq`, `priyakitchen`) with associated `friendships` and `logs` rows — consumed by every later task's manual verification steps.

- [ ] **Step 1 (human action): sign up 5 accounts through the running app**

Run `npm run dev`. For each row below, visit `/welcome` → "Get started" → sign up with that email/password → complete Profile Setup (exact name + username, skip the photo) → Calorie Goal (leave the default 2000, tap Continue) → Privacy ("Public by default") → Add Friends ("Skip for now"). Sign out (Profile tab → Sign out) before starting the next one.

| Email | Password | Username | Name |
|---|---|---|---|
| spork.friend.maya@gmail.com | friendseed123 | mayaruns | Maya Chen |
| spork.friend.dev@gmail.com | friendseed123 | devlifts | Dev Patel |
| spork.friend.sofia@gmail.com | friendseed123 | sofiaeats | Sofia Martins |
| spork.friend.jonas@gmail.com | friendseed123 | jonasq | Jonas Weber |
| spork.friend.priya@gmail.com | friendseed123 | priyakitchen | Priya Nair |

- [ ] **Step 2 (human action): identify your own real account**

Tell whoever is running this plan the username of the real account you'll actually use to view this seeded data day-to-day (an existing test account from Phases 1-2, not one of the 5 above).

- [ ] **Step 3: look up all 6 user ids**

In the Supabase Dashboard SQL Editor, run:

```sql
select username, id from users
where username in ('mayaruns','devlifts','sofiaeats','jonasq','priyakitchen','<your_real_username>')
order by username;
```

Expected: 6 rows. Note each username's `id`.

- [ ] **Step 4: run the seed script**

Substitute the 6 real ids from Step 3 into every `<...>` placeholder below (there are no other unknowns in this script — every value except the 6 ids is final), then run the whole thing in the SQL Editor:

```sql
-- Friendships: 3 accepted, 1 pending incoming (jonas -> you).
-- @priyakitchen intentionally gets no friendship row — that's what makes
-- her "unconnected, findable only via search."
insert into friendships (requester_id, recipient_id, status) values
  ('<real_user_id>', '<maya_id>', 'accepted'),
  ('<real_user_id>', '<dev_id>', 'accepted'),
  ('<real_user_id>', '<sofia_id>', 'accepted'),
  ('<jonas_id>', '<real_user_id>', 'pending');

-- Streaks: maya=15, dev=3 (both "active" as of today, so the flame icon
-- and effective-streak logic show them); sofia=0.
update users set streak_count = 15, streak_last_log_date = current_date where id = '<maya_id>';
update users set streak_count = 3, streak_last_log_date = current_date where id = '<dev_id>';
update users set streak_count = 0, streak_last_log_date = current_date - interval '10 days' where id = '<sofia_id>';

-- Maya's logs: 5 total, 4 public + 1 private (exercises the privacy guarantee).
insert into logs (user_id, description, meal_type, visibility, calories_final, protein_final_g, carbs_final_g, fat_final_g, created_at) values
  ('<maya_id>', 'Overnight oats with berries', 'breakfast', 'public', 420, 18, 62, 12, now() - interval '2 hours'),
  ('<maya_id>', 'Grilled chicken salad', 'lunch', 'public', 540, 45, 30, 22, now() - interval '1 day 3 hours'),
  ('<maya_id>', 'Salmon and rice', 'dinner', 'public', 680, 48, 55, 26, now() - interval '1 day 10 hours'),
  ('<maya_id>', 'Protein shake', 'snack', 'public', 220, 30, 10, 4, now() - interval '2 days 4 hours'),
  ('<maya_id>', 'Late night snack', 'snack', 'private', 350, 8, 40, 15, now() - interval '2 days 12 hours');

-- Dev's logs: 4 total, 3 public + 1 private.
insert into logs (user_id, description, meal_type, visibility, calories_final, protein_final_g, carbs_final_g, fat_final_g, created_at) values
  ('<dev_id>', 'Eggs and toast', 'breakfast', 'public', 480, 24, 40, 20, now() - interval '5 hours'),
  ('<dev_id>', 'Turkey sandwich', 'lunch', 'public', 610, 38, 58, 24, now() - interval '1 day 6 hours'),
  ('<dev_id>', 'Steak and veggies', 'dinner', 'public', 720, 52, 28, 34, now() - interval '2 days 8 hours'),
  ('<dev_id>', 'Cheat meal', 'dinner', 'private', 950, 30, 90, 45, now() - interval '3 days 9 hours');

-- Sofia's logs: 4 total, all public.
insert into logs (user_id, description, meal_type, visibility, calories_final, protein_final_g, carbs_final_g, fat_final_g, created_at) values
  ('<sofia_id>', 'Greek yogurt bowl', 'breakfast', 'public', 310, 20, 35, 8, now() - interval '1 day 1 hours'),
  ('<sofia_id>', 'Veggie wrap', 'lunch', 'public', 460, 16, 55, 18, now() - interval '2 days 2 hours'),
  ('<sofia_id>', 'Pasta primavera', 'dinner', 'public', 640, 22, 80, 20, now() - interval '3 days 5 hours'),
  ('<sofia_id>', 'Trail mix', 'snack', 'public', 280, 8, 25, 16, now() - interval '4 days 3 hours');
```

- [ ] **Step 5: verify the seed applied correctly**

```sql
select u.username, u.streak_count, u.streak_last_log_date, count(l.id) as log_count
from users u left join logs l on l.user_id = u.id
where u.username in ('mayaruns','devlifts','sofiaeats','jonasq','priyakitchen')
group by u.id, u.username, u.streak_count, u.streak_last_log_date
order by u.username;
```

Expected: `mayaruns` streak 15 / 5 logs, `devlifts` streak 3 / 4 logs, `sofiaeats` streak 0 / 4 logs, `jonasq` streak 0 / 0 logs, `priyakitchen` streak 0 / 0 logs.

- [ ] **Step 6: write `docs/superpowers/notes/2026-08-15-phase3-seed-accounts.md`**

```markdown
# Phase 3 Seed Data — Mock Friend Accounts

Created for Phase 3 testing. These are throwaway demo accounts — delete via
Supabase Dashboard → Authentication (deletes the `auth.users` row, cascading
to `users`/`logs`/`friendships` via `on delete cascade`) once no longer needed.

| Email | Username | Name | Role in seed |
|---|---|---|---|
| spork.friend.maya@gmail.com | mayaruns | Maya Chen | Accepted friend, streak 15, 5 logs (4 public, 1 private) |
| spork.friend.dev@gmail.com | devlifts | Dev Patel | Accepted friend, streak 3, 4 logs (3 public, 1 private) |
| spork.friend.sofia@gmail.com | sofiaeats | Sofia Martins | Accepted friend, streak 0, 4 logs (all public) |
| spork.friend.jonas@gmail.com | jonasq | Jonas Weber | Pending incoming friend request |
| spork.friend.priya@gmail.com | priyakitchen | Priya Nair | Not connected — findable via search only |
```

- [ ] **Step 7: commit**

```bash
git add docs/superpowers/notes/2026-08-15-phase3-seed-accounts.md
git commit -m "Document Phase 3 seed accounts (5 mock friends)"
```

---

### Task 2: Shared Pure Functions — Effective Streak & Friend Stats

**Files:**
- Create: `src/lib/streak.ts`
- Create: `src/lib/streak.test.ts`
- Create: `src/lib/friendStats.ts`
- Create: `src/lib/friendStats.test.ts`

**Interfaces:**
- Produces: `getEffectiveStreak(streakCount: number, streakLastLogDate: string | null, today: Date): number`, `computeAverageCalories(logs: FriendStatLog[]): number | null`, `computeMostLoggedMealType(logs: FriendStatLog[]): string | null`, and the `FriendStatLog` interface (`{ calories_final: number | null; calories_estimate: number | null; meal_type: 'breakfast'|'lunch'|'dinner'|'snack'; created_at: string }`) — all consumed by Task 3 (Feed) and Task 4 (Friend Profile).

- [ ] **Step 1: write the failing tests for `getEffectiveStreak`**

```ts
// src/lib/streak.test.ts
import { describe, expect, it } from 'vitest'
import { getEffectiveStreak } from './streak'

describe('getEffectiveStreak', () => {
  it('returns 0 when there is no last-log date', () => {
    expect(getEffectiveStreak(15, null, new Date('2026-08-15'))).toBe(0)
  })

  it('shows the stored count when the last log was today', () => {
    expect(getEffectiveStreak(15, '2026-08-15', new Date('2026-08-15'))).toBe(15)
  })

  it('shows the stored count when the last log was yesterday', () => {
    expect(getEffectiveStreak(15, '2026-08-14', new Date('2026-08-15'))).toBe(15)
  })

  it('shows 0 when the last log was 2+ days ago', () => {
    expect(getEffectiveStreak(15, '2026-08-12', new Date('2026-08-15'))).toBe(0)
  })
})
```

- [ ] **Step 2: run the tests to confirm they fail**

Run: `npm test`
Expected: FAIL — `src/lib/streak.ts` does not exist yet.

- [ ] **Step 3: write `src/lib/streak.ts`**

```ts
/**
 * The stored `streak_count` only reflects reality if the user logged
 * something today or yesterday — otherwise a streak that was broken days
 * ago would still display as active until the next `log_meal()` call
 * lazily corrects it (see the design spec's streak logic notes). This
 * derives what should actually be *displayed* right now without needing
 * a background job.
 */
export function getEffectiveStreak(streakCount: number, streakLastLogDate: string | null, today: Date): number {
  if (!streakLastLogDate) return 0

  const last = new Date(streakLastLogDate + 'T00:00:00')
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffDays = Math.round((todayMidnight.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))

  return diffDays <= 1 ? streakCount : 0
}
```

- [ ] **Step 4: run the tests to confirm they pass**

Run: `npm test`
Expected: 4/4 PASS in `streak.test.ts`.

- [ ] **Step 5: write the failing tests for the friend-stat functions**

```ts
// src/lib/friendStats.test.ts
import { describe, expect, it } from 'vitest'
import { computeAverageCalories, computeMostLoggedMealType } from './friendStats'

describe('computeAverageCalories', () => {
  it('returns null for no logs', () => {
    expect(computeAverageCalories([])).toBeNull()
  })

  it('averages across distinct calendar days, not per-log', () => {
    const logs = [
      { calories_final: 500, calories_estimate: null, meal_type: 'breakfast' as const, created_at: '2026-08-10T08:00:00Z' },
      { calories_final: 700, calories_estimate: null, meal_type: 'lunch' as const, created_at: '2026-08-10T13:00:00Z' },
      { calories_final: 800, calories_estimate: null, meal_type: 'dinner' as const, created_at: '2026-08-11T19:00:00Z' },
    ]
    // day 1 total: 1200 (500+700), day 2 total: 800 -> avg = (1200+800)/2 = 1000
    expect(computeAverageCalories(logs)).toBe(1000)
  })

  it('falls back to the estimate when final is null', () => {
    const logs = [
      { calories_final: null, calories_estimate: 450, meal_type: 'snack' as const, created_at: '2026-08-10T08:00:00Z' },
    ]
    expect(computeAverageCalories(logs)).toBe(450)
  })

  it('skips logs with no calorie data at all', () => {
    const logs = [
      { calories_final: null, calories_estimate: null, meal_type: 'snack' as const, created_at: '2026-08-10T08:00:00Z' },
    ]
    expect(computeAverageCalories(logs)).toBeNull()
  })
})

describe('computeMostLoggedMealType', () => {
  it('returns null for no logs', () => {
    expect(computeMostLoggedMealType([])).toBeNull()
  })

  it('returns the meal type with the most logs', () => {
    const logs = [
      { calories_final: 500, calories_estimate: null, meal_type: 'lunch' as const, created_at: '2026-08-10T08:00:00Z' },
      { calories_final: 500, calories_estimate: null, meal_type: 'lunch' as const, created_at: '2026-08-11T08:00:00Z' },
      { calories_final: 500, calories_estimate: null, meal_type: 'dinner' as const, created_at: '2026-08-12T08:00:00Z' },
    ]
    expect(computeMostLoggedMealType(logs)).toBe('lunch')
  })
})
```

- [ ] **Step 6: run the tests to confirm they fail**

Run: `npm test`
Expected: FAIL — `src/lib/friendStats.ts` does not exist yet.

- [ ] **Step 7: write `src/lib/friendStats.ts`**

```ts
export interface FriendStatLog {
  calories_final: number | null
  calories_estimate: number | null
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  created_at: string
}

/**
 * Average of each day's total calories (falling back to the estimate for
 * any log never edited), averaged across distinct calendar days — so a
 * day with 3 logs doesn't count 3x as much as a day with 1 log.
 */
export function computeAverageCalories(logs: FriendStatLog[]): number | null {
  if (logs.length === 0) return null

  const totalsByDay = new Map<string, number>()
  for (const log of logs) {
    const calories = log.calories_final ?? log.calories_estimate
    if (calories === null) continue
    const day = log.created_at.slice(0, 10)
    totalsByDay.set(day, (totalsByDay.get(day) ?? 0) + calories)
  }

  if (totalsByDay.size === 0) return null

  const dailyTotals = [...totalsByDay.values()]
  const sum = dailyTotals.reduce((a, b) => a + b, 0)
  return Math.round(sum / dailyTotals.length)
}

export function computeMostLoggedMealType(logs: FriendStatLog[]): string | null {
  if (logs.length === 0) return null

  const counts = new Map<string, number>()
  for (const log of logs) {
    counts.set(log.meal_type, (counts.get(log.meal_type) ?? 0) + 1)
  }

  let best: string | null = null
  let bestCount = 0
  for (const [mealType, count] of counts) {
    if (count > bestCount) {
      best = mealType
      bestCount = count
    }
  }
  return best
}
```

- [ ] **Step 8: run the tests to confirm they pass**

Run: `npm test`
Expected: all tests pass, including the 4 new `friendStats.test.ts` cases.

- [ ] **Step 9: commit**

```bash
git add src/lib/streak.ts src/lib/streak.test.ts src/lib/friendStats.ts src/lib/friendStats.test.ts
git commit -m "Add effective-streak and friend-stat pure functions"
```

---

### Task 3: Feed Screen

**Files:**
- Create: `src/hooks/useFeed.ts`
- Create: `src/screens/feed/Feed.tsx`
- Delete: `src/screens/feed/FeedPlaceholder.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `getEffectiveStreak` (Task 2).
- Produces: no new shared exports — `Feed` is a route-level screen, consumed only by `App.tsx`.

- [ ] **Step 1: write `src/hooks/useFeed.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'
import type { Database } from '../lib/database.types'

type LogRow = Database['public']['Tables']['logs']['Row']
type UserRow = Database['public']['Tables']['users']['Row']

export interface FeedItem {
  log: LogRow
  author: Pick<UserRow, 'id' | 'name' | 'username' | 'photo_url' | 'streak_count' | 'streak_last_log_date'>
}

/**
 * Fetches friends' logs, then their authors, as two separate queries
 * rather than one embedded Supabase `.select('*, users(...)')` — our
 * hand-written Database type doesn't model foreign-key `Relationships`,
 * and past experience in this project (Phase 1) showed embedded-select
 * type inference silently degrading without it. Two plain queries avoid
 * that whole class of bug.
 *
 * RLS on `logs` already restricts what a plain `select('*')` can return
 * to the caller's own rows or an accepted friend's public rows — the
 * explicit `.neq('user_id', userId)` below only removes the caller's own
 * logs from an already-safe result set, it isn't what makes this private-
 * log-safe. That's RLS's job (see supabase/migrations/0001_init.sql).
 */
export function useFeed() {
  const { session } = useSession()
  const userId = session?.user.id

  return useQuery({
    queryKey: ['feed', userId],
    queryFn: async (): Promise<FeedItem[]> => {
      const { data: logs, error: logsError } = await supabase
        .from('logs')
        .select('*')
        .neq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(50)

      if (logsError) throw logsError
      if (!logs || logs.length === 0) return []

      const authorIds = [...new Set(logs.map((log) => log.user_id))]
      const { data: authors, error: authorsError } = await supabase
        .from('users')
        .select('id, name, username, photo_url, streak_count, streak_last_log_date')
        .in('id', authorIds)

      if (authorsError) throw authorsError

      const authorsById = new Map((authors ?? []).map((author) => [author.id, author]))

      return logs
        .map((log) => {
          const author = authorsById.get(log.user_id)
          return author ? { log, author } : null
        })
        .filter((item): item is FeedItem => item !== null)
    },
    enabled: Boolean(userId),
  })
}
```

- [ ] **Step 2: write `src/screens/feed/Feed.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'
import { useFeed } from '../../hooks/useFeed'
import { getEffectiveStreak } from '../../lib/streak'

export default function Feed() {
  const navigate = useNavigate()
  const { data: items, isLoading } = useFeed()

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-primary">Your feed is quiet</p>
        <p className="text-sm text-muted">Add a few friends, or log your first meal.</p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/home/friends')}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-background"
          >
            Add friends
          </button>
          <button
            onClick={() => navigate('/home/log')}
            className="rounded-full border border-border px-5 py-2 text-sm font-semibold text-primary"
          >
            Log a meal
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-6">
      {items.map(({ log, author }) => {
        const effectiveStreak = getEffectiveStreak(author.streak_count, author.streak_last_log_date, new Date())
        return (
          <button
            key={log.id}
            onClick={() => navigate(`/home/friend/${author.username}`)}
            className="flex flex-col gap-2 rounded-2xl border border-border p-4 text-left"
          >
            <div className="flex items-center gap-2">
              {author.photo_url ? (
                <img src={author.photo_url} alt={author.name} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-border/60 text-xs text-muted">
                  {author.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-semibold text-primary">@{author.username}</span>
              {effectiveStreak > 0 && <span className="text-sm">🔥</span>}
              <span className="ml-auto text-xs text-muted">
                {new Date(log.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs capitalize text-muted">{log.meal_type}</span>
              <span className="text-lg font-bold text-primary">
                {log.calories_final ?? log.calories_estimate ?? '—'} kcal
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: delete `src/screens/feed/FeedPlaceholder.tsx`**

Run: `rm src/screens/feed/FeedPlaceholder.tsx` (or delete via your editor).

- [ ] **Step 4: update `src/App.tsx`**

Replace the import `import FeedPlaceholder from './screens/feed/FeedPlaceholder'` with `import Feed from './screens/feed/Feed'`, and change the route:

```tsx
<Route path="feed" element={<Feed />} />
```

(this replaces the old `<Route path="feed" element={<FeedPlaceholder />} />` line)

- [ ] **Step 5: type-check and run tests**

Run: `npx tsc -b --noEmit`
Expected: no errors.

Run: `npm test`
Expected: all tests still pass.

- [ ] **Step 6: manually verify**

Run: `npm run dev`. Sign in as your real test account (the one you connected in Task 1). Visit `/home/feed` — expect to see logs from `mayaruns`, `devlifts`, and `sofiaeats` interleaved chronologically (most recent first), each showing calories/meal type/timestamp, with a 🔥 next to `mayaruns` and `devlifts` (active streaks) but not `sofiaeats` (streak 0). Confirm you do **not** see either seeded friend's private log (Maya's "Late night snack," Dev's "Cheat meal") — this is the single most important check in this task. Tap a card — expect navigation to `/home/friend/<username>` (a 404-ish blank/placeholder is expected until Task 4 builds that screen).

- [ ] **Step 7: commit**

```bash
git add -A
git commit -m "Add populated Feed screen"
```

---

### Task 4: Friend Profile Screen

**Files:**
- Create: `src/hooks/useFriendProfile.ts`
- Create: `src/screens/friends/FriendProfile.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `computeAverageCalories`, `computeMostLoggedMealType`, `getEffectiveStreak` (Task 2).
- Produces: the `/home/friend/:username` route — no new shared exports beyond that.

- [ ] **Step 1: write `src/hooks/useFriendProfile.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

type UserRow = Database['public']['Tables']['users']['Row']
type LogRow = Database['public']['Tables']['logs']['Row']

export interface FriendProfileData {
  user: UserRow
  logs: LogRow[]
}

/**
 * Two plain queries, same reasoning as useFeed: no embedded selects. The
 * `logs` query is RLS-safe by construction — whatever `visibility`/
 * friendship rules apply, this always returns exactly what the caller is
 * allowed to see for that user_id, nothing more.
 */
export function useFriendProfile(username: string | undefined) {
  return useQuery({
    queryKey: ['friendProfile', username],
    queryFn: async (): Promise<FriendProfileData | null> => {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username!)
        .maybeSingle()

      if (userError) throw userError
      if (!user) return null

      const { data: logs, error: logsError } = await supabase
        .from('logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (logsError) throw logsError

      return { user, logs: logs ?? [] }
    },
    enabled: Boolean(username),
  })
}
```

- [ ] **Step 2: write `src/screens/friends/FriendProfile.tsx`**

```tsx
import { useNavigate, useParams } from 'react-router-dom'
import { useFriendProfile } from '../../hooks/useFriendProfile'
import { computeAverageCalories, computeMostLoggedMealType } from '../../lib/friendStats'
import { getEffectiveStreak } from '../../lib/streak'

export default function FriendProfile() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useFriendProfile(username)

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted">Couldn't find that profile.</p>
        <button
          onClick={() => navigate(-1)}
          className="rounded-full bg-primary px-6 py-3 text-base font-semibold text-background"
        >
          Go back
        </button>
      </div>
    )
  }

  const { user, logs } = data
  // Streak/quick-stats are hidden for a private-default user even if some
  // of their individual logs are public — this is a UI-level rule on top
  // of RLS (see spec §5), not a substitute for it: the logs grid below
  // still shows whatever public logs RLS returned, regardless of this flag.
  const showStats = user.privacy_default === 'public'
  const effectiveStreak = getEffectiveStreak(user.streak_count, user.streak_last_log_date, new Date())
  const avgCalories = computeAverageCalories(logs)
  const mostLoggedMealType = computeMostLoggedMealType(logs)

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary"
      >
        ←
      </button>

      <div className="flex flex-col items-center gap-4">
        {user.photo_url ? (
          <img src={user.photo_url} alt={user.name} className="h-24 w-24 rounded-full object-cover" />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-border/60 text-2xl text-muted">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="text-center">
          <p className="text-xl font-bold text-primary">{user.name}</p>
          <p className="text-sm text-muted">@{user.username}</p>
        </div>

        {showStats && (
          <div className="flex w-full gap-3">
            <div className="flex-1 rounded-2xl border border-border p-4 text-center">
              <p className="text-2xl font-bold text-primary">🔥 {effectiveStreak}</p>
              <p className="text-xs text-muted">day streak</p>
            </div>
            <div className="flex-1 rounded-2xl border border-border p-4 text-center">
              <p className="text-2xl font-bold text-primary">{avgCalories ?? '—'}</p>
              <p className="text-xs text-muted">avg cal/day</p>
            </div>
          </div>
        )}

        {showStats && mostLoggedMealType && <p className="text-sm text-muted">Most logged: {mostLoggedMealType}</p>}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-muted">LOGS</h2>
      {logs.length === 0 ? (
        <p className="text-sm text-muted">No logs to show yet.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {logs.map((log) => (
            <li key={log.id} className="flex flex-col items-center gap-1 rounded-2xl border border-border p-3">
              <span className="text-lg font-bold text-primary">{log.calories_final ?? log.calories_estimate ?? '—'}</span>
              <span className="text-xs capitalize text-muted">{log.meal_type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: update `src/App.tsx`**

Add the import `import FriendProfile from './screens/friends/FriendProfile'`, and add a new nested route inside the existing `/home` route's children, alongside `feed`/`log`/`rewards`/`friends`/`profile`:

```tsx
<Route path="friend/:username" element={<FriendProfile />} />
```

- [ ] **Step 4: type-check and run tests**

Run: `npx tsc -b --noEmit`
Expected: no errors.

Run: `npm test`
Expected: all tests still pass.

- [ ] **Step 5: manually verify**

Run: `npm run dev`. Sign in as your real test account. From the Feed (Task 3), tap Maya's card — expect `/home/friend/mayaruns` showing her name, a 15-day streak, an avg-calories number, "Most logged: [some meal type]," and a 4-item logs grid (her 1 private log must **not** appear here — only 4 of her 5 logs are public). Tap Sofia's card — expect her streak to show `0`. Manually navigate to `/home/friend/priyakitchen` (not a friend, findable only via search) — expect her name/avatar to display (profile lookup works for anyone) but an empty or near-empty logs grid, since no friendship exists to unlock her logs via RLS.

- [ ] **Step 6: commit**

```bash
git add -A
git commit -m "Add Friend Profile screen"
```

---

### Task 5: Friends Tab — Search, Requests, Your Circle

**Files:**
- Create: `src/hooks/useFriendships.ts`
- Create: `src/screens/friends/Friends.tsx`
- Delete: `src/screens/friends/FriendsPlaceholder.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `useFriendships()` returning `{ accepted: UserRow[], incoming: {friendshipId, user}[], outgoing: {friendshipId, user}[] }`; `useAcceptFriendRequest()`, `useDeclineFriendRequest()`, `useSendFriendRequest()` mutation hooks — no other task consumes these, but the shape is documented here for anyone extending this screen later.

- [ ] **Step 1: write `src/hooks/useFriendships.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'
import type { Database } from '../lib/database.types'

type UserRow = Database['public']['Tables']['users']['Row']

export interface FriendshipsData {
  accepted: UserRow[]
  incoming: { friendshipId: string; user: UserRow }[]
  outgoing: { friendshipId: string; user: UserRow }[]
}

/**
 * Fetches every friendship row RLS allows the caller to see (both
 * directions, any status), then batch-fetches the "other party" in each
 * row and classifies client-side into accepted / incoming-pending /
 * outgoing-pending. Two plain queries, no embedded selects — same
 * reasoning as useFeed and useFriendProfile.
 */
export function useFriendships() {
  const { session } = useSession()
  const userId = session?.user.id

  return useQuery({
    queryKey: ['friendships', userId],
    queryFn: async (): Promise<FriendshipsData> => {
      const { data: friendships, error: friendshipsError } = await supabase.from('friendships').select('*')

      if (friendshipsError) throw friendshipsError

      const rows = friendships ?? []
      const otherPartyIdByFriendshipId = new Map<string, string>()
      for (const f of rows) {
        const otherId = f.requester_id === userId ? f.recipient_id : f.requester_id
        otherPartyIdByFriendshipId.set(f.id, otherId)
      }

      const otherPartyIds = [...new Set(otherPartyIdByFriendshipId.values())]
      const { data: users, error: usersError } =
        otherPartyIds.length > 0
          ? await supabase.from('users').select('*').in('id', otherPartyIds)
          : { data: [] as UserRow[], error: null }

      if (usersError) throw usersError

      const usersById = new Map((users ?? []).map((u) => [u.id, u]))

      const accepted: UserRow[] = []
      const incoming: { friendshipId: string; user: UserRow }[] = []
      const outgoing: { friendshipId: string; user: UserRow }[] = []

      for (const f of rows) {
        const otherId = otherPartyIdByFriendshipId.get(f.id)!
        const otherUser = usersById.get(otherId)
        if (!otherUser) continue

        if (f.status === 'accepted') {
          accepted.push(otherUser)
        } else if (f.requester_id === userId) {
          outgoing.push({ friendshipId: f.id, user: otherUser })
        } else {
          incoming.push({ friendshipId: f.id, user: otherUser })
        }
      }

      return { accepted, incoming, outgoing }
    },
    enabled: Boolean(userId),
  })
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendships'] })
    },
  })
}

export function useDeclineFriendRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendships'] })
    },
  })
}

export function useSendFriendRequest() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (recipientId: string) => {
      if (!session) throw new Error('Not signed in')
      const { error } = await supabase
        .from('friendships')
        .insert({ requester_id: session.user.id, recipient_id: recipientId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendships'] })
    },
  })
}
```

- [ ] **Step 2: write `src/screens/friends/Friends.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useFriendships,
  useSendFriendRequest,
} from '../../hooks/useFriendships'

interface FoundUser {
  id: string
  username: string
  name: string
  photo_url: string | null
}

export default function Friends() {
  const navigate = useNavigate()
  const { data, isLoading } = useFriendships()
  const acceptMutation = useAcceptFriendRequest()
  const declineMutation = useDeclineFriendRequest()
  const sendMutation = useSendFriendRequest()

  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<FoundUser[]>([])
  const [error, setError] = useState<string | null>(null)

  async function handleSearch() {
    setError(null)
    const term = searchTerm.trim().toLowerCase()
    if (!term) {
      setError('Type a username to search.')
      return
    }

    const { data: found, error: searchError } = await supabase
      .from('users')
      .select('id, username, name, photo_url')
      .ilike('username', `%${term}%`)
      .limit(10)

    if (searchError) {
      setError('Search failed. Try again.')
      return
    }

    setResults(found ?? [])
    if ((found ?? []).length === 0) {
      setError('No users found with that username.')
    }
  }

  const connectedIds = new Set([
    ...(data?.accepted.map((u) => u.id) ?? []),
    ...(data?.incoming.map((r) => r.user.id) ?? []),
    ...(data?.outgoing.map((r) => r.user.id) ?? []),
  ])

  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      <div className="flex gap-2">
        <input
          placeholder="Search by username"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 rounded-full bg-border/60 px-5 py-2 text-base text-primary placeholder:text-muted"
        />
        <button onClick={handleSearch} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-background">
          Search
        </button>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map((user) => {
            const alreadyConnected = connectedIds.has(user.id)
            return (
              <li key={user.id} className="flex items-center justify-between rounded-full border border-border px-4 py-2">
                <span className="font-medium text-primary">@{user.username}</span>
                <button
                  disabled={alreadyConnected || sendMutation.isPending}
                  onClick={() => sendMutation.mutate(user.id)}
                  className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-background disabled:opacity-40"
                >
                  {alreadyConnected ? 'Added' : 'Add'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          {data && data.incoming.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-muted">REQUESTS</h2>
              <ul className="flex flex-col gap-2">
                {data.incoming.map(({ friendshipId, user }) => (
                  <li
                    key={friendshipId}
                    className="flex items-center justify-between rounded-full border border-border px-4 py-2"
                  >
                    <span className="font-medium text-primary">@{user.username}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => declineMutation.mutate(friendshipId)}
                        disabled={declineMutation.isPending}
                        className="rounded-full border border-border px-3 py-1 text-sm font-semibold text-primary disabled:opacity-40"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => acceptMutation.mutate(friendshipId)}
                        disabled={acceptMutation.isPending}
                        className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-background disabled:opacity-40"
                      >
                        Accept
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data && data.outgoing.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-muted">SENT</h2>
              <ul className="flex flex-col gap-2">
                {data.outgoing.map(({ friendshipId, user }) => (
                  <li
                    key={friendshipId}
                    className="flex items-center justify-between rounded-full border border-border px-4 py-2"
                  >
                    <span className="font-medium text-primary">@{user.username}</span>
                    <span className="rounded-full bg-border/60 px-3 py-1 text-sm text-muted">Requested</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h2 className="mb-2 text-sm font-semibold text-muted">YOUR CIRCLE · {data?.accepted.length ?? 0}</h2>
            {!data || data.accepted.length === 0 ? (
              <p className="text-sm text-muted">No friends yet — search above to add some.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.accepted.map((user) => (
                  <li key={user.id}>
                    <button
                      onClick={() => navigate(`/home/friend/${user.username}`)}
                      className="flex w-full items-center gap-3 rounded-full border border-border px-4 py-2 text-left"
                    >
                      {user.photo_url ? (
                        <img src={user.photo_url} alt={user.name} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-border/60 text-xs text-muted">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-primary">@{user.username}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: delete `src/screens/friends/FriendsPlaceholder.tsx`**

Run: `rm src/screens/friends/FriendsPlaceholder.tsx` (or delete via your editor).

- [ ] **Step 4: update `src/App.tsx`**

Replace the import `import FriendsPlaceholder from './screens/friends/FriendsPlaceholder'` with `import Friends from './screens/friends/Friends'`, and change the route:

```tsx
<Route path="friends" element={<Friends />} />
```

(this replaces the old `<Route path="friends" element={<FriendsPlaceholder />} />` line)

- [ ] **Step 5: type-check and run tests**

Run: `npx tsc -b --noEmit`
Expected: no errors.

Run: `npm test`
Expected: all tests still pass.

- [ ] **Step 6: manually verify**

Run: `npm run dev`. Sign in as your real test account, visit `/home/friends`. Expect: a "REQUESTS" section showing `jonasq` with Accept/Decline buttons; a "YOUR CIRCLE · 3" section listing `mayaruns`, `devlifts`, `sofiaeats` (tap one → Friend Profile from Task 4); search for `priya` — expect `priyakitchen` to appear with an "Add" button (not yet connected). Tap Accept on `jonasq`'s request — expect it to move into "YOUR CIRCLE" and disappear from "REQUESTS" after the query refetches. Tap Add on `priyakitchen` — expect the button to become disabled/"Added" and (after a refresh or refetch) `priyakitchen` to appear under "SENT" as a new outgoing request.

- [ ] **Step 7: commit**

```bash
git add -A
git commit -m "Add Friends tab: search, requests, your circle"
```

---

## Phase 3 Complete

At this point: the Feed shows a real, chronologically-ordered stream of friends' public logs with working streak flames; the Friends tab supports search, viewing/accepting/declining requests, and browsing your circle; and tapping into any friend shows a real profile with privacy-respecting stats and a logs grid. All of it is powered by the 5 seeded accounts from Task 1 rather than a real Log flow or Streaks system — Phase 4 (Log flow) is what lets real users start generating this data themselves.
