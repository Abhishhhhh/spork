# Visual & Navigation Retrofit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retrofit Phase 1's already-built screens (onboarding, tab shell, profile) to the new neutral visual design system and 5-tab navigation structure, and switch the calorie-goal calculator to the exact Mifflin-St Jeor formula with a sex field.

**Architecture:** Pure UI/copy retrofit of existing React components plus one small library-function signature change (`suggestCalorieGoal`). No backend, schema, or routing-guard logic changes — `App.tsx` only gains one new placeholder route (`/home/friends`). New shared pieces: Tailwind design tokens, a fork-logo SVG, three small line icons, and a reusable onboarding progress bar.

**Tech Stack:** Same as Phase 1 — React, Vite, TypeScript, Tailwind CSS v4 (`@theme` tokens), React Router, Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-13-spork-design.md` (§2 Visual Design System, §5 Screens & Navigation, §10 Decisions Log, §12 Build Phasing item 2)

## Global Constraints

- Fully neutral palette, no accent color: `background #FAF7F0`, `primary #231815`, `muted #8B8680`, `border #E8E2D8`, `error #C0392B`. (spec §2)
- Buttons are fully pill-shaped (`rounded-full`), not the previous `rounded-2xl`. (spec §2)
- System font stack only — no external web font. (spec §2)
- Bottom nav is 5 items: Feed / Streaks / Log (raised, unlabeled center button) / Friends / Profile. (spec §5)
- Calorie-goal calculator requires a `sex: 'male' | 'female'` field and uses the exact Mifflin-St Jeor constants (+5 male / −161 female), not the old sex-neutral −78 approximation. (spec §5, §10)
- No "Forgot password?" link or any password-reset flow in this phase — explicitly deferred. (spec §2, §10)
- Friends tab is a placeholder in this retrofit — real search/requests functionality is Phase 3 (renumbered from "Phase 2" in the original phasing). (spec §5, §12)
- No backend, schema, or RLS changes in this phase — UI/copy/formula only. (spec §12 item 2)
- Mobile-first, `max-width: 430px` centered layout — unchanged from Phase 1. (spec, carried over)

---

### Task 1: Design Tokens & PWA Colors

**Files:**
- Modify: `src/index.css`
- Modify: `vite.config.ts`
- Modify: `scripts/generate-pwa-icons.mjs`

**Interfaces:**
- Produces: Tailwind utility classes `bg-background`, `text-background`, `bg-primary`, `text-primary`, `border-primary`, `bg-muted`, `text-muted`, `border-muted`, `bg-border`, `border-border`, `text-error` — every later task in this plan uses these instead of the old `neutral-*`/`orange-*`/`red-*` classes.

- [ ] **Step 1: Add theme tokens to `src/index.css`**

Replace the entire file contents:

```css
@import "tailwindcss";

@theme {
  --color-background: #faf7f0;
  --color-primary: #231815;
  --color-muted: #8b8680;
  --color-border: #e8e2d8;
  --color-error: #c0392b;
}
```

- [ ] **Step 2: Update PWA manifest colors in `vite.config.ts`**

Change the `theme_color` and `background_color` fields inside the `VitePWA({ manifest: { ... } })` block:

```ts
        theme_color: '#231815',
        background_color: '#FAF7F0',
```

- [ ] **Step 3: Update the icon-generator's color constant**

In `scripts/generate-pwa-icons.mjs`, replace:

```js
const FLAME_ORANGE = [255, 107, 53]
writeFileSync('public/pwa-192x192.png', solidColorPng(192, FLAME_ORANGE))
writeFileSync('public/pwa-512x512.png', solidColorPng(512, FLAME_ORANGE))
```

with:

```js
const BRAND_PRIMARY = [0x23, 0x18, 0x15]
writeFileSync('public/pwa-192x192.png', solidColorPng(192, BRAND_PRIMARY))
writeFileSync('public/pwa-512x512.png', solidColorPng(512, BRAND_PRIMARY))
```

- [ ] **Step 4: Regenerate the icons**

Run: `node scripts/generate-pwa-icons.mjs`
Expected: prints `Generated placeholder PWA icons (solid color) in public/`. The two PNG files are now near-black instead of orange.

- [ ] **Step 5: Verify the app still type-checks and builds**

Run: `npx tsc -b --noEmit`
Expected: no errors (this task only touches CSS/config/a script, no TypeScript).

- [ ] **Step 6: Commit**

```bash
git add src/index.css vite.config.ts scripts/generate-pwa-icons.mjs public/pwa-192x192.png public/pwa-512x512.png
git commit -m "Add neutral design tokens and update PWA colors"
```

---

### Task 2: Shared Visual Components

**Files:**
- Create: `src/components/ForkLogo.tsx`
- Create: `src/components/icons.tsx`
- Create: `src/components/OnboardingProgress.tsx`

**Interfaces:**
- Consumes: tokens from Task 1 (`text-primary`, etc., via the `className` prop callers pass in).
- Produces: `<ForkLogo className? />`, `<CameraIcon className? />`, `<FlameIcon className? />`, `<PeopleIcon className? />`, `<OnboardingProgress step={number} total={number} />` — all consumed by Tasks 4–6.

- [ ] **Step 1: Write `src/components/ForkLogo.tsx`**

```tsx
export function ForkLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M7 2.5v5.5" />
      <path d="M10 2.5v5.5" />
      <path d="M13 2.5v5.5" />
      <path d="M7 8a3 3 0 0 0 6 0" />
      <path d="M10 8v13" />
    </svg>
  )
}
```

- [ ] **Step 2: Write `src/components/icons.tsx`**

```tsx
export function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}

export function FlameIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2c1 3-3 4-3 7a3 3 0 0 0 6 0c0-1-1-2-1-2 2 1 3 3 3 5a5 5 0 0 1-10 0c0-4 3-6 5-10Z" />
    </svg>
  )
}

export function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15.5 14c2.5.3 4.5 2.3 4.5 6" />
    </svg>
  )
}
```

- [ ] **Step 3: Write `src/components/OnboardingProgress.tsx`**

```tsx
export function OnboardingProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-8 flex gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-primary' : 'bg-border'}`} />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Verify it type-checks**

Run: `npx tsc -b --noEmit`
Expected: no errors. (These components aren't imported anywhere yet, so nothing renders them until Tasks 4–7 — this step only confirms the files themselves are valid TypeScript.)

- [ ] **Step 5: Commit**

```bash
git add src/components/ForkLogo.tsx src/components/icons.tsx src/components/OnboardingProgress.tsx
git commit -m "Add shared fork logo, feature icons, and onboarding progress bar"
```

---

### Task 3: Calorie Formula — Add Sex Field

**Files:**
- Modify: `src/lib/calorieGoal.ts`
- Modify: `src/lib/calorieGoal.test.ts`

**Interfaces:**
- Produces: `Sex = 'male' | 'female'` type and `CalorieGoalInputs` now requiring `sex: Sex`, exported from `src/lib/calorieGoal.ts` — consumed by Task 5's `CalorieGoal.tsx`.

- [ ] **Step 1: Update the test file first (TDD — write the new/changed assertions before touching the implementation)**

Replace `src/lib/calorieGoal.test.ts` entirely:

```ts
import { describe, expect, it } from 'vitest'
import { suggestCalorieGoal } from './calorieGoal'

describe('suggestCalorieGoal', () => {
  it('computes a sedentary suggestion for a male', () => {
    // BMR = 10*70 + 6.25*175 - 5*30 + 5 = 700 + 1093.75 - 150 + 5 = 1648.75
    // TDEE = 1648.75 * 1.2 = 1978.5 -> rounds to nearest 10 -> 1980
    const result = suggestCalorieGoal({ weightKg: 70, heightCm: 175, age: 30, sex: 'male', activityLevel: 'sedentary' })
    expect(result).toBe(1980)
  })

  it('computes a sedentary suggestion for a female', () => {
    // BMR = 10*70 + 6.25*175 - 5*30 - 161 = 700 + 1093.75 - 150 - 161 = 1482.75
    // TDEE = 1482.75 * 1.2 = 1779.3 -> rounds to nearest 10 -> 1780
    const result = suggestCalorieGoal({ weightKg: 70, heightCm: 175, age: 30, sex: 'female', activityLevel: 'sedentary' })
    expect(result).toBe(1780)
  })

  it('scales up with higher activity level', () => {
    const sedentary = suggestCalorieGoal({ weightKg: 70, heightCm: 175, age: 30, sex: 'male', activityLevel: 'sedentary' })
    const active = suggestCalorieGoal({ weightKg: 70, heightCm: 175, age: 30, sex: 'male', activityLevel: 'active' })
    expect(active).toBeGreaterThan(sedentary)
  })

  it('rounds to the nearest 10 calories', () => {
    const result = suggestCalorieGoal({ weightKg: 62, heightCm: 160, age: 25, sex: 'female', activityLevel: 'light' })
    expect(result % 10).toBe(0)
  })

  it('gives a higher result for male than female with identical other inputs', () => {
    const male = suggestCalorieGoal({ weightKg: 70, heightCm: 175, age: 30, sex: 'male', activityLevel: 'moderate' })
    const female = suggestCalorieGoal({ weightKg: 70, heightCm: 175, age: 30, sex: 'female', activityLevel: 'moderate' })
    expect(male).toBeGreaterThan(female)
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npm test`
Expected: FAIL — `calorieGoal.test.ts` has type errors (`sex` doesn't exist on `CalorieGoalInputs` yet) and/or the old formula's numbers won't match the new expected values.

- [ ] **Step 3: Update `src/lib/calorieGoal.ts`**

Replace the entire file:

```ts
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type Sex = 'male' | 'female'

export interface CalorieGoalInputs {
  weightKg: number
  heightCm: number
  age: number
  sex: Sex
  activityLevel: ActivityLevel
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

const SEX_CONSTANTS: Record<Sex, number> = {
  male: 5,
  female: -161,
}

/**
 * Suggests a daily calorie goal using the exact Mifflin-St Jeor BMR formula:
 * BMR = 10*weightKg + 6.25*heightCm - 5*age + (5 for male, -161 for female).
 * The result is always presented as an editable suggestion, never a fixed
 * requirement.
 */
export function suggestCalorieGoal(inputs: CalorieGoalInputs): number {
  const { weightKg, heightCm, age, sex, activityLevel } = inputs
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + SEX_CONSTANTS[sex]
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel]
  return Math.round(tdee / 10) * 10
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npm test`
Expected: 5/5 PASS in `calorieGoal.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calorieGoal.ts src/lib/calorieGoal.test.ts
git commit -m "Switch calorie goal formula to exact Mifflin-St Jeor with sex field"
```

---

### Task 4: Welcome & Sign In Retrofit

**Files:**
- Modify: `src/screens/onboarding/Welcome.tsx`
- Modify: `src/screens/onboarding/SignIn.tsx`

**Interfaces:**
- Consumes: `ForkLogo`, `CameraIcon`, `FlameIcon`, `PeopleIcon` (Task 2).
- Produces: no change to exported component names/props — both remain default exports with no props, matching `App.tsx`'s existing usage.

- [ ] **Step 1: Replace `src/screens/onboarding/Welcome.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'
import { ForkLogo } from '../../components/ForkLogo'
import { CameraIcon, FlameIcon, PeopleIcon } from '../../components/icons'

const FEATURES = [
  { Icon: CameraIcon, title: 'Photo-first logging', subtitle: 'One tap, an estimate, done.' },
  { Icon: FlameIcon, title: 'Daily streaks', subtitle: 'Milestones at 7, 30 and 100 days.' },
  { Icon: PeopleIcon, title: 'A friend feed', subtitle: 'Chronological. Public only if you say so.' },
]

export default function Welcome() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col justify-center gap-8 px-6 py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background">
          <ForkLogo className="h-5 w-5 text-primary" />
        </div>
        <span className="text-lg font-bold text-primary">Spork</span>
      </div>

      <div>
        <h1 className="text-4xl font-bold leading-tight text-primary">Track food like you train.</h1>
        <p className="mt-4 text-muted">
          Snap a photo, get a calorie estimate in seconds, and keep the streak alive with friends watching. No
          noise, no likes — just accountability.
        </p>
      </div>

      <ul className="flex flex-col gap-4">
        {FEATURES.map(({ Icon, title, subtitle }) => (
          <li key={title} className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-border/60">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-primary">{title}</p>
              <p className="text-sm text-muted">{subtitle}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-4">
        <button
          onClick={() => navigate('/sign-in?mode=sign-up')}
          className="w-full rounded-full bg-primary py-3 text-base font-semibold text-background"
        >
          Get started
        </button>
        <button onClick={() => navigate('/sign-in?mode=sign-in')} className="text-center text-sm text-muted">
          I already have an account
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/screens/onboarding/SignIn.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ForkLogo } from '../../components/ForkLogo'

export default function SignIn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialMode = searchParams.get('mode') === 'sign-up' ? 'sign-up' : 'sign-in'
  // Defaults to sign-in unless Welcome explicitly linked here with
  // ?mode=sign-up ("Get started"): after the very first signup, nearly
  // every visit to this screen is an existing user signing back in, and
  // signing up with an email that already exists returns a visible
  // "already registered" error rather than silently succeeding.
  const [mode, setMode] = useState<'sign-up' | 'sign-in'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { data, error: authError } =
      mode === 'sign-up'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setSubmitting(false)
      setError(authError.message)
      return
    }

    // Route straight to the feed for an already-onboarded returning user,
    // instead of always landing on /onboarding/profile and relying on the
    // RequireNotOnboarded guard to redirect onward — that guard still
    // works as defense-in-depth, but doing this check here avoids ever
    // mounting the onboarding screens for a user who doesn't need them.
    const userId = data.user?.id
    const { data: existingProfile } = userId
      ? await supabase.from('users').select('id').eq('id', userId).maybeSingle()
      : { data: null }

    setSubmitting(false)
    navigate(existingProfile ? '/home/feed' : '/onboarding/profile')
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={() => navigate('/welcome')}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary"
        >
          ←
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background">
            <ForkLogo className="h-4 w-4 text-primary" />
          </div>
          <span className="font-bold text-primary">Spork</span>
        </div>
      </div>

      <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-background">
        <ForkLogo className="h-7 w-7 text-primary" />
      </div>

      <h1 className="mb-2 text-2xl font-bold text-primary">
        {mode === 'sign-up' ? 'Create your account' : 'Welcome back'}
      </h1>
      <p className="mb-8 text-sm text-muted">
        {mode === 'sign-up'
          ? 'Email and password for now — phone sign-in is coming.'
          : 'Sign in to keep your streak going.'}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-full bg-border/60 px-5 py-3 text-base text-primary placeholder:text-muted"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-full bg-border/60 px-5 py-3 text-base text-primary placeholder:text-muted"
        />
        {error && <p className="text-sm text-error">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-primary py-3 text-base font-semibold text-background disabled:opacity-50"
        >
          {submitting ? 'Please wait…' : 'Continue'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}
        className="mt-6 text-center text-sm text-muted"
      >
        {mode === 'sign-up' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Manually verify**

Run: `npm run dev`. Visit `/welcome` — expect the new tagline, three feature rows with icons, "Get started" and "I already have an account" buttons, no console errors. Click "Get started" — expect `/sign-in?mode=sign-up` with heading "Create your account". Go back, click "I already have an account" — expect `/sign-in?mode=sign-in` with heading "Welcome back". Confirm actual sign-in with an existing test account still works and lands on `/home/feed`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/onboarding/Welcome.tsx src/screens/onboarding/SignIn.tsx
git commit -m "Retrofit Welcome and Sign In to new design system and copy"
```

---

### Task 5: Profile Setup & Calorie Goal Retrofit

**Files:**
- Modify: `src/screens/onboarding/ProfileSetup.tsx`
- Modify: `src/screens/onboarding/CalorieGoal.tsx`

**Interfaces:**
- Consumes: `OnboardingProgress` (Task 2), `Sex` and updated `CalorieGoalInputs` (Task 3).
- Produces: no change to exported component names/props.

- [ ] **Step 1: Replace `src/screens/onboarding/ProfileSetup.tsx`**

```tsx
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { isValidUsernameFormat } from '../../lib/username'
import { useOnboardingStore } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'

export default function ProfileSetup() {
  const navigate = useNavigate()
  const setProfile = useOnboardingStore((s) => s.setProfile)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const avatarPreviewUrl = useMemo(() => (avatarFile ? URL.createObjectURL(avatarFile) : null), [avatarFile])

  useEffect(() => {
    if (!avatarPreviewUrl) return
    return () => URL.revokeObjectURL(avatarPreviewUrl)
  }, [avatarPreviewUrl])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const normalizedUsername = username.trim().toLowerCase()

    if (!name.trim()) {
      setError('Name is required.')
      return
    }

    if (!isValidUsernameFormat(normalizedUsername)) {
      setError('Username must be 3-20 characters: lowercase letters, numbers, underscores.')
      return
    }

    setChecking(true)
    const { data: existing, error: lookupError } = await supabase
      .from('users')
      .select('id')
      .eq('username', normalizedUsername)
      .maybeSingle()
    setChecking(false)

    if (lookupError) {
      setError('Could not verify username availability. Try again.')
      return
    }

    if (existing) {
      setError('That username is already taken.')
      return
    }

    setProfile({ name: name.trim(), username: normalizedUsername, avatarFile })
    navigate('/onboarding/goal')
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      <button
        onClick={() => navigate('/welcome')}
        aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary"
      >
        ←
      </button>
      <OnboardingProgress step={1} total={4} />

      <h1 className="mb-2 text-2xl font-bold text-primary">Set up your profile</h1>
      <p className="mb-8 text-sm text-muted">This is what friends see on the feed.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="mx-auto mb-2 flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-border/60 text-center text-sm text-muted">
          {avatarPreviewUrl ? (
            <img src={avatarPreviewUrl} alt="" className="h-24 w-24 object-cover" />
          ) : (
            'Add photo'
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-full bg-border/60 px-5 py-3 text-base text-primary placeholder:text-muted"
        />
        <input
          placeholder="@ username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-full bg-border/60 px-5 py-3 text-base text-primary placeholder:text-muted"
        />
        {error && <p className="text-sm text-error">{error}</p>}
        <button
          type="submit"
          disabled={checking}
          className="rounded-full bg-primary py-3 text-base font-semibold text-background disabled:opacity-50"
        >
          {checking ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/screens/onboarding/CalorieGoal.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { suggestCalorieGoal, type ActivityLevel, type Sex } from '../../lib/calorieGoal'
import { useOnboardingStore } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary (little exercise)' },
  { value: 'light', label: 'Light (1-3 days/week)' },
  { value: 'moderate', label: 'Moderate (3-5 days/week)' },
  { value: 'active', label: 'Active (6-7 days/week)' },
  { value: 'very_active', label: 'Very active (physical job or 2x/day)' },
]

export default function CalorieGoal() {
  const navigate = useNavigate()
  const setCalorieGoal = useOnboardingStore((s) => s.setCalorieGoal)
  const [showCalculator, setShowCalculator] = useState(false)
  const [goal, setGoal] = useState('2000')
  const [weightKg, setWeightKg] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<Sex>('male')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate')
  const [error, setError] = useState<string | null>(null)

  function handleUseSuggestion() {
    const weight = Number(weightKg)
    const height = Number(heightCm)
    const ageNum = Number(age)

    if (!weight || !height || !ageNum) {
      setError('Fill in weight, height, and age to get a suggestion.')
      return
    }

    setError(null)
    const suggested = suggestCalorieGoal({ weightKg: weight, heightCm: height, age: ageNum, sex, activityLevel })
    setGoal(String(suggested))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const goalNum = Number(goal)

    if (!goalNum || goalNum < 800 || goalNum > 6000) {
      setError('Enter a calorie goal between 800 and 6000.')
      return
    }

    setCalorieGoal(goalNum)
    navigate('/onboarding/privacy')
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary"
      >
        ←
      </button>
      <OnboardingProgress step={2} total={4} />

      <h1 className="mb-2 text-2xl font-bold text-primary">Daily calorie goal</h1>
      <p className="mb-8 text-sm text-muted">You can change this any time in settings.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex items-baseline justify-center gap-2">
          <input
            inputMode="numeric"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="w-40 bg-transparent text-center text-6xl font-bold text-primary outline-none"
          />
          <span className="text-lg text-muted">kcal</span>
        </div>

        <button
          type="button"
          onClick={() => setShowCalculator((v) => !v)}
          className="mx-auto rounded-full bg-border/60 px-5 py-2 text-sm font-medium text-primary"
        >
          {showCalculator ? 'Hide calculator' : 'Not sure? Suggest one for me'}
        </button>

        {showCalculator && (
          <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted">Height cm</label>
                <input
                  inputMode="decimal"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-border/60 px-3 py-2 text-base text-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted">Weight kg</label>
                <input
                  inputMode="decimal"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-border/60 px-3 py-2 text-base text-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted">Age</label>
                <input
                  inputMode="numeric"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-border/60 px-3 py-2 text-base text-primary"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSex('male')}
                className={`flex-1 rounded-full py-2 text-sm font-medium ${sex === 'male' ? 'bg-primary text-background' : 'bg-border/60 text-primary'}`}
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => setSex('female')}
                className={`flex-1 rounded-full py-2 text-sm font-medium ${sex === 'female' ? 'bg-primary text-background' : 'bg-border/60 text-primary'}`}
              >
                Female
              </button>
            </div>

            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
              className="rounded-xl bg-border/60 px-3 py-2 text-base text-primary"
            >
              {ACTIVITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleUseSuggestion}
              className="rounded-full bg-border py-2 text-sm font-semibold text-primary"
            >
              Use suggestion
            </button>
          </div>
        )}

        {error && <p className="text-sm text-error">{error}</p>}

        <button type="submit" className="rounded-full bg-primary py-3 text-base font-semibold text-background">
          Continue
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Manually verify**

Run: `npm run dev`. On Profile Setup, confirm the progress bar shows 1 of 4 segments filled, tapping the circle opens a file picker and shows a preview once a photo is chosen. On Calorie Goal, confirm 2 of 4 segments filled, the big "2000 kcal" display, tapping "Not sure? Suggest one for me" reveals the calculator with a Male/Female toggle, filling in weight 70 / height 175 / age 30 / Male / sedentary and tapping "Use suggestion" sets the goal to **1980** (per Task 3's test).

- [ ] **Step 5: Commit**

```bash
git add src/screens/onboarding/ProfileSetup.tsx src/screens/onboarding/CalorieGoal.tsx
git commit -m "Retrofit Profile Setup and Calorie Goal to new design system"
```

---

### Task 6: Privacy Default & Add Friends Retrofit

**Files:**
- Modify: `src/screens/onboarding/PrivacyDefault.tsx`
- Modify: `src/screens/onboarding/AddFirstFriends.tsx`

**Interfaces:**
- Consumes: `OnboardingProgress` (Task 2).
- Produces: no change to exported component names/props or to `completeOnboarding`/search logic — visual retrofit only, one content removal noted in Step 2 below.

- [ ] **Step 1: Replace `src/screens/onboarding/PrivacyDefault.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore, type PrivacyDefault as PrivacyDefaultValue } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'

export default function PrivacyDefault() {
  const navigate = useNavigate()
  const setPrivacyDefault = useOnboardingStore((s) => s.setPrivacyDefault)

  function choose(value: PrivacyDefaultValue) {
    setPrivacyDefault(value)
    navigate('/onboarding/friends')
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary"
      >
        ←
      </button>
      <OnboardingProgress step={3} total={4} />

      <h1 className="mb-2 text-2xl font-bold text-primary">Who sees your meals?</h1>
      <p className="mb-8 text-sm text-muted">Every log can still be flipped individually.</p>

      <div className="flex flex-col gap-3">
        <button onClick={() => choose('public')} className="rounded-2xl border border-primary p-4 text-left">
          <p className="font-semibold text-primary">Public by default</p>
          <p className="text-sm text-muted">Friends see your meals in their feed.</p>
        </button>
        <button onClick={() => choose('private')} className="rounded-2xl border border-border p-4 text-left">
          <p className="font-semibold text-primary">Private by default</p>
          <p className="text-sm text-muted">Only you. Nothing shows up on the feed or in stats.</p>
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/screens/onboarding/AddFirstFriends.tsx`**

This drops the disabled decorative "Find from Contacts (coming soon)" button — the reference design's onboarding step doesn't include it, and it was never functional. All working logic (search, add, finish, the "progress lost" recovery screen from an earlier bugfix) is unchanged, only restyled.

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../hooks/useSession'
import { useOnboardingStore } from '../../store/onboardingStore'
import { completeOnboarding } from '../../lib/completeOnboarding'
import { OnboardingProgress } from '../../components/OnboardingProgress'

interface FoundUser {
  id: string
  username: string
  name: string
  photo_url: string | null
}

export default function AddFirstFriends() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { name, username, avatarFile, calorieGoal, privacyDefault, friendUsernamesToRequest, addFriendUsername, reset } =
    useOnboardingStore()

  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<FoundUser[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch() {
    setError(null)
    const term = searchTerm.trim().toLowerCase()
    if (!term) {
      setError('Type a username to search.')
      return
    }

    const { data, error: searchError } = await supabase
      .from('users')
      .select('id, username, name, photo_url')
      .ilike('username', `%${term}%`)
      .limit(10)

    if (searchError) {
      setError('Search failed. Try again.')
      return
    }

    setResults(data ?? [])
    if ((data ?? []).length === 0) {
      setError('No users found with that username.')
    }
  }

  async function finish() {
    // The `calorieGoal === null` case is handled by the early-return render
    // below (it shows "Restart onboarding" instead of this screen), so this
    // check only narrows the type for TypeScript — it isn't reachable in
    // practice once that guard is in place.
    if (!session || calorieGoal === null) return
    setSubmitting(true)
    setError(null)

    try {
      await completeOnboarding({
        userId: session.user.id,
        name,
        username,
        avatarFile,
        calorieGoal,
        privacyDefault,
        friendUsernamesToRequest,
      })
      reset()
      navigate('/home/feed')
    } catch (err) {
      const isUsernameConflict =
        typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '23505'

      setError(
        isUsernameConflict
          ? 'That username was just taken by someone else.'
          : 'Something went wrong finishing setup. Please try again.',
      )

      if (isUsernameConflict) {
        navigate('/onboarding/profile')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (calorieGoal === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted">
          Your progress from earlier onboarding steps was lost (e.g. by a page reload). Please restart.
        </p>
        <button
          onClick={() => navigate('/onboarding/profile')}
          className="rounded-full bg-primary px-6 py-3 text-base font-semibold text-background"
        >
          Restart onboarding
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary"
      >
        ←
      </button>
      <OnboardingProgress step={4} total={4} />

      <h1 className="mb-2 text-2xl font-bold text-primary">Add your first friends</h1>
      <p className="mb-6 text-sm text-muted">A feed is better with people in it.</p>

      <div className="mb-4 flex gap-2">
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

      <ul className="mb-6 flex flex-col gap-2">
        {results.map((user) => {
          const alreadyAdded = friendUsernamesToRequest.includes(user.username)
          return (
            <li key={user.id} className="flex items-center justify-between rounded-full border border-border px-4 py-2">
              <span className="font-medium text-primary">@{user.username}</span>
              <button
                disabled={alreadyAdded}
                onClick={() => addFriendUsername(user.username)}
                className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-background disabled:opacity-40"
              >
                {alreadyAdded ? 'Added' : 'Add'}
              </button>
            </li>
          )
        })}
      </ul>

      {error && <p className="mb-4 text-sm text-error">{error}</p>}

      <button
        onClick={finish}
        disabled={submitting}
        className="rounded-full bg-primary py-3 text-base font-semibold text-background disabled:opacity-50"
      >
        {submitting ? 'Finishing…' : friendUsernamesToRequest.length > 0 ? 'Finish' : 'Skip for now'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Manually verify**

Run: `npm run dev`. Confirm Privacy screen shows 3 of 4 progress segments, Public option has a highlighted border. Confirm Add Friends shows 4 of 4 segments, search still works end-to-end (search an existing test user's username, Add, Finish lands on `/home/feed`), and the "Find from Contacts" button is gone.

- [ ] **Step 5: Commit**

```bash
git add src/screens/onboarding/PrivacyDefault.tsx src/screens/onboarding/AddFirstFriends.tsx
git commit -m "Retrofit Privacy Default and Add Friends to new design system"
```

---

### Task 7: 5-Tab Navigation & Friends Placeholder

**Files:**
- Modify: `src/components/BottomTabBar.tsx`
- Modify: `src/screens/home/HomeShell.tsx`
- Create: `src/screens/friends/FriendsPlaceholder.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `/home/friends` route — Phase 3 (Friends + Feed) replaces `FriendsPlaceholder` with the real screen, the same pattern already used for `FeedPlaceholder`/`LogPlaceholder`/`RewardsPlaceholder`.

- [ ] **Step 1: Replace `src/components/BottomTabBar.tsx`**

```tsx
import { NavLink } from 'react-router-dom'

const SIDE_TABS = [
  { to: '/home/feed', label: 'Feed', icon: '🏠' },
  { to: '/home/rewards', label: 'Streaks', icon: '🔥' },
]

const RIGHT_TABS = [
  { to: '/home/friends', label: 'Friends', icon: '👥' },
  { to: '/home/profile', label: 'Profile', icon: '👤' },
]

export function BottomTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[430px] items-center justify-around border-t border-border bg-background py-2">
      {SIDE_TABS.map((tab) => (
        <TabLink key={tab.to} {...tab} />
      ))}

      <NavLink
        to="/home/log"
        aria-label="Log a meal"
        className="flex h-14 w-14 -translate-y-3 items-center justify-center rounded-full bg-primary text-2xl text-background shadow-lg"
      >
        +
      </NavLink>

      {RIGHT_TABS.map((tab) => (
        <TabLink key={tab.to} {...tab} />
      ))}
    </nav>
  )
}

function TabLink({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${isActive ? 'text-primary' : 'text-muted'}`
      }
    >
      <span className="text-xl">{icon}</span>
      {label}
    </NavLink>
  )
}
```

- [ ] **Step 2: Update `src/screens/home/HomeShell.tsx`**

The raised center button now extends above the bar, so the content needs a bit more bottom padding to avoid being covered:

```tsx
import { Outlet } from 'react-router-dom'
import { BottomTabBar } from '../../components/BottomTabBar'

export function HomeShell() {
  return (
    <div className="pb-20">
      <Outlet />
      <BottomTabBar />
    </div>
  )
}
```

- [ ] **Step 3: Write `src/screens/friends/FriendsPlaceholder.tsx`**

```tsx
export default function FriendsPlaceholder() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 text-center">
      <p className="text-muted">Friends are coming in the next phase.</p>
    </div>
  )
}
```

- [ ] **Step 4: Update `src/App.tsx`**

Add the import `import FriendsPlaceholder from './screens/friends/FriendsPlaceholder'`, and add a new nested route inside the existing `/home` route block, alongside `feed`/`log`/`rewards`/`profile`:

```tsx
<Route path="friends" element={<FriendsPlaceholder />} />
```

- [ ] **Step 5: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Manually verify**

Run: `npm run dev`. Sign in as an onboarded test user. Confirm the tab bar shows 5 items: Feed, Streaks, a raised unlabeled "+" circle, Friends, Profile. Tap Friends — expect the URL to become `/home/friends` and show "Friends are coming in the next phase." Tap the center "+" — expect navigation to `/home/log` (unchanged placeholder). Confirm the page content isn't clipped behind the taller tab bar.

- [ ] **Step 7: Commit**

```bash
git add src/components/BottomTabBar.tsx src/screens/home/HomeShell.tsx src/screens/friends/FriendsPlaceholder.tsx src/App.tsx
git commit -m "Restructure bottom nav to 5 tabs with floating Log button and add Friends placeholder"
```

---

### Task 8: Remaining Placeholders & Profile Screen Retrofit

**Files:**
- Modify: `src/screens/feed/FeedPlaceholder.tsx`
- Modify: `src/screens/log/LogPlaceholder.tsx`
- Modify: `src/screens/rewards/RewardsPlaceholder.tsx`
- Modify: `src/screens/profile/ProfileScreen.tsx`

**Interfaces:**
- Consumes: design tokens (Task 1). No interface changes — same exports, same props.

- [ ] **Step 1: Update `src/screens/feed/FeedPlaceholder.tsx`**

```tsx
export default function FeedPlaceholder() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 text-center">
      <p className="text-muted">Feed is coming in the next phase.</p>
    </div>
  )
}
```

- [ ] **Step 2: Update `src/screens/log/LogPlaceholder.tsx`**

```tsx
export default function LogPlaceholder() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 text-center">
      <p className="text-muted">The log flow is coming in a later phase.</p>
    </div>
  )
}
```

- [ ] **Step 3: Update `src/screens/rewards/RewardsPlaceholder.tsx`**

```tsx
export default function RewardsPlaceholder() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 text-center">
      <p className="text-muted">Streaks & rewards are coming in a later phase.</p>
    </div>
  )
}
```

- [ ] **Step 4: Update `src/screens/profile/ProfileScreen.tsx`**

```tsx
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { supabase } from '../../lib/supabase'

export default function ProfileScreen() {
  const { data: user, isLoading } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex flex-col items-center gap-4 px-6 pt-10">
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
      <div className="w-full rounded-2xl border border-border p-4 text-center">
        <p className="text-3xl font-bold text-primary">{user.calorie_goal ?? '—'}</p>
        <p className="text-xs text-muted">daily calorie goal</p>
      </div>
      <button onClick={() => supabase.auth.signOut()} className="mt-4 text-sm text-error">
        Sign out
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Type-check and run the full test suite**

Run: `npx tsc -b --noEmit`
Expected: no errors.

Run: `npm test`
Expected: all tests pass (should be 10 total after Task 3's additions: smoke, username×4, calorieGoal×5).

- [ ] **Step 6: Manually verify**

Run: `npm run dev`. Visit each of Feed, Log, Streaks, Profile — confirm consistent cream/near-black styling, no leftover orange or `neutral-*` look anywhere. Confirm Profile still shows real name/username/calorie goal and Sign Out still works.

- [ ] **Step 7: Commit**

```bash
git add src/screens/feed/FeedPlaceholder.tsx src/screens/log/LogPlaceholder.tsx src/screens/rewards/RewardsPlaceholder.tsx src/screens/profile/ProfileScreen.tsx
git commit -m "Retrofit remaining placeholders and profile screen to new design system"
```

---

## Retrofit Complete

At this point: every Phase 1 screen (Welcome, Sign In, full onboarding, home shell, Profile) uses the new neutral design system and pill-shaped controls, the bottom nav is a 5-tab layout with Friends as a real (placeholder) tab and Log as a raised floating button, and the calorie-goal calculator uses the exact Mifflin-St Jeor formula with a sex field. No backend or routing-guard logic changed — Phase 3 (Friends + Feed) picks up from here with the new design already in place.
