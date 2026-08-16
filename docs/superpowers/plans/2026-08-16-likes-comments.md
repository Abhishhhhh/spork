# Likes & Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add likes and one-level-threaded comments to logs, a new Meal Detail screen to host them, and a Notifications inbox for the resulting activity — reversing the original spec's "no comments/likes" decision.

**Architecture:** Two new join tables (`log_likes`, `log_comments`) with RLS that mirrors `logs`' own visibility rules exactly (owner always, accepted friend only if public), plus a `notifications` table whose insert policy computes the recipient server-side from the referenced log rather than trusting the client. A previously-specced-but-never-built Meal Detail screen becomes the home for the full like/comment experience; Feed and Friend Profile only get lightweight inline counts. No triggers, no RPCs — every write is a plain client insert/delete under RLS, consistent with every other write path in this codebase.

**Tech Stack:** React + Vite + TypeScript + Tailwind CSS v4, Supabase (Postgres/RLS), TanStack Query v5, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-13-spork-design.md` — §4 (Data Model), §5 (Screens), §7 (Key Rules), §10 (Decisions Log, 2026-08-16 Likes & Comments entries), §11 (Out of Scope), §12 (Build Phasing, item 5).

## Global Constraints

- Tailwind v4 via `@theme` tokens in `src/index.css` — use only `bg-background`, `text-primary`, `text-muted`, `border-border`, `text-error` and the existing shape/spacing conventions (`rounded-full` for buttons/inputs, `rounded-2xl` for cards). No new tokens.
- Supabase RLS is the sole privacy enforcement mechanism. `log_likes` and `log_comments` must have the exact same select/insert visibility shape as `logs` itself (owner always; accepted friend only if the log is public) — never filter this client-side.
- Never write an embedded Supabase select (`.select('*, foo(...))')`) — the hand-written `Database` type in `src/lib/database.types.ts` doesn't model `Relationships`. Always two/three plain queries, batch-fetch related rows by id, join client-side via `Map`.
- TanStack Query v5: a *disabled* query reports `isLoading: false`, not `true`. Every new session-gated query must fold `sessionLoading` into `isLoading`, exactly like `src/hooks/useCurrentUser.ts` already does.
- TDD (red→green) for genuinely pure logic only (Task 1's comment-tree grouping). Hooks and screens that call Supabase directly are verified via type-check + manual testing, not unit tests — the established convention in this codebase (spec §9).
- One-level comment threading is enforced in TWO places, not one: the RLS insert policy (a reply's parent must itself have no parent) AND the UI (a reply never renders its own "Reply" button).
- Every notification's `recipient_id` is always the log's owner — never the parent comment's author, even for a reply (spec §10's explicit decision).
- Git commits on anything tied to email `singhrohaan14@gmail.com` must use that identity (already configured locally) — applies to every commit in this plan.

---

### Task 1: Comment-Tree Grouping (pure function)

**Files:**
- Create: `src/lib/commentTree.ts`
- Create: `src/lib/commentTree.test.ts`

**Interfaces:**
- Produces: `CommentRow` interface `{ id: string; user_id: string; parent_comment_id: string | null; body: string; created_at: string }`, and `groupComments<T extends CommentRow>(rows: T[]): (T & { replies: T[] })[]` — generic so it works whether or not the caller has already attached extra fields (like author info) to each row. Used by Task 3's `useMealDetail`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/commentTree.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { groupComments, type CommentRow } from './commentTree'

function comment(id: string, parentId: string | null, createdAt: string): CommentRow {
  return { id, user_id: 'u1', parent_comment_id: parentId, body: `body-${id}`, created_at: createdAt }
}

describe('groupComments', () => {
  it('returns an empty array for no comments', () => {
    expect(groupComments([])).toEqual([])
  })

  it('returns a single top-level comment with no replies', () => {
    const rows = [comment('a', null, '2026-08-16T10:00:00Z')]
    expect(groupComments(rows)).toEqual([{ ...rows[0], replies: [] }])
  })

  it('attaches replies to their parent, sorted oldest-first', () => {
    const rows = [
      comment('a', null, '2026-08-16T10:00:00Z'),
      comment('reply2', 'a', '2026-08-16T10:05:00Z'),
      comment('reply1', 'a', '2026-08-16T10:02:00Z'),
    ]
    const result = groupComments(rows)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
    expect(result[0].replies.map((r) => r.id)).toEqual(['reply1', 'reply2'])
  })

  it('sorts top-level comments oldest-first and keeps each groups replies separate', () => {
    const rows = [
      comment('b', null, '2026-08-16T11:00:00Z'),
      comment('a', null, '2026-08-16T10:00:00Z'),
      comment('reply-to-a', 'a', '2026-08-16T10:30:00Z'),
      comment('reply-to-b', 'b', '2026-08-16T11:30:00Z'),
    ]
    const result = groupComments(rows)
    expect(result.map((c) => c.id)).toEqual(['a', 'b'])
    expect(result[0].replies.map((r) => r.id)).toEqual(['reply-to-a'])
    expect(result[1].replies.map((r) => r.id)).toEqual(['reply-to-b'])
  })

  it('silently drops a reply whose parent is not in the row set', () => {
    const rows = [comment('orphan-reply', 'missing-parent', '2026-08-16T10:00:00Z')]
    expect(groupComments(rows)).toEqual([])
  })

  it('preserves extra fields the caller attached to each row', () => {
    const withAuthor = [{ ...comment('a', null, '2026-08-16T10:00:00Z'), author: { name: 'Maya' } }]
    const result = groupComments(withAuthor)
    expect(result[0].author).toEqual({ name: 'Maya' })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find module `./commentTree`.

- [ ] **Step 3: Implement `groupComments`**

Create `src/lib/commentTree.ts`:

```ts
export interface CommentRow {
  id: string
  user_id: string
  parent_comment_id: string | null
  body: string
  created_at: string
}

/**
 * Turns a flat list of comment rows into a two-level tree: top-level
 * comments, each carrying its own replies sorted oldest-first. Generic
 * over T so a caller can attach extra fields (e.g. author info) before
 * grouping and get them back untouched on both the top-level comment and
 * its replies. A reply whose parent isn't present in `rows` at all (e.g.
 * a data inconsistency) is silently dropped rather than surfaced as its
 * own top-level item — nothing in this app should ever produce one, since
 * the RLS insert policy requires a real, non-reply parent to exist
 * (spec §4), but the function itself doesn't assume that invariant holds.
 */
export function groupComments<T extends CommentRow>(rows: T[]): (T & { replies: T[] })[] {
  const topLevel = rows.filter((r) => r.parent_comment_id === null)

  const repliesByParent = new Map<string, T[]>()
  for (const row of rows) {
    if (row.parent_comment_id === null) continue
    const list = repliesByParent.get(row.parent_comment_id) ?? []
    list.push(row)
    repliesByParent.set(row.parent_comment_id, list)
  }

  return topLevel
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((top) => ({
      ...top,
      replies: (repliesByParent.get(top.id) ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all 6 `groupComments` tests green, plus every pre-existing test still green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/commentTree.ts src/lib/commentTree.test.ts
git commit -m "feat: add groupComments pure function for one-level comment threading"
```

---

### Task 2: `log_likes`, `log_comments`, `notifications` Tables & RLS

**Before you start:** this task is pure SQL run against the live Supabase project's Dashboard SQL Editor — no coding subagent can execute it (same exception as Phase 3's Task 1 and Phase 4's Task 2). The controller runs this task directly.

**Files:**
- Create: `supabase/migrations/0004_likes_comments.sql`

**Interfaces:**
- Produces: three tables and their RLS policies that Task 3's and Task 4's hooks depend on existing.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0004_likes_comments.sql`:

```sql
-- Likes & Comments. Run this once, in full, via the Supabase Dashboard
-- SQL Editor (Project → SQL Editor → New query → paste this file → Run)
-- — same process as every prior migration in this project.

create table log_likes (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references logs(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (log_id, user_id)
);

alter table log_likes enable row level security;

-- Same select/insert visibility as logs itself (see 0001_init.sql's
-- logs_select_own_or_public_friend) — owner always, an accepted friend
-- only if the log is public. Delete: the liker themselves, or the log's
-- owner (spec §10 — a deliberate widening from this project's usual
-- "only your own rows" pattern, giving the log owner basic moderation).
create policy "log_likes_select_own_or_public_friend"
  on log_likes for select
  to authenticated
  using (
    exists (
      select 1 from logs l
      where l.id = log_likes.log_id
        and (
          l.user_id = auth.uid()
          or (
            l.visibility = 'public'
            and exists (
              select 1 from friendships f
              where f.status = 'accepted'
                and (
                  (f.requester_id = auth.uid() and f.recipient_id = l.user_id)
                  or (f.recipient_id = auth.uid() and f.requester_id = l.user_id)
                )
            )
          )
        )
    )
  );

create policy "log_likes_insert_own_if_log_visible"
  on log_likes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from logs l
      where l.id = log_likes.log_id
        and (
          l.user_id = auth.uid()
          or (
            l.visibility = 'public'
            and exists (
              select 1 from friendships f
              where f.status = 'accepted'
                and (
                  (f.requester_id = auth.uid() and f.recipient_id = l.user_id)
                  or (f.recipient_id = auth.uid() and f.requester_id = l.user_id)
                )
            )
          )
        )
    )
  );

create policy "log_likes_delete_own_or_log_owner"
  on log_likes for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from logs l where l.id = log_likes.log_id and l.user_id = auth.uid())
  );

create table log_comments (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references logs(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  parent_comment_id uuid references log_comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table log_comments enable row level security;

create policy "log_comments_select_own_or_public_friend"
  on log_comments for select
  to authenticated
  using (
    exists (
      select 1 from logs l
      where l.id = log_comments.log_id
        and (
          l.user_id = auth.uid()
          or (
            l.visibility = 'public'
            and exists (
              select 1 from friendships f
              where f.status = 'accepted'
                and (
                  (f.requester_id = auth.uid() and f.recipient_id = l.user_id)
                  or (f.recipient_id = auth.uid() and f.requester_id = l.user_id)
                )
            )
          )
        )
    )
  );

-- The final AND clause is what caps threading at one level (spec §10):
-- if parent_comment_id is set, the referenced parent's OWN
-- parent_comment_id must be null — a reply can never itself be replied to.
create policy "log_comments_insert_own_if_log_visible"
  on log_comments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from logs l
      where l.id = log_comments.log_id
        and (
          l.user_id = auth.uid()
          or (
            l.visibility = 'public'
            and exists (
              select 1 from friendships f
              where f.status = 'accepted'
                and (
                  (f.requester_id = auth.uid() and f.recipient_id = l.user_id)
                  or (f.recipient_id = auth.uid() and f.requester_id = l.user_id)
                )
            )
          )
        )
    )
    and (
      parent_comment_id is null
      or exists (
        select 1 from log_comments parent
        where parent.id = log_comments.parent_comment_id
          and parent.parent_comment_id is null
      )
    )
  );

create policy "log_comments_delete_own_or_log_owner"
  on log_comments for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from logs l where l.id = log_comments.log_id and l.user_id = auth.uid())
  );

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references users(id) on delete cascade,
  actor_id uuid not null references users(id) on delete cascade,
  log_id uuid not null references logs(id) on delete cascade,
  type text not null check (type in ('like', 'comment', 'reply')),
  comment_id uuid references log_comments(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "notifications_select_own"
  on notifications for select
  to authenticated
  using (recipient_id = auth.uid());

-- The insert policy computes recipient_id itself from the referenced
-- log, rather than trusting whatever the client sent — this is what
-- stops a client from spoofing a notification to a user who didn't
-- actually own the post. actor_id <> recipient_id suppresses a
-- self-notification when liking/commenting your own post.
create policy "notifications_insert_by_actor_for_log_owner"
  on notifications for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and actor_id <> recipient_id
    and recipient_id = (select user_id from logs where id = notifications.log_id)
  );

create policy "notifications_update_own"
  on notifications for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
```

- [ ] **Step 2: Run it against the live Supabase project**

Open the Supabase Dashboard → SQL Editor → New query, paste the file's contents, Run. Expect no errors — three new tables, each with RLS enabled and its policies attached.

- [ ] **Step 3: Verify the tables and policies exist**

In the Dashboard: Database → Tables → confirm `log_likes`, `log_comments`, `notifications` are all listed. Database → Policies → confirm each table shows its policies (3 for `log_likes`, 3 for `log_comments`, 3 for `notifications`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0004_likes_comments.sql
git commit -m "feat: add log_likes, log_comments, notifications tables and RLS"
```

---

### Task 3: Meal Detail Data Hooks

**Files:**
- Create: `src/hooks/useMealDetail.ts`

**Interfaces:**
- Consumes: `groupComments`, `CommentRow` from `src/lib/commentTree.ts` (Task 1).
- Produces: `useMealDetail(logId: string | undefined)` returning `{ data: MealDetailData | null, isLoading, isError, ... }` where `MealDetailData = { log: LogRow, author: Pick<UserRow,'id'|'name'|'username'|'photo_url'>, photoSignedUrl: string | null, likeCount: number, likedByViewer: boolean, comments: CommentWithReplies[] }` and `CommentWithReplies = CommentRow & { author: Pick<UserRow,'id'|'name'|'username'|'photo_url'>, replies: (CommentRow & { author: ... })[] }`. Also `useToggleLike()`, `useAddComment()`, `useDeleteComment()` mutations. All consumed by Task 5's Meal Detail screen and Task 7's inline Feed/Friend Profile like buttons.

**Note:** this task's hook file calls `supabase.from('log_likes')`, `.from('log_comments')`, and `.from('notifications')` — all three must exist in `database.types.ts`'s `Database` interface before this file can type-check, so Step 1 below adds all three table types first, even though `notifications`' own hook doesn't arrive until Task 4 (which will consume the type added here, not redeclare it).

- [ ] **Step 1: Add `log_likes`, `log_comments`, and `notifications` to `database.types.ts`**

Add to `src/lib/database.types.ts`, inside `Tables`, after `redemptions`:

```ts
      log_likes: {
        Row: {
          id: string
          log_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          log_id: string
          user_id: string
        }
        Update: never
        Relationships: []
      }
      log_comments: {
        Row: {
          id: string
          log_id: string
          user_id: string
          parent_comment_id: string | null
          body: string
          created_at: string
        }
        Insert: {
          log_id: string
          user_id: string
          parent_comment_id?: string | null
          body: string
        }
        Update: never
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          recipient_id: string
          actor_id: string
          log_id: string
          type: 'like' | 'comment' | 'reply'
          comment_id: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          recipient_id: string
          actor_id: string
          log_id: string
          type: 'like' | 'comment' | 'reply'
          comment_id?: string | null
        }
        Update: {
          read_at?: string | null
        }
        Relationships: []
      }
```

- [ ] **Step 2: Write the hook file**

Create `src/hooks/useMealDetail.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'
import { groupComments, type CommentRow } from '../lib/commentTree'
import type { Database } from '../lib/database.types'

type LogRow = Database['public']['Tables']['logs']['Row']
type UserRow = Database['public']['Tables']['users']['Row']
type CommentAuthor = Pick<UserRow, 'id' | 'name' | 'username' | 'photo_url'>

export interface CommentWithAuthor extends CommentRow {
  author: CommentAuthor
}

export interface CommentThread extends CommentWithAuthor {
  replies: CommentWithAuthor[]
}

export interface MealDetailData {
  log: LogRow
  author: Pick<UserRow, 'id' | 'name' | 'username' | 'photo_url'>
  photoSignedUrl: string | null
  likeCount: number
  likedByViewer: boolean
  comments: CommentThread[]
}

/**
 * Four plain queries (log, author, likes, comments+their authors), no
 * embedded selects — same reasoning as every other hook in this
 * codebase. `log_likes`/`log_comments` RLS already restricts what a
 * plain select can return to what the viewer is allowed to see, so the
 * like count and comment list can never over-fetch a hidden log's data.
 */
export function useMealDetail(logId: string | undefined) {
  const { session, loading: sessionLoading } = useSession()
  const viewerId = session?.user.id

  const query = useQuery({
    queryKey: ['mealDetail', viewerId, logId],
    queryFn: async (): Promise<MealDetailData | null> => {
      const { data: log, error: logError } = await supabase.from('logs').select('*').eq('id', logId!).maybeSingle()
      if (logError) throw logError
      if (!log) return null

      const { data: author, error: authorError } = await supabase
        .from('users')
        .select('id, name, username, photo_url')
        .eq('id', log.user_id)
        .single()
      if (authorError) throw authorError

      let photoSignedUrl: string | null = null
      if (log.photo_url) {
        const { data: signedUrls } = await supabase.storage.from('meal-photos').createSignedUrls([log.photo_url], 3600)
        photoSignedUrl = signedUrls?.[0]?.signedUrl ?? null
      }

      const { data: likes, error: likesError } = await supabase
        .from('log_likes')
        .select('user_id')
        .eq('log_id', logId!)
      if (likesError) throw likesError
      const likeRows = likes ?? []
      const likeCount = likeRows.length
      const likedByViewer = likeRows.some((l) => l.user_id === viewerId)

      const { data: commentRows, error: commentsError } = await supabase
        .from('log_comments')
        .select('*')
        .eq('log_id', logId!)
        .order('created_at', { ascending: true })
      if (commentsError) throw commentsError

      const rows = commentRows ?? []
      const commenterIds = [...new Set(rows.map((c) => c.user_id))]
      const { data: commenters, error: commentersError } =
        commenterIds.length > 0
          ? await supabase.from('users').select('id, name, username, photo_url').in('id', commenterIds)
          : { data: [] as CommentAuthor[], error: null }
      if (commentersError) throw commentersError

      const commentersById = new Map((commenters ?? []).map((u) => [u.id, u]))
      const rowsWithAuthor = rows
        .map((row) => {
          const commentAuthor = commentersById.get(row.user_id)
          return commentAuthor ? { ...row, author: commentAuthor } : null
        })
        .filter((r): r is CommentWithAuthor => r !== null)

      const comments = groupComments(rowsWithAuthor)

      return { log, author, photoSignedUrl, likeCount, likedByViewer, comments }
    },
    enabled: Boolean(logId) && Boolean(viewerId),
  })

  return {
    ...query,
    isLoading: sessionLoading || (Boolean(viewerId) && query.isLoading),
  }
}

/**
 * Toggles a like: deletes the row if already liked, otherwise inserts it
 * plus a notification row (skipped when liking your own post). Callers
 * pass `currentlyLiked` explicitly rather than this hook re-deriving it,
 * so a screen using optimistic local state (Task 5) controls exactly
 * which direction the toggle goes.
 */
export function useToggleLike() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { logId: string; logOwnerId: string; currentlyLiked: boolean }) => {
      if (!session) throw new Error('Not signed in')
      const userId = session.user.id

      if (input.currentlyLiked) {
        const { error } = await supabase.from('log_likes').delete().eq('log_id', input.logId).eq('user_id', userId)
        if (error) throw error
        return
      }

      const { error: likeError } = await supabase.from('log_likes').insert({ log_id: input.logId, user_id: userId })
      if (likeError) throw likeError

      if (input.logOwnerId !== userId) {
        const { error: notifError } = await supabase.from('notifications').insert({
          recipient_id: input.logOwnerId,
          actor_id: userId,
          log_id: input.logId,
          type: 'like',
        })
        if (notifError) throw notifError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealDetail'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['friendProfile'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useAddComment() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      logId: string
      logOwnerId: string
      body: string
      parentCommentId: string | null
    }) => {
      if (!session) throw new Error('Not signed in')
      const userId = session.user.id

      const { error: commentError } = await supabase.from('log_comments').insert({
        log_id: input.logId,
        user_id: userId,
        parent_comment_id: input.parentCommentId,
        body: input.body,
      })
      if (commentError) throw commentError

      if (input.logOwnerId !== userId) {
        const { error: notifError } = await supabase.from('notifications').insert({
          recipient_id: input.logOwnerId,
          actor_id: userId,
          log_id: input.logId,
          type: input.parentCommentId ? 'reply' : 'comment',
        })
        if (notifError) throw notifError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealDetail'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['friendProfile'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useDeleteComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from('log_comments').delete().eq('id', commentId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealDetail'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['friendProfile'] })
    },
  })
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — unchanged from Task 1 (this task adds no new `*.test.ts` files; hooks aren't unit-tested per this project's convention).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMealDetail.ts src/lib/database.types.ts
git commit -m "feat: add useMealDetail query and like/comment mutations

Includes log_likes/log_comments/notifications table types in
database.types.ts, added here since this is the first file that needs
them (Task 4's notifications hook consumes the same types, doesn't
redeclare them)."
```

---

### Task 4: Notifications Hooks

**Files:**
- Create: `src/hooks/useNotifications.ts`

**Interfaces:**
- Produces: `useNotifications()` returning `{ data: NotificationItem[] | undefined, isLoading, isError, unreadCount: number, ... }` where `NotificationItem = { id, type: 'like'|'comment'|'reply', logId, readAt: string|null, createdAt, actor: Pick<UserRow,'id'|'name'|'username'|'photo_url'>, log: Pick<LogRow,'id'|'name'|'meal_type'> }`. Also `useMarkNotificationsRead()` mutation. Consumed by Task 6's Notifications inbox screen and Feed's bell-icon badge.

- [ ] **Step 1: Write the hook file**

Create `src/hooks/useNotifications.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'
import type { Database } from '../lib/database.types'

type UserRow = Database['public']['Tables']['users']['Row']
type LogRow = Database['public']['Tables']['logs']['Row']
type NotificationRow = Database['public']['Tables']['notifications']['Row']

export interface NotificationItem {
  id: string
  type: NotificationRow['type']
  logId: string
  readAt: string | null
  createdAt: string
  actor: Pick<UserRow, 'id' | 'name' | 'username' | 'photo_url'>
  log: Pick<LogRow, 'id' | 'name' | 'meal_type'>
}

/**
 * Three plain queries (notifications, actors, logs), no embedded
 * selects. `notifications_select_own` RLS already restricts this to the
 * caller's own notifications, so no client-side recipient filter is
 * needed on the select. Every notification's recipient is always the
 * referenced log's owner (spec §10), so the caller viewing their own
 * inbox always has permission to read the logs it references — no RLS
 * gap even though this looks up logs a second time here.
 */
export function useNotifications() {
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id

  const query = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async (): Promise<NotificationItem[]> => {
      const { data: rows, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error

      const notifs = rows ?? []
      if (notifs.length === 0) return []

      const actorIds = [...new Set(notifs.map((n) => n.actor_id))]
      const { data: actors, error: actorsError } = await supabase
        .from('users')
        .select('id, name, username, photo_url')
        .in('id', actorIds)
      if (actorsError) throw actorsError
      const actorsById = new Map((actors ?? []).map((a) => [a.id, a]))

      const logIds = [...new Set(notifs.map((n) => n.log_id))]
      const { data: logs, error: logsError } = await supabase
        .from('logs')
        .select('id, name, meal_type')
        .in('id', logIds)
      if (logsError) throw logsError
      const logsById = new Map((logs ?? []).map((l) => [l.id, l]))

      return notifs
        .map((n) => {
          const actor = actorsById.get(n.actor_id)
          const log = logsById.get(n.log_id)
          if (!actor || !log) return null
          return {
            id: n.id,
            type: n.type,
            logId: n.log_id,
            readAt: n.read_at,
            createdAt: n.created_at,
            actor,
            log,
          }
        })
        .filter((n): n is NotificationItem => n !== null)
    },
    enabled: Boolean(userId),
  })

  const unreadCount = (query.data ?? []).filter((n) => n.readAt === null).length

  return {
    ...query,
    isLoading: sessionLoading || (Boolean(userId) && query.isLoading),
    unreadCount,
  }
}

export function useMarkNotificationsRead() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Not signed in')
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_id', session.user.id)
        .is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
```

**Note:** `log_likes`, `log_comments`, and `notifications` table types were already added to `database.types.ts` in Task 3, Step 1 (that task needed them first) — nothing further to add here.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useNotifications.ts
git commit -m "feat: add useNotifications hooks (list, unread count, mark-as-read)"
```

---

### Task 5: Meal Detail Screen

**Files:**
- Create: `src/screens/log/MealDetail.tsx`
- Modify: `src/App.tsx` (add the `/home/log/:logId` route)

**Interfaces:**
- Consumes: `useMealDetail`, `useToggleLike`, `useAddComment`, `useDeleteComment` from `src/hooks/useMealDetail.ts` (Task 3).
- Produces: the route `/home/log/:logId` — used by Task 6 (notification tap-through) and Task 7 (Feed/Friend Profile card tap target).

- [ ] **Step 1: Create the Meal Detail screen**

Create `src/screens/log/MealDetail.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../../hooks/useSession'
import {
  useAddComment,
  useDeleteComment,
  useMealDetail,
  useToggleLike,
  type CommentThread,
  type CommentWithAuthor,
} from '../../hooks/useMealDetail'

export default function MealDetail() {
  const { logId } = useParams<{ logId: string }>()
  const navigate = useNavigate()
  const { session } = useSession()
  const { data, isLoading, isError } = useMealDetail(logId)
  const toggleLike = useToggleLike()
  const addComment = useAddComment()
  const deleteComment = useDeleteComment()

  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null)
  const [commentBody, setCommentBody] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  useEffect(() => {
    setOptimisticLiked(null)
  }, [data?.likedByViewer])

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted">Something went wrong loading this meal.</p>
        <button
          onClick={() => navigate(-1)}
          className="rounded-full bg-primary px-6 py-3 text-base font-semibold text-background"
        >
          Go back
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted">Couldn't find that meal.</p>
        <button
          onClick={() => navigate(-1)}
          className="rounded-full bg-primary px-6 py-3 text-base font-semibold text-background"
        >
          Go back
        </button>
      </div>
    )
  }

  const { log, author, photoSignedUrl, likeCount, likedByViewer, comments } = data
  const viewerId = session?.user.id
  const displayLiked = optimisticLiked ?? likedByViewer
  const likeDelta = optimisticLiked === null ? 0 : optimisticLiked === likedByViewer ? 0 : optimisticLiked ? 1 : -1
  const displayLikeCount = likeCount + likeDelta

  function handleToggleLike() {
    const next = !displayLiked
    setOptimisticLiked(next)
    toggleLike.mutate(
      { logId: log.id, logOwnerId: log.user_id, currentlyLiked: displayLiked },
      { onError: () => setOptimisticLiked(!next) },
    )
  }

  function handleAddComment() {
    const body = commentBody.trim()
    if (!body) return
    addComment.mutate(
      { logId: log.id, logOwnerId: log.user_id, body, parentCommentId: replyingTo },
      {
        onSuccess: () => {
          setCommentBody('')
          setReplyingTo(null)
        },
      },
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col px-6 py-8">
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary"
      >
        ←
      </button>

      {photoSignedUrl && (
        <img src={photoSignedUrl} alt="" className="mb-4 aspect-square w-full rounded-2xl object-cover" />
      )}

      <div className="mb-4 flex items-center gap-2">
        {author.photo_url ? (
          <img src={author.photo_url} alt={author.name} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-border/60 text-xs text-muted">
            {author.name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-sm font-semibold text-primary">@{author.username}</span>
        <span className="ml-auto text-xs text-muted">
          {new Date(log.created_at).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      </div>

      {log.name && <h1 className="mb-2 text-xl font-bold text-primary">{log.name}</h1>}
      <p className="mb-4 text-sm capitalize text-muted">{log.meal_type}</p>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border p-3 text-center">
          <p className="text-xs text-muted">Calories</p>
          <p className="text-lg font-bold text-primary">{log.calories_final ?? '—'}</p>
          <p className="text-xs text-muted">estimate: {log.calories_estimate ?? '—'}</p>
        </div>
        <div className="rounded-2xl border border-border p-3 text-center">
          <p className="text-xs text-muted">Protein / Carbs / Fat</p>
          <p className="text-lg font-bold text-primary">
            {log.protein_final_g ?? '—'}g / {log.carbs_final_g ?? '—'}g / {log.fat_final_g ?? '—'}g
          </p>
        </div>
      </div>

      <button
        onClick={handleToggleLike}
        className="mb-6 flex items-center gap-2 self-start rounded-full border border-border px-4 py-2 text-sm font-semibold text-primary"
      >
        <span>{displayLiked ? '🔥' : '🤍'}</span>
        <span>{displayLikeCount}</span>
      </button>

      <h2 className="mb-3 text-sm font-semibold text-muted">COMMENTS</h2>
      <ul className="mb-4 flex flex-col gap-4">
        {comments.length === 0 && <p className="text-sm text-muted">No comments yet.</p>}
        {comments.map((comment: CommentThread) => (
          <li key={comment.id} className="flex flex-col gap-2">
            <CommentRow
              comment={comment}
              canDelete={viewerId === comment.user_id || viewerId === log.user_id}
              onReply={() => setReplyingTo(comment.id)}
              onDelete={() => deleteComment.mutate(comment.id)}
            />
            {comment.replies.length > 0 && (
              <ul className="ml-8 flex flex-col gap-2 border-l border-border pl-3">
                {comment.replies.map((reply) => (
                  <li key={reply.id}>
                    <CommentRow
                      comment={reply}
                      canDelete={viewerId === reply.user_id || viewerId === log.user_id}
                      onDelete={() => deleteComment.mutate(reply.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {replyingTo && (
        <div className="mb-2 flex items-center justify-between rounded-full bg-border/60 px-4 py-2 text-xs text-muted">
          <span>Replying to a comment</span>
          <button onClick={() => setReplyingTo(null)} className="font-semibold text-primary">
            Cancel
          </button>
        </div>
      )}

      <div className="mt-auto flex gap-2">
        <input
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          placeholder="Add a comment…"
          className="flex-1 rounded-full bg-border/60 px-5 py-3 text-base text-primary placeholder:text-muted"
        />
        <button
          onClick={handleAddComment}
          disabled={!commentBody.trim() || addComment.isPending}
          className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-background disabled:opacity-50"
        >
          Post
        </button>
      </div>
    </div>
  )
}

function CommentRow({
  comment,
  canDelete,
  onReply,
  onDelete,
}: {
  comment: CommentWithAuthor
  canDelete: boolean
  onReply?: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-start gap-2">
      {comment.author.photo_url ? (
        <img src={comment.author.photo_url} alt={comment.author.name} className="h-7 w-7 rounded-full object-cover" />
      ) : (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-border/60 text-xs text-muted">
          {comment.author.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1">
        <p className="text-sm">
          <span className="font-semibold text-primary">@{comment.author.username}</span>{' '}
          <span className="text-primary">{comment.body}</span>
        </p>
        <div className="flex gap-3 text-xs text-muted">
          {onReply && (
            <button onClick={onReply} className="font-semibold">
              Reply
            </button>
          )}
          {canDelete && (
            <button onClick={onDelete} className="font-semibold text-error">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the route**

In `src/App.tsx`, add the import alongside the other screen imports:

```tsx
import MealDetail from './screens/log/MealDetail'
```

And add the route inside the `/home` route's children, after the `friend/:username` route:

```tsx
          <Route path="log/:logId" element={<MealDetail />} />
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — unchanged.

- [ ] **Step 5: Manual verification**

`npm run dev`, sign in, navigate directly to `/home/log/<a real log id from your account>` (copy one from the Supabase Dashboard's `logs` table), confirm the photo/macros/like button/comment box all render. Toggling like should flip instantly (optimistic) even before the network round-trip finishes. Posting a comment and a reply should both appear correctly nested. This is a live-data check only — no automated test for this screen, per this project's convention.

- [ ] **Step 6: Commit**

```bash
git add src/screens/log/MealDetail.tsx src/App.tsx
git commit -m "feat: add Meal Detail screen with likes and threaded comments"
```

---

### Task 6: Notifications Inbox Screen + Feed Bell Icon

**Files:**
- Create: `src/screens/notifications/NotificationsInbox.tsx`
- Modify: `src/App.tsx` (add the `/home/notifications` route)
- Modify: `src/screens/feed/Feed.tsx` (add the bell icon + unread badge)

**Interfaces:**
- Consumes: `useNotifications`, `useMarkNotificationsRead` from `src/hooks/useNotifications.ts` (Task 4); navigates to `/home/log/:logId` (Task 5).

- [ ] **Step 1: Create the Notifications Inbox screen**

Create `src/screens/notifications/NotificationsInbox.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMarkNotificationsRead, useNotifications, type NotificationItem } from '../../hooks/useNotifications'

const TYPE_TEXT: Record<NotificationItem['type'], string> = {
  like: 'liked your',
  comment: 'commented on your',
  reply: 'replied on your',
}

export default function NotificationsInbox() {
  const navigate = useNavigate()
  const { data: notifications, isLoading, isError } = useNotifications()
  const markRead = useMarkNotificationsRead()
  const hasMarkedRead = useRef(false)

  useEffect(() => {
    if (hasMarkedRead.current) return
    hasMarkedRead.current = true
    markRead.mutate()
    // Deliberately runs once per mount only — re-running on every
    // notifications refetch would be wrong (it would re-mark as read
    // forever, which is harmless but pointless network chatter).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-6 text-center">
        <p className="text-muted">Something went wrong loading your notifications.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col px-6 py-8">
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary"
      >
        ←
      </button>

      <h1 className="mb-6 text-2xl font-bold text-primary">Notifications</h1>

      {!notifications || notifications.length === 0 ? (
        <p className="text-sm text-muted">No notifications yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notifications.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => navigate(`/home/log/${n.logId}`)}
                className={`flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left ${
                  n.readAt ? '' : 'bg-border/30'
                }`}
              >
                {n.actor.photo_url ? (
                  <img src={n.actor.photo_url} alt={n.actor.name} className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-border/60 text-sm text-muted">
                    {n.actor.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="text-sm text-primary">
                  <span className="font-semibold">@{n.actor.username}</span> {TYPE_TEXT[n.type]}{' '}
                  {n.log.name ?? n.log.meal_type}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire the route**

In `src/App.tsx`, add the import:

```tsx
import NotificationsInbox from './screens/notifications/NotificationsInbox'
```

And add the route inside `/home`'s children, after the `log/:logId` route:

```tsx
          <Route path="notifications" element={<NotificationsInbox />} />
```

- [ ] **Step 3: Add the bell icon + unread badge to Feed**

Replace the entire contents of `src/screens/feed/Feed.tsx` with:

```tsx
import { useNavigate } from 'react-router-dom'
import { useFeed } from '../../hooks/useFeed'
import { useNotifications } from '../../hooks/useNotifications'
import { getEffectiveStreak } from '../../lib/streak'

export default function Feed() {
  const navigate = useNavigate()
  const { data: items, isLoading, isError } = useFeed()
  const { unreadCount } = useNotifications()

  if (isLoading) {
    return (
      <>
        <FeedHeader unreadCount={unreadCount} onBellClick={() => navigate('/home/notifications')} />
        <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
          <p className="text-muted">Loading…</p>
        </div>
      </>
    )
  }

  if (isError) {
    return (
      <>
        <FeedHeader unreadCount={unreadCount} onBellClick={() => navigate('/home/notifications')} />
        <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-6 text-center">
          <p className="text-muted">Something went wrong loading your feed. Try refreshing.</p>
        </div>
      </>
    )
  }

  if (!items || items.length === 0) {
    return (
      <>
        <FeedHeader unreadCount={unreadCount} onBellClick={() => navigate('/home/notifications')} />
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
      </>
    )
  }

  return (
    <>
      <FeedHeader unreadCount={unreadCount} onBellClick={() => navigate('/home/notifications')} />
      <div className="flex flex-col gap-3 px-4 py-6">
        {items.map(({ log, author, photoSignedUrl }) => {
          const effectiveStreak = getEffectiveStreak(author.streak_count, author.streak_last_log_date, new Date())
          return (
            <button
              key={log.id}
              onClick={() => navigate(`/home/friend/${author.username}`)}
              className="flex flex-col gap-2 rounded-2xl border border-border p-4 text-left"
            >
              {photoSignedUrl && (
                <img src={photoSignedUrl} alt="" className="h-40 w-full rounded-xl object-cover" />
              )}
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
              {log.name && <p className="font-semibold text-primary">{log.name}</p>}
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
    </>
  )
}

function FeedHeader({ unreadCount, onBellClick }: { unreadCount: number; onBellClick: () => void }) {
  return (
    <div className="flex justify-end px-4 pt-4">
      <button onClick={onBellClick} aria-label="Notifications" className="relative text-2xl">
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-semibold text-background">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  )
}
```

This is a full-file replacement — every existing return branch keeps its exact original inner content, each now wrapped in a fragment with `<FeedHeader />` above it. Task 7 will edit this same file again afterward to add the inline like/comment counts and change the card's tap target — that's expected, not a conflict (sequential tasks, same file, different concerns).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/screens/notifications/NotificationsInbox.tsx src/App.tsx src/screens/feed/Feed.tsx
git commit -m "feat: add Notifications inbox screen and Feed bell icon"
```

---

### Task 7: Inline Like/Comment Counts on Feed & Friend Profile

**Files:**
- Modify: `src/hooks/useFeed.ts`
- Modify: `src/hooks/useFriendProfile.ts`
- Modify: `src/screens/feed/Feed.tsx`
- Modify: `src/screens/friends/FriendProfile.tsx`

**Interfaces:**
- Consumes: `useToggleLike` from `src/hooks/useMealDetail.ts` (Task 3); navigates to `/home/log/:logId` (Task 5).
- Produces: `FeedItem` and `FriendProfileLog` both gain `likeCount: number`, `likedByViewer: boolean`, `commentCount: number`.

- [ ] **Step 1: Add like/comment counts to `useFeed`**

In `src/hooks/useFeed.ts`, update the `FeedItem` interface:

```ts
export interface FeedItem {
  log: LogRow
  author: Pick<UserRow, 'id' | 'name' | 'username' | 'photo_url' | 'streak_count' | 'streak_last_log_date'>
  photoSignedUrl: string | null
  likeCount: number
  likedByViewer: boolean
  commentCount: number
}
```

Add the import at the top:

```ts
import { useSession } from './useSession'
```

(already imported — no change needed there; just confirming it's already available for `session?.user.id` below.)

Inside `queryFn`, after the existing `photoPaths`/`signedUrlByPath` block and before the final `return logs.map(...)`, add:

```ts
      const logIds = logs.map((log) => log.id)
      const { data: likeRows } = await supabase.from('log_likes').select('log_id, user_id').in('log_id', logIds)
      const { data: commentRows } = await supabase.from('log_comments').select('log_id').in('log_id', logIds)

      const likesByLog = new Map<string, { count: number; likedByViewer: boolean }>()
      for (const like of likeRows ?? []) {
        const entry = likesByLog.get(like.log_id) ?? { count: 0, likedByViewer: false }
        entry.count += 1
        if (like.user_id === userId) entry.likedByViewer = true
        likesByLog.set(like.log_id, entry)
      }

      const commentCountByLog = new Map<string, number>()
      for (const comment of commentRows ?? []) {
        commentCountByLog.set(comment.log_id, (commentCountByLog.get(comment.log_id) ?? 0) + 1)
      }
```

Then change the final `return logs.map(...)` block's body from:

```ts
          const author = authorsById.get(log.user_id)
          if (!author) return null
          return {
            log,
            author,
            photoSignedUrl: log.photo_url ? (signedUrlByPath.get(log.photo_url) ?? null) : null,
          }
```

to:

```ts
          const author = authorsById.get(log.user_id)
          if (!author) return null
          const likeInfo = likesByLog.get(log.id) ?? { count: 0, likedByViewer: false }
          return {
            log,
            author,
            photoSignedUrl: log.photo_url ? (signedUrlByPath.get(log.photo_url) ?? null) : null,
            likeCount: likeInfo.count,
            likedByViewer: likeInfo.likedByViewer,
            commentCount: commentCountByLog.get(log.id) ?? 0,
          }
```

- [ ] **Step 2: Render like/comment counts + change tap target in Feed.tsx**

In `src/screens/feed/Feed.tsx`, add the imports:

```tsx
import { useState } from 'react'
import { useToggleLike } from '../../hooks/useMealDetail'
```

Inside the component, add the mutation hook and a small piece of local optimistic state keyed by log id:

```tsx
  const toggleLike = useToggleLike()
  const [optimisticLikes, setOptimisticLikes] = useState<Record<string, boolean>>({})
```

In the populated-state `.map`, change the destructuring to include the new fields:

```tsx
      {items.map(({ log, author, photoSignedUrl, likeCount, likedByViewer, commentCount }) => {
```

Change the outer `<button onClick={() => navigate(...)}>` (the whole card) so the like button inside it doesn't also trigger the card's own navigation — wrap the like/comment row in its own non-navigating block. Replace the existing final `<div className="flex items-center justify-between">...</div>` block (the meal-type/calories row) with:

```tsx
            <div className="flex items-center justify-between">
              <span className="text-xs capitalize text-muted">{log.meal_type}</span>
              <span className="text-lg font-bold text-primary">
                {log.calories_final ?? log.calories_estimate ?? '—'} kcal
              </span>
            </div>
            <div className="flex items-center gap-4 pt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const displayLiked = optimisticLikes[log.id] ?? likedByViewer
                  setOptimisticLikes((prev) => ({ ...prev, [log.id]: !displayLiked }))
                  toggleLike.mutate(
                    { logId: log.id, logOwnerId: log.user_id, currentlyLiked: displayLiked },
                    {
                      onError: () =>
                        setOptimisticLikes((prev) => ({ ...prev, [log.id]: displayLiked })),
                    },
                  )
                }}
                className="flex items-center gap-1 text-sm text-muted"
              >
                <span>{(optimisticLikes[log.id] ?? likedByViewer) ? '🔥' : '🤍'}</span>
                <span>
                  {likeCount + (optimisticLikes[log.id] === undefined ? 0 : optimisticLikes[log.id] === likedByViewer ? 0 : optimisticLikes[log.id] ? 1 : -1)}
                </span>
              </button>
              <span className="flex items-center gap-1 text-sm text-muted">
                <span>💬</span>
                <span>{commentCount}</span>
              </span>
            </div>
```

(`e.stopPropagation()` keeps the like tap from also firing the card's own `onClick` navigation.)

Finally, change the card's own `onClick` from navigating to the friend's profile to navigating to Meal Detail:

Find:

```tsx
            onClick={() => navigate(`/home/friend/${author.username}`)}
```

Replace with:

```tsx
            onClick={() => navigate(`/home/log/${log.id}`)}
```

- [ ] **Step 3: Add like/comment counts to `useFriendProfile`**

In `src/hooks/useFriendProfile.ts`, update `FriendProfileLog`:

```ts
export interface FriendProfileLog extends LogRow {
  photoSignedUrl: string | null
  likeCount: number
  likedByViewer: boolean
  commentCount: number
}
```

Inside `queryFn`, after the existing `photoPaths`/`signedUrlByPath` block and before the final `return { user, logs: ... }`, add (mirroring Step 1's shape exactly):

```ts
      const logIds = rows.map((log) => log.id)
      const { data: likeRows } = await supabase.from('log_likes').select('log_id, user_id').in('log_id', logIds)
      const { data: commentRows } = await supabase.from('log_comments').select('log_id').in('log_id', logIds)

      const likesByLog = new Map<string, { count: number; likedByViewer: boolean }>()
      for (const like of likeRows ?? []) {
        const entry = likesByLog.get(like.log_id) ?? { count: 0, likedByViewer: false }
        entry.count += 1
        if (like.user_id === viewerId) entry.likedByViewer = true
        likesByLog.set(like.log_id, entry)
      }

      const commentCountByLog = new Map<string, number>()
      for (const comment of commentRows ?? []) {
        commentCountByLog.set(comment.log_id, (commentCountByLog.get(comment.log_id) ?? 0) + 1)
      }
```

Then change the final return's `logs: rows.map(...)` body from:

```ts
        logs: rows.map((log) => ({
          ...log,
          photoSignedUrl: log.photo_url ? (signedUrlByPath.get(log.photo_url) ?? null) : null,
        })),
```

to:

```ts
        logs: rows.map((log) => {
          const likeInfo = likesByLog.get(log.id) ?? { count: 0, likedByViewer: false }
          return {
            ...log,
            photoSignedUrl: log.photo_url ? (signedUrlByPath.get(log.photo_url) ?? null) : null,
            likeCount: likeInfo.count,
            likedByViewer: likeInfo.likedByViewer,
            commentCount: commentCountByLog.get(log.id) ?? 0,
          }
        }),
```

- [ ] **Step 4: Render counts + make tiles tappable in FriendProfile.tsx**

In `src/screens/friends/FriendProfile.tsx`, add the imports:

```tsx
import { useState } from 'react'
import { useToggleLike } from '../../hooks/useMealDetail'
```

Inside the component, add:

```tsx
  const toggleLike = useToggleLike()
  const [optimisticLikes, setOptimisticLikes] = useState<Record<string, boolean>>({})
```

Change the logs grid `<li>` from a plain static element to a tappable button, and add the like/comment row. Find:

```tsx
          {logs.map((log) => (
            <li key={log.id} className="flex flex-col items-center gap-1 rounded-2xl border border-border p-3">
              {log.photoSignedUrl && (
                <img src={log.photoSignedUrl} alt="" className="h-20 w-full rounded-xl object-cover" />
              )}
              {log.name && <span className="w-full truncate text-xs font-semibold text-primary">{log.name}</span>}
              <span className="text-lg font-bold text-primary">{log.calories_final ?? log.calories_estimate ?? '—'}</span>
              <span className="text-xs capitalize text-muted">{log.meal_type}</span>
            </li>
          ))}
```

Replace with:

```tsx
          {logs.map((log) => {
            const displayLiked = optimisticLikes[log.id] ?? log.likedByViewer
            const displayLikeCount =
              log.likeCount + (optimisticLikes[log.id] === undefined ? 0 : optimisticLikes[log.id] === log.likedByViewer ? 0 : optimisticLikes[log.id] ? 1 : -1)
            return (
              <li key={log.id} className="flex flex-col items-center gap-1 rounded-2xl border border-border p-3">
                <button onClick={() => navigate(`/home/log/${log.id}`)} className="flex w-full flex-col items-center gap-1">
                  {log.photoSignedUrl && (
                    <img src={log.photoSignedUrl} alt="" className="h-20 w-full rounded-xl object-cover" />
                  )}
                  {log.name && <span className="w-full truncate text-xs font-semibold text-primary">{log.name}</span>}
                  <span className="text-lg font-bold text-primary">
                    {log.calories_final ?? log.calories_estimate ?? '—'}
                  </span>
                  <span className="text-xs capitalize text-muted">{log.meal_type}</span>
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setOptimisticLikes((prev) => ({ ...prev, [log.id]: !displayLiked }))
                      toggleLike.mutate(
                        { logId: log.id, logOwnerId: user.id, currentlyLiked: displayLiked },
                        { onError: () => setOptimisticLikes((prev) => ({ ...prev, [log.id]: displayLiked })) },
                      )
                    }}
                    className="flex items-center gap-1 text-xs text-muted"
                  >
                    <span>{displayLiked ? '🔥' : '🤍'}</span>
                    <span>{displayLikeCount}</span>
                  </button>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <span>💬</span>
                    <span>{log.commentCount}</span>
                  </span>
                </div>
              </li>
            )
          })}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS — unchanged.

- [ ] **Step 7: Manual verification**

Using the LAN dev-server session: like a post from one account, sign in as its owner (or another accepted friend) and confirm the like/comment counts update on both Feed and Friend Profile, and confirm tapping a card/tile opens Meal Detail. Confirm a like on a private log from a non-friend is impossible (the RLS insert policy should reject it — this is the same kind of guarantee spec §9 calls out as needing live verification, not just an eyeball check).

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useFeed.ts src/hooks/useFriendProfile.ts src/screens/feed/Feed.tsx src/screens/friends/FriendProfile.tsx
git commit -m "feat: show inline like/comment counts on Feed and Friend Profile"
```
