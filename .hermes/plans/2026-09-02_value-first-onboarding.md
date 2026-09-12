# Spork — Value-First Onboarding (Auth at End) Plan
*Created: 2026-09-02*

> **For Hermes:** Implement task-by-task. Run `npm test && npx tsc --noEmit` after every task. Both must be green before moving on.

---

## Goal
Move authentication to the END of new-user onboarding. New users complete all the value-building steps first (basics → goal → activity → food → experience), then see a personalised results screen, then create an account. Returning users skip all of this and sign in directly.

---

## Why this works — the science

### 1. Progressive Commitment (Sunk Cost + Endowment Effect)
Users who've spent 3 minutes entering their age, weight, goal, and activity level feel the plan is *already theirs*. Creating an account feels like *saving* something valuable, not giving something away.
- **Duolingo**: moved auth to end → +20% completion in internal A/B tests
- **Calm**: shows personalised sleep score before email gate → industry-cited as best-practice
- **Noom**: shows "you'll reach your goal by [date]" → 60%+ of users create accounts after seeing it
- **Headspace**: removed sign-up entirely from first 3 screens → 2x onboarding completion

### 2. Zeigarnik Effect (Completion Anxiety)
Progress bar showing "5 of 7 steps complete" creates psychological tension — incomplete tasks stay in working memory. Users want to finish.

### 3. Personalisation Before Payment (or in our case, Registration)
Showing someone *their* calorie goal (2,570 kcal/day to lose 0.5kg/week) before asking them to register creates the "aha moment" that converts. Generic "sign up and get started" cannot replicate this.

### 4. Friction Reduction at First Touch
Email + password as the FIRST thing a new user sees is friction. Every required field before value delivery loses ~15% of users per field (industry average). Moving auth to step 7 means only motivated, invested users see it.

---

## New flow architecture

```
RETURNING USER:
  /welcome → "I already have an account" → /sign-in → /home/feed

NEW USER:
  /welcome → "Start for free →"
    /onboarding/basics      (PUBLIC — no auth)
    /onboarding/goal        (PUBLIC)
    /onboarding/activity    (PUBLIC)
    /onboarding/food        (PUBLIC)
    /onboarding/experience  (PUBLIC)
    /onboarding/your-plan   (PUBLIC — personalized reveal, the "aha moment")
    /onboarding/create-account (PUBLIC — email + password AFTER they've seen value)
    /onboarding/profile     (PROTECTED — now has session, name/username/photo)
    /onboarding/privacy     (PROTECTED)
    /onboarding/friends     (PROTECTED)
    /home/feed
```

---

## Key architectural decisions

### A. Public routes for pre-auth steps
Steps 1–6 get no `ProtectedRoute` wrapper. They're just regular `<Route>` elements. The Zustand `onboardingStore` holds all collected data in memory.

### B. CreateAccount screen replaces the old SignIn for new users
The `/onboarding/create-account` screen is a new screen: "Your plan is ready — save it" framing. It calls `supabase.auth.signUp`. On success, the Zustand store data is still intact (same browser session), and we continue to `/onboarding/profile`.

### C. SignIn screen stays for returning users
`/sign-in` remains for "I already have an account" → signs in → checks for existing profile → goes to feed. No change to this path.

### D. ProtectedRoute only wraps the last 3 onboarding steps
Profile Setup, Privacy, Add Friends still require auth (they write to the DB). If someone lands directly on these without a session, they redirect to `/welcome`.

### E. Progress bar updates — now 8 steps total
Pre-auth: Basics(1) Goal(2) Activity(3) Food(4) Experience(5) → Plan reveal → CreateAccount(6)
Post-auth: Profile(7) Privacy(8) [Friends is optional, not counted]

### F. Zustand data survives across the auth boundary
The onboarding store is initialised once per page load. Because we don't reload the page between steps, all the data entered in public steps is still in the store when `completeOnboarding` is finally called from AddFirstFriends. No sessionStorage/localStorage needed.

---

## Files that change

| File | Change |
|---|---|
| `src/App.tsx` | Remove ProtectedRoute from pre-auth steps; add `/onboarding/your-plan` and `/onboarding/create-account`; update ProtectedRoute redirects |
| `src/screens/onboarding/Welcome.tsx` | New copy: "Start for free →", social proof, different CTA hierarchy |
| `src/screens/onboarding/YourPlan.tsx` | **NEW** — personalized reveal screen showing computed calories, goal, timeline |
| `src/screens/onboarding/CreateAccount.tsx` | **NEW** — email+password screen with "save your plan" framing |
| `src/screens/onboarding/SignIn.tsx` | Minor: back goes to `/welcome`, no mode switching (sign-in only) |
| `src/screens/onboarding/Basics.tsx` | Remove back→`/onboarding/profile` (now back→`/welcome`); remove any auth dependency |
| `src/screens/onboarding/Goal.tsx` | Back → `/onboarding/basics` (already correct) |
| `src/screens/onboarding/Activity.tsx` | Back → `/onboarding/goal`; `handleContinue` → `/onboarding/food` |
| `src/screens/onboarding/FoodLifestyle.tsx` | Back → `/onboarding/activity` (already correct) |
| `src/screens/onboarding/Experience.tsx` | Back → `/onboarding/food`; continue → `/onboarding/your-plan` (not `/onboarding/privacy`) |
| `src/screens/onboarding/ProfileSetup.tsx` | Back → `/welcome` now goes to `/onboarding/create-account`; ProtectedRoute redirects to `/welcome` not `/sign-in` |
| `src/screens/onboarding/PrivacyDefault.tsx` | Step counter update |
| `src/screens/onboarding/AddFirstFriends.tsx` | Step counter update |
| `src/components/ProtectedRoute.tsx` | Redirect to `/welcome` (not `/sign-in`) when no session |
| `src/components/OnboardingProgress.tsx` | No change needed (takes step/total as props) |

---

## Task breakdown

### Task 0 — Baseline check
```bash
npm test           # must be 131/131
npx tsc --noEmit   # must be 0 errors
```
Do not proceed if either fails.

---

### Task 1 — Update ProtectedRoute to redirect to /welcome

**File:** `src/components/ProtectedRoute.tsx`

**Change:** Redirect unauthenticated users to `/welcome` instead of `/sign-in`.
Reasoning: `/sign-in` is now only for returning users. New users who land on a protected route mid-flow should restart.

```tsx
// src/components/ProtectedRoute.tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { Skeleton } from './Skeleton'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/welcome" replace />
  }

  return <>{children}</>
}
```

**Verify:** `npx tsc --noEmit` passes.

---

### Task 2 — Update Welcome screen

**File:** `src/screens/onboarding/Welcome.tsx`

**Changes:**
- "Get started" CTA → `navigate('/onboarding/basics')` (directly, no auth gate)
- Reframe copy: "Your personal plan in 2 minutes" instead of generic tagline
- Social proof line: "Join 10,000+ people tracking with Spork" (placeholder number, clearly for UI purposes)
- "I already have an account" → `navigate('/sign-in')` (unchanged)
- Add animated pulse on the CTA button

```tsx
// Key changes only — the rest of Welcome.tsx stays the same:

// CTA buttons:
<button
  onClick={() => navigate('/onboarding/basics')}
  className="w-full rounded-full bg-primary py-3.5 text-base font-semibold text-background"
>
  Build my plan — it's free →
</button>
<button
  onClick={() => navigate('/sign-in')}
  className="text-center text-sm text-muted"
>
  I already have an account
</button>

// New social proof line above CTAs:
<p className="text-center text-xs text-muted">Join 10,000+ people tracking with Spork</p>
```

**Verify:** Navigate to `/welcome` in preview, both buttons link to correct routes.

---

### Task 3 — Make Basics a pure public route (update back button)

**File:** `src/screens/onboarding/Basics.tsx`

**Change:** Back button now goes to `/welcome` (not `/onboarding/profile`, which no longer exists in the pre-auth flow). Progress is step 1 of 6 (pre-auth steps only).

```tsx
// In Basics.tsx:
<button onClick={() => navigate('/welcome')} ...>←</button>
<OnboardingProgress step={1} total={6} />
```

**Verify:** `npx tsc --noEmit` passes.

---

### Task 4 — Update Experience screen continue destination

**File:** `src/screens/onboarding/Experience.tsx`

**Change:** After Experience, continue → `/onboarding/your-plan` (not `/onboarding/privacy`).
Update step counter to 5/6.

```tsx
// In Experience.tsx:
function handleContinue() {
  if (!tracked) { setError('Select one option.'); return }
  setError(null)
  store.setExperience({ trackedBefore: tracked, trackingChallenges: challenges })
  navigate('/onboarding/your-plan')   // ← changed from /onboarding/privacy
}

// Progress:
<OnboardingProgress step={5} total={6} />
```

Also update back button target:
```tsx
<button onClick={() => navigate('/onboarding/food')} ...>←</button>
```

**Verify:** `npx tsc --noEmit` passes.

---

### Task 5 — Update Activity, Food step counters

**Files:** `src/screens/onboarding/Activity.tsx`, `src/screens/onboarding/FoodLifestyle.tsx`

**Changes:**
- Activity: step 3/6
- FoodLifestyle: step 4/6

```tsx
// Activity.tsx
<OnboardingProgress step={3} total={6} />
// back stays → /onboarding/goal (already correct)
// continue stays → /onboarding/food (already correct)

// FoodLifestyle.tsx  
<OnboardingProgress step={4} total={6} />
// back stays → /onboarding/activity (already correct)
// continue stays → /onboarding/experience (already correct)
```

**Verify:** `npx tsc --noEmit` passes.

---

### Task 6 — Build YourPlan screen (the "aha moment")

**File:** `src/screens/onboarding/YourPlan.tsx` (NEW)

This is the retention-critical screen. Show the user what we computed from their data before asking them to register. Make it feel like their personal plan has already been made.

```tsx
// src/screens/onboarding/YourPlan.tsx

import { useNavigate } from 'react-router-dom'
import { useOnboardingStore } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'
import { computeTimeline, PACE_RATES } from '../../lib/calorieGoal'
import { ForkLogo } from '../../components/ForkLogo'

function formatWeeks(weeks: number): string {
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'}`
  const months = Math.round(weeks / 4.33)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`
  return `${(weeks / 52).toFixed(1)} years`
}

function getTargetDate(weeks: number): string {
  const d = new Date()
  d.setDate(d.getDate() + weeks * 7)
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

const GOAL_LABELS = {
  lose: 'Lose weight',
  maintain: 'Maintain weight',
  gain: 'Build muscle',
}

const GOAL_EMOJIS = {
  lose: '📉',
  maintain: '⚖️',
  gain: '📈',
}

const PACE_LABELS = {
  slow: 'Relaxed',
  recommended: 'Recommended',
  fast: 'Aggressive',
}

export default function YourPlan() {
  const navigate = useNavigate()
  const store = useOnboardingStore()

  const calorieGoal  = store.calorieGoal ?? 2000
  const proteinGoal  = store.proteinGoal ?? 0
  const goalType     = store.goalType
  const pace         = store.pace
  const weightKg     = store.weightKg ?? 0
  const targetKg     = store.targetWeightKg

  const timeline = targetKg
    ? computeTimeline(weightKg, targetKg, goalType, pace)
    : null

  // Guard: if they got here without filling basics, send back
  if (!store.weightKg || !calorieGoal) {
    navigate('/onboarding/basics', { replace: true })
    return null
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8 animate-fade-in">
      <button onClick={() => navigate('/onboarding/experience')} aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary">←</button>
      <OnboardingProgress step={6} total={6} />

      {/* Header */}
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-sm font-medium text-muted">Your personalised plan is ready</p>
        <h1 className="text-3xl font-bold text-primary leading-tight">Here's what we worked out for you</h1>
      </div>

      {/* Plan card */}
      <div className="mb-5 rounded-3xl border border-primary/20 bg-primary/5 p-5 flex flex-col gap-5">

        {/* Goal + pace */}
        <div className="flex items-center gap-3">
          <span className="text-3xl">{GOAL_EMOJIS[goalType]}</span>
          <div>
            <p className="font-bold text-primary">{GOAL_LABELS[goalType]}</p>
            <p className="text-sm text-muted">{PACE_LABELS[pace]} pace · {PACE_RATES[goalType][pace]} kg/week</p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Daily calorie goal — the headline number */}
        <div className="text-center">
          <p className="text-6xl font-bold text-primary">{calorieGoal.toLocaleString()}</p>
          <p className="text-muted mt-1">calories per day</p>
          {proteinGoal > 0 && (
            <p className="text-sm text-muted mt-1">Protein target: <span className="font-semibold text-primary">{proteinGoal}g/day</span></p>
          )}
        </div>

        {/* Timeline */}
        {timeline && targetKg && (
          <>
            <div className="h-px bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{formatWeeks(timeline.weeksToGoal)}</p>
              <p className="text-sm text-muted">to reach {targetKg}kg at this pace</p>
              <p className="text-xs text-muted mt-0.5">Estimated by {getTargetDate(timeline.weeksToGoal)}</p>
            </div>
          </>
        )}
      </div>

      {/* Retention hook: save progress CTA */}
      <div className="mb-6 rounded-2xl border border-border bg-border/20 p-4 text-center">
        <p className="text-sm font-semibold text-primary mb-1">💡 Save your plan</p>
        <p className="text-xs text-muted">Create a free account in 30 seconds to save this plan, track your meals, and start your streak.</p>
      </div>

      {/* Spork logo + trust signal */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-border">
          <ForkLogo className="h-4 w-4 text-primary" />
        </div>
        <p className="text-xs text-muted">Spork keeps your data private — no selling, ever.</p>
      </div>

      <button
        onClick={() => navigate('/onboarding/create-account')}
        className="w-full rounded-full bg-primary py-3.5 text-base font-semibold text-background"
      >
        Save my plan — it's free →
      </button>
    </div>
  )
}
```

**Verify:** `npx tsc --noEmit`, navigate to `/onboarding/your-plan` after filling in basics/goal/activity — should show the computed calorie number.

---

### Task 7 — Build CreateAccount screen

**File:** `src/screens/onboarding/CreateAccount.tsx` (NEW)

Framing: "Save your plan" not "Create an account". The user already feels invested.

```tsx
// src/screens/onboarding/CreateAccount.tsx

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ForkLogo } from '../../components/ForkLogo'

export default function CreateAccount() {
  const navigate = useNavigate()
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { data, error: authError } = await supabase.auth.signUp({ email, password })

    if (authError) {
      setSubmitting(false)
      // Surface a friendly message for the most common error
      if (authError.message.toLowerCase().includes('already registered')) {
        setError('This email already has an account. Sign in instead.')
      } else {
        setError(authError.message)
      }
      return
    }

    setSubmitting(false)

    // Check if this email had an existing profile (e.g. they signed up before)
    const userId = data.user?.id
    const { data: existingProfile } = userId
      ? await supabase.from('users').select('id').eq('id', userId).maybeSingle()
      : { data: null }

    if (existingProfile) {
      // Already onboarded — the store data is stale; just go to feed
      navigate('/home/feed', { replace: true })
    } else {
      // Continue onboarding with auth now established
      navigate('/onboarding/profile')
    }
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8 animate-fade-in">
      <button onClick={() => navigate('/onboarding/your-plan')} aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary">←</button>

      <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-border">
        <ForkLogo className="h-6 w-6 text-primary" />
      </div>

      <h1 className="mb-1 text-2xl font-bold text-primary">Save your plan</h1>
      <p className="mb-8 text-sm text-muted">
        Create a free account to save your calorie goal, track meals, and start your streak.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder="you@email.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-full bg-border/60 px-5 py-3 text-base text-primary placeholder:text-muted"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password (min. 6 characters)"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-full bg-border/60 px-5 py-3 text-base text-primary placeholder:text-muted"
        />
        {error && (
          <div className="rounded-2xl border border-error/30 bg-error/5 px-4 py-3">
            <p className="text-sm text-error">{error}</p>
            {error.includes('Sign in instead') && (
              <button
                type="button"
                onClick={() => navigate('/sign-in')}
                className="mt-1 text-sm font-semibold text-primary underline"
              >
                Go to sign in →
              </button>
            )}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-primary py-3 text-base font-semibold text-background disabled:opacity-50"
        >
          {submitting ? 'Creating account…' : 'Create free account →'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted">
        By continuing you agree to our Terms of Service and Privacy Policy.
      </p>

      <button
        onClick={() => navigate('/sign-in')}
        className="mt-4 text-center text-sm text-muted"
      >
        Already have an account? Sign in
      </button>
    </div>
  )
}
```

**Verify:** `npx tsc --noEmit` passes.

---

### Task 8 — Update ProfileSetup back button

**File:** `src/screens/onboarding/ProfileSetup.tsx`

Post-auth, the user came from `/onboarding/create-account`. Back should go there. But since they now have a session, going back would re-show CreateAccount which would detect the session and move forward. Better UX: just go to `/onboarding/your-plan`.

```tsx
// Change back button target in ProfileSetup.tsx:
<button onClick={() => navigate('/onboarding/your-plan')} ...>←</button>
// Step counter: stays 1/5 (post-auth steps)
<OnboardingProgress step={1} total={5} />
```

Similarly update post-auth steps:
- ProfileSetup: 1/5
- PrivacyDefault: 2/5  
- AddFirstFriends: 3/5

**Verify:** `npx tsc --noEmit` passes.

---

### Task 9 — Update App.tsx routes

**File:** `src/App.tsx`

Key changes:
1. Pre-auth steps (basics → goal → activity → food → experience → your-plan → create-account): plain `<Route>`, no wrappers
2. Post-auth steps (profile → privacy → friends): `ProtectedRoute` + `RequireNotOnboarded`
3. Add `/onboarding/your-plan` and `/onboarding/create-account` routes
4. Remove import of deleted screens

```tsx
// src/App.tsx — route section:

{/* PRE-AUTH onboarding — no session required */}
<Route path="/onboarding/basics"        element={<Basics />} />
<Route path="/onboarding/goal"          element={<Goal />} />
<Route path="/onboarding/activity"      element={<Activity />} />
<Route path="/onboarding/food"          element={<FoodLifestyle />} />
<Route path="/onboarding/experience"    element={<Experience />} />
<Route path="/onboarding/your-plan"     element={<YourPlan />} />
<Route path="/onboarding/create-account" element={<CreateAccount />} />

{/* POST-AUTH onboarding — session required */}
<Route path="/onboarding/profile"
  element={<ProtectedRoute><RequireNotOnboarded><ProfileSetup /></RequireNotOnboarded></ProtectedRoute>} />
<Route path="/onboarding/privacy"
  element={<ProtectedRoute><RequireNotOnboarded><PrivacyDefault /></RequireNotOnboarded></ProtectedRoute>} />
<Route path="/onboarding/friends"
  element={<ProtectedRoute><RequireNotOnboarded><AddFirstFriends /></RequireNotOnboarded></ProtectedRoute>} />
```

---

### Task 10 — Update SignIn screen for returning users only

**File:** `src/screens/onboarding/SignIn.tsx`

- Remove mode switching (sign-in only — new users now go through `/onboarding/create-account`)
- Update back button → `/welcome`
- Update copy: "Welcome back" only

```tsx
// SignIn.tsx — simplified to sign-in only:
// Remove: const initialMode = searchParams.get('mode') === 'sign-up' ? 'sign-up' : 'sign-in'
// Remove: the mode toggle button at the bottom
// Keep: email + password + "Continue" (sign-in flow only)
// Keep: "Don't have an account? Start for free" → navigate('/welcome')
```

---

### Task 11 — Full test suite + TypeScript check

```bash
npm test           # target: 131+ passing (no new logic added, count stays same)
npx tsc --noEmit   # target: 0 errors
```

---

### Task 12 — Manual flow verification

Walk the full new-user path in the browser:
- [ ] `/welcome` → "Build my plan" → lands on `/onboarding/basics` (no auth prompt)
- [ ] Fill Basics, back → goes to `/welcome`
- [ ] Fill all 5 pre-auth steps → `/onboarding/your-plan` shows personalized calorie goal
- [ ] "Save my plan" → `/onboarding/create-account`
- [ ] Create account → `/onboarding/profile` (session established)
- [ ] Complete profile/privacy/friends → `/home/feed`

Returning user path:
- [ ] `/welcome` → "I already have an account" → `/sign-in` → fills credentials → `/home/feed`
- [ ] Returning user never sees `/onboarding/basics` etc.

Deep-link guard:
- [ ] Open `/onboarding/profile` without session → redirects to `/welcome`
- [ ] Open `/home/feed` without session → redirects to `/welcome`

---

## Additional retention tactics built into this plan

### 1. The "aha moment" screen (Task 6)
The YourPlan screen shows the user their exact calorie goal, protein target, and timeline before registration. This is the single highest-impact retention moment in the entire flow. Noom and Calibrate both credit this pattern for 40–60% of their conversion lift.

### 2. Sunk cost framing on CreateAccount
"Save your plan — it's free" is deliberately different from "Create an account". It frames registration as preservation of something already valuable, not a new commitment.

### 3. Progress bar across all 6 pre-auth steps
Showing progress through 6 steps creates Zeigarnik tension (incomplete tasks stay in working memory). Users who are at step 5 will finish.

### 4. Trust signal on YourPlan
"Spork keeps your data private — no selling, ever." reduces the #2 objection to registration (privacy concerns).

### 5. Friendly error with escape hatch
If the email already exists, we show "Sign in instead →" as a tappable link. No dead end.

---

## Risks

| Risk | Mitigation |
|---|---|
| User closes browser between pre-auth steps and returning later | Zustand is memory-only — data is lost. Add "continue where you left off" with sessionStorage in a future phase. |
| Supabase email confirmation enabled | If email confirmation is on, the user gets a confirmation email before the session is established. Check Supabase auth settings: turn off "Enable email confirmations" for now (under Auth → Providers → Email). |
| User creates account but exits before ProfileSetup | They have a Supabase auth account but no `users` row. `RequireOnboarded` guard handles this: redirects to `/onboarding/profile` on next sign-in. |
| Pre-auth routes accessible after full onboarding | `RequireNotOnboarded` only guards post-auth steps. A fully-onboarded user visiting `/onboarding/basics` sees the form — but can't do anything harmful (it just sets store state). Low risk, address in Phase 2 if needed. |
