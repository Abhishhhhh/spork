# Spork Phase 1: Foundation + Onboarding/Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Spork project (React + Vite + Tailwind + Supabase) and ship a working, testable onboarding flow: a new user can sign up, set up a profile, get a suggested calorie goal, choose a privacy default, optionally add friends, and land in a 4-tab home shell with a real Profile screen.

**Architecture:** A React SPA (Vite, TypeScript, Tailwind v4) talking directly to Supabase (Postgres + Auth + Storage) from the client, with Postgres Row-Level Security as the enforcement layer for every privacy rule. Client-only wizard state (the in-progress onboarding form) lives in a small Zustand store; server state (session, current user row) is read via TanStack Query. No backend server code in this phase — Edge Functions arrive in Phase 3 for the AI proxy.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), React Router, TanStack Query, Zustand, `@supabase/supabase-js` v2, Vitest for unit tests, `vite-plugin-pwa` for installability.

## Global Constraints

- Mobile-first layout: content centered in a `max-width: 430px` column, iOS-style bottom tab bar. (spec §2, §4)
- Auth is email-only for this phase — no phone/SMS provider. (spec §9)
- Private logs and any stats derived from them must never be visible to friends; enforce this with Postgres RLS, not app-side filtering alone. (spec §3, §6)
- No comments or likes anywhere in the product. (spec §6)
- No dark patterns: no paywalled streak-freeze, no manipulative copy, ever. (spec §6)
- Streak-risk reminder time is a UI-only preference — no real push notification delivery in this phase. (spec §9)
- Local dev only — `npm run dev` against a hosted Supabase project; no deployment/hosting setup in this phase. (spec §9)
- Explicitly out of scope, don't build any of: barcode scanning, restaurant menu database, Apple Health/wearable sync, in-app messaging, algorithmic feed ranking, Android-specific anything, real push notifications, native App Store distribution, an admin UI for rewards. (spec §10)
- "Estimate — tap to adjust" honesty framing applies to any AI-derived number (not used until Phase 3, but keep the principle in mind — never present an estimate as ground truth).

---

## Before You Start: Human-Action Prerequisites

Two things only a human can do — no coding step can substitute for these. Do them before Task 2.

1. **Create a Supabase project.** Go to https://supabase.com/dashboard, create a new project (any name, e.g. "spork", any region, set a database password you'll remember). Wait for provisioning to finish.
2. **Get your API credentials.** In the project, go to Settings → API. Copy the **Project URL** and the **anon public** key. You'll paste these into `.env.local` in Task 3.
3. **Disable email confirmation for this dev phase.** In Authentication → Providers → Email (or Authentication → Settings, depending on dashboard version), turn **off** "Confirm email". Without this, `supabase.auth.signUp()` won't return an active session until the user clicks a confirmation link, and Supabase's shared dev SMTP is heavily rate-limited — both would block testing. Turning it back on later (before any real users) is a one-click change, not a code change.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `src/index.css`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/lib/queryClient.ts`
- Create: `scripts/generate-pwa-icons.mjs`
- Create: `src/lib/smoke.test.ts`
- Create: `.gitignore`

**Interfaces:**
- Produces: `queryClient` (named export from `src/lib/queryClient.ts`, a configured `QueryClient` instance) — every later data-fetching hook imports this.
- Produces: `public/pwa-192x192.png`, `public/pwa-512x512.png` — referenced by `vite.config.ts`'s PWA manifest and by `index.html`'s apple-touch-icon link.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "spork",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Install runtime dependencies**

Run:
```bash
npm install react react-dom react-router-dom @tanstack/react-query @supabase/supabase-js zustand
```

- [ ] **Step 3: Install dev dependencies**

Run:
```bash
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom tailwindcss @tailwindcss/vite vite-plugin-pwa vitest
```

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vite-plugin-pwa/react", "vitest/globals"]
  },
  "include": ["src", "vite.config.ts", "scripts"]
}
```

- [ ] **Step 5: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <link rel="apple-touch-icon" href="/pwa-192x192.png" />
    <title>Spork</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Write `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Spork',
        short_name: 'Spork',
        description: 'Social calorie & nutrition tracker',
        theme_color: '#FF6B35',
        background_color: '#FFFFFF',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    globals: true,
  },
})
```

- [ ] **Step 7: Write `src/index.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 8: Write `src/lib/queryClient.ts`**

```ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})
```

- [ ] **Step 9: Write `src/App.tsx`** (temporary placeholder — Task 8 replaces this with real routes)

```tsx
export default function App() {
  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-white">
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg font-semibold text-neutral-900">Spork</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 10: Write `src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
```

- [ ] **Step 11: Write `scripts/generate-pwa-icons.mjs`**

This generates real (solid-color, stand-in) PNG icon files with no external image dependency — swap these for real branded artwork whenever you have it; the manifest reference and file paths won't need to change.

```js
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

function crc32(buf) {
  const table = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

function solidColorPng(size, [r, g, b]) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: RGB
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const rowBytes = size * 3
  const raw = Buffer.alloc((rowBytes + 1) * size)
  for (let y = 0; y < size; y++) {
    const rowStart = y * (rowBytes + 1)
    raw[rowStart] = 0 // filter type: none
    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 3
      raw[px] = r
      raw[px + 1] = g
      raw[px + 2] = b
    }
  }
  const idat = deflateSync(raw)

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

const FLAME_ORANGE = [255, 107, 53]
writeFileSync('public/pwa-192x192.png', solidColorPng(192, FLAME_ORANGE))
writeFileSync('public/pwa-512x512.png', solidColorPng(512, FLAME_ORANGE))
console.log('Generated placeholder PWA icons (solid color) in public/')
```

Run:
```bash
node scripts/generate-pwa-icons.mjs
```

Expected: prints `Generated placeholder PWA icons (solid color) in public/`, and `public/pwa-192x192.png` + `public/pwa-512x512.png` exist.

- [ ] **Step 12: Write `src/lib/smoke.test.ts`** (confirms the Vitest wiring itself works)

```ts
import { describe, expect, it } from 'vitest'

describe('smoke test', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 13: Run the smoke test**

Run: `npm test`
Expected: 1 test file, 1 test, PASS.

- [ ] **Step 14: Write `.gitignore`**

```
node_modules
dist
dist-ssr
.env.local
*.local
```

- [ ] **Step 15: Manually verify the dev server**

Run: `npm run dev`
Open the printed local URL in a browser. Expected: a white page with centered bold text "Spork", content visibly constrained to a narrow mobile-width column even on a wide desktop window. Stop the dev server (Ctrl+C) once confirmed.

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "Scaffold Spork: Vite + React + TS + Tailwind v4 + PWA + Vitest"
```

---

### Task 2: Database Schema & Row-Level Security

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: the `users`, `friendships`, `logs`, `rewards`, `redemptions` tables and a public `avatars` storage bucket, all referenced by every subsequent task's Supabase queries.

**Note on verification:** the Supabase SQL Editor runs as the `postgres` superuser, which bypasses RLS entirely — so policies can't be meaningfully sanity-checked from the editor itself. This task's RLS is instead verified functionally in Task 4 and Task 7 by testing with two real signed-in accounts through the actual app.

- [ ] **Step 1: Write `supabase/migrations/0001_init.sql`**

```sql
-- Spork initial schema: core tables + Row-Level Security policies.
-- Run this once, in full, via the Supabase Dashboard SQL Editor
-- (Project → SQL Editor → New query → paste this file → Run).

create table users (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  name text not null,
  photo_url text,
  calorie_goal int,
  privacy_default text not null default 'public' check (privacy_default in ('public','private')),
  streak_count int not null default 0,
  streak_last_log_date date,
  reminder_time time,
  created_at timestamptz not null default now()
);

alter table users enable row level security;

-- Any authenticated user can look up any profile (needed for username search
-- and for showing friends' names/photos on the feed). Only the owner can
-- create or edit their own row.
create policy "users_select_all_authenticated"
  on users for select
  to authenticated
  using (true);

create policy "users_insert_own"
  on users for insert
  to authenticated
  with check (auth.uid() = id);

create policy "users_update_own"
  on users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references users(id) on delete cascade,
  recipient_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  constraint friendships_no_self_friend check (requester_id <> recipient_id),
  constraint friendships_unique_pair unique (least(requester_id, recipient_id), greatest(requester_id, recipient_id))
);

alter table friendships enable row level security;

create policy "friendships_select_participants"
  on friendships for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

create policy "friendships_insert_as_requester"
  on friendships for insert
  to authenticated
  with check (auth.uid() = requester_id);

-- Only the recipient may accept (transition pending -> accepted).
create policy "friendships_update_recipient_accepts"
  on friendships for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- "Decline" removes a still-pending request; either party may do it.
create policy "friendships_delete_pending_participant"
  on friendships for delete
  to authenticated
  using (status = 'pending' and (auth.uid() = requester_id or auth.uid() = recipient_id));

create table logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  photo_url text,
  description text,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  visibility text not null check (visibility in ('public','private')),
  calories_estimate int,
  calories_final int,
  protein_estimate_g int,
  protein_final_g int,
  carbs_estimate_g int,
  carbs_final_g int,
  fat_estimate_g int,
  fat_final_g int,
  ai_confidence text check (ai_confidence in ('low','medium','high')),
  ai_raw_response jsonb,
  created_at timestamptz not null default now()
);

alter table logs enable row level security;

-- A log is visible to its owner always, or to a friend (accepted
-- friendship, either direction) only if it's marked public. This is the
-- single guarantee the app's privacy model depends on.
create policy "logs_select_own_or_public_friend"
  on logs for select
  to authenticated
  using (
    auth.uid() = user_id
    or (
      visibility = 'public'
      and exists (
        select 1 from friendships f
        where f.status = 'accepted'
          and (
            (f.requester_id = auth.uid() and f.recipient_id = logs.user_id)
            or (f.recipient_id = auth.uid() and f.requester_id = logs.user_id)
          )
      )
    )
  );

create policy "logs_insert_own"
  on logs for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "logs_update_own"
  on logs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table rewards (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null,
  offer_description text not null,
  milestone_required int not null,
  expiry_date date
);

alter table rewards enable row level security;

-- Rewards are seeded by SQL migration only — no client insert/update/delete
-- policy exists, so those operations are denied by default under RLS.
create policy "rewards_select_all_authenticated"
  on rewards for select
  to authenticated
  using (true);

create table redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  reward_id uuid not null references rewards(id) on delete cascade,
  code text not null,
  status text not null default 'redeemed' check (status in ('unredeemed','redeemed','expired')),
  redeemed_at timestamptz not null default now()
);

alter table redemptions enable row level security;

create policy "redemptions_select_own"
  on redemptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "redemptions_insert_own"
  on redemptions for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Storage: "avatars" bucket for profile photos, public.
-- Path convention: {user_id}/avatar.<ext>
-- Profile photos aren't privacy-sensitive the way meal logs are (every user
-- who can see you at all can already see your name/photo during search),
-- so this bucket is public for simple, stable URLs. Only the owner may
-- write into their own folder. Meal photos get their own private bucket
-- with visibility-aware policies in the Phase 3 (Log flow) migration.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

create policy "avatars_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own_folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

- [ ] **Step 2: Apply the migration**

In the Supabase Dashboard, go to SQL Editor → New query, paste the entire contents of `supabase/migrations/0001_init.sql`, and click Run.
Expected: "Success. No rows returned." Confirm in Table Editor that `users`, `friendships`, `logs`, `rewards`, `redemptions` all appear, and that Storage shows an `avatars` bucket.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "Add initial Supabase schema and RLS policies"
```

---

### Task 3: Supabase Client & Typed Schema

**Files:**
- Create: `.env.example`
- Create: `src/lib/database.types.ts`
- Create: `src/lib/supabase.ts`

**Interfaces:**
- Consumes: the schema from Task 2 (mirrors its column names/types by hand).
- Produces: `supabase` (named export from `src/lib/supabase.ts`, a `SupabaseClient<Database>`) and `Database` (exported type from `src/lib/database.types.ts`) — every later Supabase query in the app imports one or both of these.

- [ ] **Step 1: Write `.env.example`**

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

- [ ] **Step 2: Create your real `.env.local`** (not committed — already covered by `.gitignore`)

Copy `.env.example` to `.env.local` and fill in the Project URL and anon public key you saved from the "Before You Start" section.

- [ ] **Step 3: Write `src/lib/database.types.ts`**

```ts
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          username: string
          name: string
          photo_url: string | null
          calorie_goal: number | null
          privacy_default: 'public' | 'private'
          streak_count: number
          streak_last_log_date: string | null
          reminder_time: string | null
          created_at: string
        }
        Insert: {
          id: string
          username: string
          name: string
          photo_url?: string | null
          calorie_goal?: number | null
          privacy_default?: 'public' | 'private'
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      friendships: {
        Row: {
          id: string
          requester_id: string
          recipient_id: string
          status: 'pending' | 'accepted'
          created_at: string
        }
        Insert: {
          requester_id: string
          recipient_id: string
        }
        Update: {
          status?: 'pending' | 'accepted'
        }
      }
      logs: {
        Row: {
          id: string
          user_id: string
          photo_url: string | null
          description: string | null
          meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          visibility: 'public' | 'private'
          calories_estimate: number | null
          calories_final: number | null
          protein_estimate_g: number | null
          protein_final_g: number | null
          carbs_estimate_g: number | null
          carbs_final_g: number | null
          fat_estimate_g: number | null
          fat_final_g: number | null
          ai_confidence: 'low' | 'medium' | 'high' | null
          ai_raw_response: unknown
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['logs']['Row']> & {
          user_id: string
          meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          visibility: 'public' | 'private'
        }
        Update: Partial<Database['public']['Tables']['logs']['Row']>
      }
      rewards: {
        Row: {
          id: string
          partner_name: string
          offer_description: string
          milestone_required: number
          expiry_date: string | null
        }
        Insert: never
        Update: never
      }
      redemptions: {
        Row: {
          id: string
          user_id: string
          reward_id: string
          code: string
          status: 'unredeemed' | 'redeemed' | 'expired'
          redeemed_at: string
        }
        Insert: {
          user_id: string
          reward_id: string
          code: string
        }
        Update: never
      }
    }
  }
}
```

- [ ] **Step 4: Write `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in your project values.',
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no type errors. (Live connectivity is verified functionally in Task 4, once there's a sign-in screen to exercise it.)

- [ ] **Step 6: Commit**

```bash
git add .env.example src/lib/database.types.ts src/lib/supabase.ts
git commit -m "Add typed Supabase client"
```

---

### Task 4: Auth (Sign Up / Sign In) & Session Handling

**Files:**
- Create: `src/screens/onboarding/Welcome.tsx`
- Create: `src/screens/onboarding/SignIn.tsx`
- Create: `src/hooks/useSession.ts`
- Create: `src/hooks/useCurrentUser.ts`
- Create: `src/components/ProtectedRoute.tsx`
- Create: `src/components/RequireNotOnboarded.tsx`
- Modify: `src/App.tsx` (replace the Task 1 placeholder with real routes)

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase.ts` (Task 3).
- Produces: `useSession()` returning `{ session: Session | null, loading: boolean }`; `useCurrentUser()` (a TanStack Query hook) returning `{ data: UserRow | null, isLoading: boolean, ... }` where `UserRow = Database['public']['Tables']['users']['Row']`; `<ProtectedRoute>` and `<RequireNotOnboarded>` wrapper components — all reused by every task from here on.

- [ ] **Step 1: Write `src/hooks/useSession.ts`**

```ts
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface SessionState {
  session: Session | null
  loading: boolean
}

export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return { session, loading }
}
```

- [ ] **Step 2: Write `src/hooks/useCurrentUser.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import { useSession } from './useSession'

export type UserRow = Database['public']['Tables']['users']['Row']

export function useCurrentUser() {
  const { session } = useSession()
  const userId = session?.user.id

  return useQuery({
    queryKey: ['currentUser', userId],
    queryFn: async (): Promise<UserRow | null> => {
      const { data, error } = await supabase.from('users').select('*').eq('id', userId!).maybeSingle()

      if (error) throw error
      return data
    },
    enabled: Boolean(userId),
  })
}
```

- [ ] **Step 3: Write `src/components/ProtectedRoute.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-400">Loading…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/sign-in" replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 4: Write `src/components/RequireNotOnboarded.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'

/** Guards onboarding routes: bounces an already-onboarded user to /home/feed. */
export function RequireNotOnboarded({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-400">Loading…</p>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/home/feed" replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 5: Write `src/screens/onboarding/Welcome.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'

export default function Welcome() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold text-neutral-900">🍴 Spork</h1>
      <p className="text-neutral-500">Log meals, share with friends, build your streak.</p>
      <button
        onClick={() => navigate('/sign-in')}
        className="w-full rounded-2xl bg-orange-500 py-3 text-base font-semibold text-white"
      >
        Get Started
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Write `src/screens/onboarding/SignIn.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function SignIn() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'sign-up' | 'sign-in'>('sign-up')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error: authError } =
      mode === 'sign-up'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password })

    setSubmitting(false)

    if (authError) {
      setError(authError.message)
      return
    }

    navigate('/onboarding/profile')
  }

  return (
    <div className="flex min-h-screen flex-col justify-center px-6">
      <h1 className="mb-8 text-3xl font-bold text-neutral-900">Spork</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-2xl border border-neutral-200 px-4 py-3 text-base"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-2xl border border-neutral-200 px-4 py-3 text-base"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-2xl bg-orange-500 py-3 text-base font-semibold text-white disabled:opacity-50"
        >
          {submitting ? 'Please wait…' : mode === 'sign-up' ? 'Sign Up' : 'Sign In'}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}
        className="mt-6 text-sm text-neutral-500"
      >
        {mode === 'sign-up' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
      </button>
    </div>
  )
}
```

- [ ] **Step 7: Replace `src/App.tsx`**

```tsx
import { Navigate, Route, Routes } from 'react-router-dom'
import Welcome from './screens/onboarding/Welcome'
import SignIn from './screens/onboarding/SignIn'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RequireNotOnboarded } from './components/RequireNotOnboarded'

export default function App() {
  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-white">
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route
          path="/onboarding/profile"
          element={
            <ProtectedRoute>
              <RequireNotOnboarded>
                <div className="p-6 text-center text-neutral-400">Profile setup — coming in the next task</div>
              </RequireNotOnboarded>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    </div>
  )
}
```

- [ ] **Step 8: Manually verify sign-up and session persistence**

Run: `npm run dev`
In the browser: visit `/welcome`, click "Get Started", sign up with a real-looking test email (e.g. `test1@example.com`) and a password of 6+ characters.
Expected: redirected to the "Profile setup — coming in the next task" placeholder. Reload the page — expected: still on that same placeholder (proves the session persisted via `getSession()`/`onAuthStateChange`), not bounced back to `/sign-in`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add auth: sign up/sign in, session hook, protected routes"
```

---

### Task 5: Onboarding — Profile Setup

**Files:**
- Create: `src/store/onboardingStore.ts`
- Create: `src/lib/username.ts`
- Create: `src/lib/username.test.ts`
- Create: `src/screens/onboarding/ProfileSetup.tsx`
- Modify: `src/App.tsx` (swap the `/onboarding/profile` placeholder for the real screen; add a `/onboarding/goal` placeholder)

**Interfaces:**
- Consumes: `supabase` (Task 3).
- Produces: `useOnboardingStore()` (Zustand hook) with fields `name`, `username`, `avatarFile`, `calorieGoal`, `privacyDefault`, `friendUsernamesToRequest`, and actions `setProfile`, `setCalorieGoal`, `setPrivacyDefault`, `addFriendUsername`, `reset` — consumed by Tasks 6 and 7. `isValidUsernameFormat(username: string): boolean` from `src/lib/username.ts`.

- [ ] **Step 1: Write the failing test — `src/lib/username.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { isValidUsernameFormat } from './username'

describe('isValidUsernameFormat', () => {
  it('accepts a valid lowercase username', () => {
    expect(isValidUsernameFormat('john_doe123')).toBe(true)
  })

  it('rejects usernames shorter than 3 characters', () => {
    expect(isValidUsernameFormat('ab')).toBe(false)
  })

  it('rejects usernames with spaces or symbols', () => {
    expect(isValidUsernameFormat('john doe!')).toBe(false)
  })

  it('rejects uppercase letters', () => {
    expect(isValidUsernameFormat('JohnDoe')).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test`
Expected: FAIL — `src/lib/username.ts` does not exist yet.

- [ ] **Step 3: Write `src/lib/username.ts`**

```ts
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/

export function isValidUsernameFormat(username: string): boolean {
  return USERNAME_PATTERN.test(username)
}
```

- [ ] **Step 4: Run the test again to confirm it passes**

Run: `npm test`
Expected: 4/4 PASS.

- [ ] **Step 5: Write `src/store/onboardingStore.ts`**

```ts
import { create } from 'zustand'

export type PrivacyDefault = 'public' | 'private'

interface OnboardingState {
  name: string
  username: string
  avatarFile: File | null
  calorieGoal: number | null
  privacyDefault: PrivacyDefault
  friendUsernamesToRequest: string[]
  setProfile: (fields: { name: string; username: string; avatarFile: File | null }) => void
  setCalorieGoal: (goal: number) => void
  setPrivacyDefault: (value: PrivacyDefault) => void
  addFriendUsername: (username: string) => void
  reset: () => void
}

const initialState = {
  name: '',
  username: '',
  avatarFile: null as File | null,
  calorieGoal: null as number | null,
  privacyDefault: 'public' as PrivacyDefault,
  friendUsernamesToRequest: [] as string[],
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,
  setProfile: (fields) => set(fields),
  setCalorieGoal: (goal) => set({ calorieGoal: goal }),
  setPrivacyDefault: (value) => set({ privacyDefault: value }),
  addFriendUsername: (username) =>
    set((state) => ({ friendUsernamesToRequest: [...state.friendUsernamesToRequest, username] })),
  reset: () => set(initialState),
}))
```

- [ ] **Step 6: Write `src/screens/onboarding/ProfileSetup.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { isValidUsernameFormat } from '../../lib/username'
import { useOnboardingStore } from '../../store/onboardingStore'

export default function ProfileSetup() {
  const navigate = useNavigate()
  const setProfile = useOnboardingStore((s) => s.setProfile)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

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
    <div className="flex min-h-screen flex-col justify-center px-6">
      <h1 className="mb-8 text-2xl font-bold text-neutral-900">Set up your profile</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-2xl border border-neutral-200 px-4 py-3 text-base"
        />
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-2xl border border-neutral-200 px-4 py-3 text-base"
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
          className="text-sm text-neutral-500"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={checking}
          className="rounded-2xl bg-orange-500 py-3 text-base font-semibold text-white disabled:opacity-50"
        >
          {checking ? 'Checking…' : 'Next'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 7: Update `src/App.tsx`**

Replace the `/onboarding/profile` route's placeholder element with `<ProfileSetup />` (add the import), and add a new placeholder route below it:

```tsx
import ProfileSetup from './screens/onboarding/ProfileSetup'
// ...
<Route
  path="/onboarding/profile"
  element={
    <ProtectedRoute>
      <RequireNotOnboarded>
        <ProfileSetup />
      </RequireNotOnboarded>
    </ProtectedRoute>
  }
/>
<Route
  path="/onboarding/goal"
  element={
    <ProtectedRoute>
      <RequireNotOnboarded>
        <div className="p-6 text-center text-neutral-400">Calorie goal — coming in the next task</div>
      </RequireNotOnboarded>
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 8: Manually verify**

Run: `npm run dev`. Sign in as the test user from Task 4. Try an invalid username (e.g. "AB") — expect an inline error. Try a valid, unused username with a name — expect navigation to the "Calorie goal — coming in the next task" placeholder.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add onboarding profile setup with username validation"
```

---

### Task 6: Onboarding — Calorie Goal

**Files:**
- Create: `src/lib/calorieGoal.ts`
- Create: `src/lib/calorieGoal.test.ts`
- Create: `src/screens/onboarding/CalorieGoal.tsx`
- Modify: `src/App.tsx` (swap the `/onboarding/goal` placeholder; add a `/onboarding/privacy` placeholder)

**Interfaces:**
- Consumes: `useOnboardingStore()` (Task 5).
- Produces: `suggestCalorieGoal(inputs: CalorieGoalInputs): number` and `ActivityLevel` type from `src/lib/calorieGoal.ts` — used only within this screen, but exported in case a later Settings "recompute suggestion" feature wants it.

- [ ] **Step 1: Write the failing test — `src/lib/calorieGoal.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { suggestCalorieGoal } from './calorieGoal'

describe('suggestCalorieGoal', () => {
  it('computes a sedentary suggestion', () => {
    // BMR = 10*70 + 6.25*175 - 5*30 - 78 = 700 + 1093.75 - 150 - 78 = 1565.75
    // TDEE = 1565.75 * 1.2 = 1878.9 -> rounds to nearest 10 -> 1880
    const result = suggestCalorieGoal({ weightKg: 70, heightCm: 175, age: 30, activityLevel: 'sedentary' })
    expect(result).toBe(1880)
  })

  it('scales up with higher activity level', () => {
    const sedentary = suggestCalorieGoal({ weightKg: 70, heightCm: 175, age: 30, activityLevel: 'sedentary' })
    const active = suggestCalorieGoal({ weightKg: 70, heightCm: 175, age: 30, activityLevel: 'active' })
    expect(active).toBeGreaterThan(sedentary)
  })

  it('rounds to the nearest 10 calories', () => {
    const result = suggestCalorieGoal({ weightKg: 62, heightCm: 160, age: 25, activityLevel: 'light' })
    expect(result % 10).toBe(0)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test`
Expected: FAIL — `src/lib/calorieGoal.ts` does not exist yet.

- [ ] **Step 3: Write `src/lib/calorieGoal.ts`**

```ts
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

export interface CalorieGoalInputs {
  weightKg: number
  heightCm: number
  age: number
  activityLevel: ActivityLevel
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

/**
 * Suggests a daily calorie goal using the Mifflin-St Jeor BMR formula.
 * Mifflin-St Jeor requires a biological-sex constant (+5 for men, -161 for
 * women); since this app doesn't collect that field, we use the midpoint
 * (-78) as a sex-neutral approximation. The result is always presented as
 * an editable suggestion, never a fixed requirement.
 */
export function suggestCalorieGoal(inputs: CalorieGoalInputs): number {
  const { weightKg, heightCm, age, activityLevel } = inputs
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 78
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel]
  return Math.round(tdee / 10) * 10
}
```

- [ ] **Step 4: Run the tests again to confirm they pass**

Run: `npm test`
Expected: 3/3 PASS (plus the earlier `username` and `smoke` tests still passing — 8/8 total).

- [ ] **Step 5: Write `src/screens/onboarding/CalorieGoal.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { suggestCalorieGoal, type ActivityLevel } from '../../lib/calorieGoal'
import { useOnboardingStore } from '../../store/onboardingStore'

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
  const [mode, setMode] = useState<'manual' | 'auto'>('manual')
  const [goal, setGoal] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [age, setAge] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate')
  const [error, setError] = useState<string | null>(null)

  function handleAutoSuggest() {
    const weight = Number(weightKg)
    const height = Number(heightCm)
    const ageNum = Number(age)

    if (!weight || !height || !ageNum) {
      setError('Fill in weight, height, and age to get a suggestion.')
      return
    }

    setError(null)
    const suggested = suggestCalorieGoal({ weightKg: weight, heightCm: height, age: ageNum, activityLevel })
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
    <div className="flex min-h-screen flex-col justify-center px-6">
      <h1 className="mb-2 text-2xl font-bold text-neutral-900">Daily calorie goal</h1>
      <div className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`flex-1 rounded-xl py-2 text-sm font-medium ${mode === 'manual' ? 'bg-orange-500 text-white' : 'bg-neutral-100 text-neutral-500'}`}
        >
          I know my goal
        </button>
        <button
          type="button"
          onClick={() => setMode('auto')}
          className={`flex-1 rounded-xl py-2 text-sm font-medium ${mode === 'auto' ? 'bg-orange-500 text-white' : 'bg-neutral-100 text-neutral-500'}`}
        >
          Suggest for me
        </button>
      </div>

      {mode === 'auto' && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-neutral-50 p-4">
          <input
            placeholder="Weight (kg)"
            inputMode="decimal"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-base"
          />
          <input
            placeholder="Height (cm)"
            inputMode="decimal"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-base"
          />
          <input
            placeholder="Age"
            inputMode="numeric"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-base"
          />
          <select
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-base"
          >
            {ACTIVITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAutoSuggest}
            className="rounded-xl bg-neutral-900 py-2 text-sm font-semibold text-white"
          >
            Calculate suggestion
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          placeholder="Daily calories"
          inputMode="numeric"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className="rounded-2xl border border-neutral-200 px-4 py-3 text-center text-2xl font-bold"
        />
        <p className="text-center text-xs text-neutral-400">Editable anytime in Settings</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="rounded-2xl bg-orange-500 py-3 text-base font-semibold text-white">
          Next
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 6: Update `src/App.tsx`**

Add the import `import CalorieGoal from './screens/onboarding/CalorieGoal'`. Replace the `/onboarding/goal` route with:

```tsx
<Route
  path="/onboarding/goal"
  element={
    <ProtectedRoute>
      <RequireNotOnboarded>
        <CalorieGoal />
      </RequireNotOnboarded>
    </ProtectedRoute>
  }
/>
<Route
  path="/onboarding/privacy"
  element={
    <ProtectedRoute>
      <RequireNotOnboarded>
        <div className="p-6 text-center text-neutral-400">Privacy — coming in the next task</div>
      </RequireNotOnboarded>
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 7: Manually verify**

Run: `npm run dev`. Continue from Task 5's test user. On the Calorie Goal screen, try "Suggest for me" with weight 70, height 175, age 30, sedentary — expect the goal field to fill with `1880`. Switch to manual entry, type an out-of-range value like `100` — expect an inline error. Enter `2200` and submit — expect navigation to the "Privacy — coming in the next task" placeholder.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add onboarding calorie goal screen with auto-suggest"
```

---

### Task 7: Onboarding — Privacy Default, Add Friends, and Finish

**Files:**
- Create: `src/screens/onboarding/PrivacyDefault.tsx`
- Create: `src/lib/completeOnboarding.ts`
- Create: `src/screens/onboarding/AddFirstFriends.tsx`
- Modify: `src/App.tsx` (swap the `/onboarding/privacy` placeholder; add real `/onboarding/friends` route; add a temporary `/home/feed` stub target)

**Interfaces:**
- Consumes: `useOnboardingStore()` (Task 5), `useSession()` (Task 4), `supabase` (Task 3).
- Produces: `completeOnboarding(input: CompleteOnboardingInput): Promise<void>` from `src/lib/completeOnboarding.ts` — the one place a `users` row gets created; this is the function Phase 2+ work should call if it ever needs to finalize a profile programmatically (e.g. tests).

- [ ] **Step 1: Write `src/screens/onboarding/PrivacyDefault.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore, type PrivacyDefault as PrivacyDefaultValue } from '../../store/onboardingStore'

export default function PrivacyDefault() {
  const navigate = useNavigate()
  const setPrivacyDefault = useOnboardingStore((s) => s.setPrivacyDefault)

  function choose(value: PrivacyDefaultValue) {
    setPrivacyDefault(value)
    navigate('/onboarding/friends')
  }

  return (
    <div className="flex min-h-screen flex-col justify-center gap-4 px-6">
      <h1 className="mb-2 text-2xl font-bold text-neutral-900">Who sees your logs?</h1>
      <p className="mb-6 text-sm text-neutral-500">
        You can change this anytime, and override it for any single log.
      </p>
      <button onClick={() => choose('public')} className="rounded-2xl border border-neutral-200 p-4 text-left">
        <p className="font-semibold text-neutral-900">Public by default</p>
        <p className="text-sm text-neutral-500">Friends see your meals and streak.</p>
      </button>
      <button onClick={() => choose('private')} className="rounded-2xl border border-neutral-200 p-4 text-left">
        <p className="font-semibold text-neutral-900">Private by default</p>
        <p className="text-sm text-neutral-500">Only you see your meals and streak.</p>
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Write `src/lib/completeOnboarding.ts`**

```ts
import { supabase } from './supabase'

export interface CompleteOnboardingInput {
  userId: string
  name: string
  username: string
  avatarFile: File | null
  calorieGoal: number
  privacyDefault: 'public' | 'private'
  friendUsernamesToRequest: string[]
}

async function uploadAvatar(userId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/avatar.${extension}`

  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
  if (error) throw error

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

/**
 * The single place a `users` row is created. Nothing is written to the
 * `users` table before this runs, so an abandoned onboarding leaves no
 * partial profile behind — the user just starts over at Profile Setup
 * next time they sign in.
 */
export async function completeOnboarding(input: CompleteOnboardingInput): Promise<void> {
  const photoUrl = input.avatarFile ? await uploadAvatar(input.userId, input.avatarFile) : null

  const { error: insertError } = await supabase.from('users').insert({
    id: input.userId,
    username: input.username,
    name: input.name,
    photo_url: photoUrl,
    calorie_goal: input.calorieGoal,
    privacy_default: input.privacyDefault,
  })

  if (insertError) throw insertError

  if (input.friendUsernamesToRequest.length === 0) return

  const { data: friendRows, error: lookupError } = await supabase
    .from('users')
    .select('id, username')
    .in('username', input.friendUsernamesToRequest)

  if (lookupError) throw lookupError

  const requests = (friendRows ?? []).map((friend) => ({
    requester_id: input.userId,
    recipient_id: friend.id,
  }))

  if (requests.length > 0) {
    const { error: friendshipError } = await supabase.from('friendships').insert(requests)
    if (friendshipError) throw friendshipError
  }
}
```

- [ ] **Step 3: Write `src/screens/onboarding/AddFirstFriends.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../hooks/useSession'
import { useOnboardingStore } from '../../store/onboardingStore'
import { completeOnboarding } from '../../lib/completeOnboarding'

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
    const term = searchTerm.trim().toLowerCase()
    if (!term) return

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
  }

  async function finish() {
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

  return (
    <div className="flex min-h-screen flex-col px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-neutral-900">Add friends</h1>
      <p className="mb-6 text-sm text-neutral-500">Optional — you can always do this later.</p>

      <div className="mb-4 flex gap-2">
        <input
          placeholder="Search by username"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 rounded-2xl border border-neutral-200 px-4 py-2 text-base"
        />
        <button onClick={handleSearch} className="rounded-2xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">
          Search
        </button>
      </div>

      <button className="mb-4 rounded-2xl bg-neutral-100 py-2 text-sm text-neutral-500" disabled>
        Find from Contacts (coming soon)
      </button>

      <ul className="mb-6 flex flex-col gap-2">
        {results.map((user) => {
          const alreadyAdded = friendUsernamesToRequest.includes(user.username)
          return (
            <li key={user.id} className="flex items-center justify-between rounded-xl border border-neutral-100 p-3">
              <span className="font-medium text-neutral-900">@{user.username}</span>
              <button
                disabled={alreadyAdded}
                onClick={() => addFriendUsername(user.username)}
                className="rounded-lg bg-orange-500 px-3 py-1 text-sm font-semibold text-white disabled:opacity-40"
              >
                {alreadyAdded ? 'Added' : 'Add'}
              </button>
            </li>
          )
        })}
      </ul>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <button
        onClick={finish}
        disabled={submitting}
        className="rounded-2xl bg-orange-500 py-3 text-base font-semibold text-white disabled:opacity-50"
      >
        {submitting ? 'Finishing…' : friendUsernamesToRequest.length > 0 ? 'Finish' : 'Skip & Finish'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Update `src/App.tsx`**

Replace the `/onboarding/privacy` route's placeholder element with `<PrivacyDefault />`, add a real `/onboarding/friends` route with `<AddFirstFriends />`, and add a temporary stub for the route `AddFirstFriends` navigates to on success (Task 8 replaces this with the real home shell):

```tsx
import PrivacyDefault from './screens/onboarding/PrivacyDefault'
import AddFirstFriends from './screens/onboarding/AddFirstFriends'
// ...
<Route
  path="/onboarding/privacy"
  element={
    <ProtectedRoute>
      <RequireNotOnboarded>
        <PrivacyDefault />
      </RequireNotOnboarded>
    </ProtectedRoute>
  }
/>
<Route
  path="/onboarding/friends"
  element={
    <ProtectedRoute>
      <RequireNotOnboarded>
        <AddFirstFriends />
      </RequireNotOnboarded>
    </ProtectedRoute>
  }
/>
<Route
  path="/home/feed"
  element={
    <ProtectedRoute>
      <div className="p-6 text-center text-neutral-400">Welcome! Home shell coming in the next task.</div>
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 5: Manually verify end-to-end onboarding with two accounts**

Run: `npm run dev`.
1. Finish onboarding for the Task 6 test user (privacy: public, skip adding friends) — expect landing on "Welcome! Home shell coming in the next task."
2. Sign up a second test user (e.g. `test2@example.com`), complete Profile Setup / Calorie Goal / Privacy, then on Add Friends, search for the first test user's username, tap Add, tap Finish.
3. In the Supabase Dashboard Table Editor, open `friendships` — expect one row with `requester_id` = second user, `recipient_id` = first user, `status = 'pending'`. Open `users` — expect two rows with the right usernames/names/calorie goals.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add privacy default, add-friends, and onboarding finalization"
```

---

### Task 8: Home Shell — Bottom Tab Bar & Profile Screen

**Files:**
- Create: `src/components/RequireOnboarded.tsx`
- Create: `src/components/BottomTabBar.tsx`
- Create: `src/screens/home/HomeShell.tsx`
- Create: `src/screens/feed/FeedPlaceholder.tsx`
- Create: `src/screens/log/LogPlaceholder.tsx`
- Create: `src/screens/rewards/RewardsPlaceholder.tsx`
- Create: `src/screens/profile/ProfileScreen.tsx`
- Modify: `src/App.tsx` (replace the `/home/feed` stub with the full nested home shell)

**Interfaces:**
- Consumes: `useCurrentUser()` (Task 4), `useSession()` (Task 4), `supabase` (Task 3).
- Produces: the final Phase 1 `<App />` route tree — Phase 2 (Friends + Feed) replaces `FeedPlaceholder` with the real Feed screen and adds the Add Friends screen; Phase 3 replaces `LogPlaceholder`; Phase 4 replaces `RewardsPlaceholder`.

- [ ] **Step 1: Write `src/components/RequireOnboarded.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'

/** Guards /home/* routes: sends a not-yet-onboarded user back to Profile Setup. */
export function RequireOnboarded({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-400">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/onboarding/profile" replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 2: Write `src/components/BottomTabBar.tsx`**

```tsx
import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/home/feed', label: 'Feed', icon: '📰' },
  { to: '/home/log', label: 'Log', icon: '➕' },
  { to: '/home/rewards', label: 'Streaks', icon: '🔥' },
  { to: '/home/profile', label: 'Profile', icon: '👤' },
]

export function BottomTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[430px] justify-around border-t border-neutral-200 bg-white py-2">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${isActive ? 'text-orange-500' : 'text-neutral-400'}`
          }
        >
          <span className="text-xl">{tab.icon}</span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 3: Write `src/screens/home/HomeShell.tsx`**

```tsx
import { Outlet } from 'react-router-dom'
import { BottomTabBar } from '../../components/BottomTabBar'

export function HomeShell() {
  return (
    <div className="pb-16">
      <Outlet />
      <BottomTabBar />
    </div>
  )
}
```

- [ ] **Step 4: Write the three placeholder screens**

`src/screens/feed/FeedPlaceholder.tsx`:
```tsx
export default function FeedPlaceholder() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 text-center">
      <p className="text-neutral-400">Feed is coming in the next phase.</p>
    </div>
  )
}
```

`src/screens/log/LogPlaceholder.tsx`:
```tsx
export default function LogPlaceholder() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 text-center">
      <p className="text-neutral-400">The log flow is coming in a later phase.</p>
    </div>
  )
}
```

`src/screens/rewards/RewardsPlaceholder.tsx`:
```tsx
export default function RewardsPlaceholder() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 text-center">
      <p className="text-neutral-400">Streaks & rewards are coming in a later phase.</p>
    </div>
  )
}
```

- [ ] **Step 5: Write `src/screens/profile/ProfileScreen.tsx`**

```tsx
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { supabase } from '../../lib/supabase'

export default function ProfileScreen() {
  const { data: user, isLoading } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-neutral-400">Loading…</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex flex-col items-center gap-4 px-6 pt-10">
      {user.photo_url ? (
        <img src={user.photo_url} alt={user.name} className="h-24 w-24 rounded-full object-cover" />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-neutral-100 text-2xl text-neutral-400">
          {user.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="text-center">
        <p className="text-xl font-bold text-neutral-900">{user.name}</p>
        <p className="text-sm text-neutral-400">@{user.username}</p>
      </div>
      <div className="w-full rounded-2xl bg-neutral-50 p-4 text-center">
        <p className="text-3xl font-bold text-neutral-900">{user.calorie_goal ?? '—'}</p>
        <p className="text-xs text-neutral-400">daily calorie goal</p>
      </div>
      <button onClick={() => supabase.auth.signOut()} className="mt-4 text-sm text-red-500">
        Sign out
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Replace `src/App.tsx`** (final Phase 1 version)

```tsx
import { Navigate, Route, Routes } from 'react-router-dom'
import Welcome from './screens/onboarding/Welcome'
import SignIn from './screens/onboarding/SignIn'
import ProfileSetup from './screens/onboarding/ProfileSetup'
import CalorieGoal from './screens/onboarding/CalorieGoal'
import PrivacyDefault from './screens/onboarding/PrivacyDefault'
import AddFirstFriends from './screens/onboarding/AddFirstFriends'
import FeedPlaceholder from './screens/feed/FeedPlaceholder'
import LogPlaceholder from './screens/log/LogPlaceholder'
import RewardsPlaceholder from './screens/rewards/RewardsPlaceholder'
import ProfileScreen from './screens/profile/ProfileScreen'
import { HomeShell } from './screens/home/HomeShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RequireOnboarded } from './components/RequireOnboarded'
import { RequireNotOnboarded } from './components/RequireNotOnboarded'

export default function App() {
  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-white">
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/sign-in" element={<SignIn />} />

        <Route
          path="/onboarding/profile"
          element={
            <ProtectedRoute>
              <RequireNotOnboarded>
                <ProfileSetup />
              </RequireNotOnboarded>
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/goal"
          element={
            <ProtectedRoute>
              <RequireNotOnboarded>
                <CalorieGoal />
              </RequireNotOnboarded>
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/privacy"
          element={
            <ProtectedRoute>
              <RequireNotOnboarded>
                <PrivacyDefault />
              </RequireNotOnboarded>
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/friends"
          element={
            <ProtectedRoute>
              <RequireNotOnboarded>
                <AddFirstFriends />
              </RequireNotOnboarded>
            </ProtectedRoute>
          }
        />

        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <RequireOnboarded>
                <HomeShell />
              </RequireOnboarded>
            </ProtectedRoute>
          }
        >
          <Route path="feed" element={<FeedPlaceholder />} />
          <Route path="log" element={<LogPlaceholder />} />
          <Route path="rewards" element={<RewardsPlaceholder />} />
          <Route path="profile" element={<ProfileScreen />} />
        </Route>

        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    </div>
  )
}
```

- [ ] **Step 7: Manually verify the full Phase 1 flow**

Run: `npm run dev`. Sign in as the fully-onboarded test user from Task 7.
Expected: lands on `/home/feed` with the bottom tab bar visible (Feed, Log, Streaks, Profile). Tap each tab — expect the URL and highlighted tab to update, with the correct placeholder text on Feed/Log/Streaks. Tap Profile — expect your real name, `@username`, avatar (or initial fallback), and calorie goal number to display. Tap "Sign out" — expect redirect to `/sign-in` (not `/welcome`, since `ProtectedRoute` sends a session-less user there).

- [ ] **Step 8: Run the full test suite one more time**

Run: `npm test`
Expected: all tests still pass (smoke + username + calorieGoal, 8/8).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add home shell with bottom tab bar and profile screen"
```

---

## Phase 1 Complete

At this point: a new user can open the app, sign up, complete every onboarding step (profile, calorie goal, privacy default, optional friend requests), and land in a working 4-tab home shell with a real, data-backed Profile screen. Feed, Log, and Streaks/Rewards are intentionally placeholders — those are Phases 2 through 4, each to be written as its own plan once this one is built and reviewed.

**Known gap, deferred on purpose:** the design spec describes Log as a visually distinct, elevated "center action button" (like Instagram's post button), not just a fifth equal-weight tab icon. `BottomTabBar` in this plan renders all four tabs identically. Since the Log tab is only a placeholder until Phase 3 builds the real camera/upload flow, the elevated-button styling is worth doing at the same time as that real flow, not now against a stub — flagging it here so it isn't silently dropped.
