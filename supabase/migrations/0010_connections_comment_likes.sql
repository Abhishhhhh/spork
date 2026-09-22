-- Run once, in full, via Supabase Dashboard → SQL Editor → New query.
--
-- Two additions:
--   1. get_connections(username) — lets a profile show its friend count
--      and list. `friendships_select_participants` (0001) deliberately
--      hides rows the caller isn't part of, so a friend's connections are
--      invisible from the client; this security-definer function is the
--      narrow, audited hole: it answers only for yourself or for an
--      accepted friend of yours, and returns nothing otherwise.
--   2. comment_likes — hearts on individual comments, with exactly the
--      same visibility rules as log_comments itself (0004).
--
-- The client degrades gracefully if this file hasn't been run yet:
-- connection counts are hidden and comment hearts don't render.

-- ── 1. Connections ──────────────────────────────────────────────────────

create or replace function public.get_connections(p_username text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
with target as (
  select id from users where username = lower(btrim(p_username))
),
-- Caller may see the list for themselves, or for an accepted friend.
allowed as (
  select t.id
  from target t
  where t.id = auth.uid()
     or exists (
       select 1 from friendships f
       where f.status = 'accepted'
         and ((f.requester_id = auth.uid() and f.recipient_id = t.id)
           or (f.recipient_id = auth.uid() and f.requester_id = t.id))
     )
),
connections as (
  select u.id, u.username, u.name, u.photo_url
  from friendships f
  join allowed a
    on a.id in (f.requester_id, f.recipient_id)
  join users u
    on u.id = case when f.requester_id = a.id then f.recipient_id else f.requester_id end
  where f.status = 'accepted'
)
select jsonb_build_object(
  'count', (select count(*) from connections),
  'users', coalesce(
    (select jsonb_agg(jsonb_build_object(
        'id', id, 'username', username, 'name', name, 'photo_url', photo_url
      ) order by username)
     from connections),
    '[]'::jsonb
  ),
  -- false when the caller isn't allowed to look (unknown user, or not a
  -- friend) — the UI hides the counts rather than showing a bogus 0.
  'visible', exists (select 1 from allowed)
);
$$;

grant execute on function public.get_connections(text) to authenticated;

-- ── 2. Comment likes ────────────────────────────────────────────────────

create table if not exists comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references log_comments(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

alter table comment_likes enable row level security;

-- Visible exactly where the comment itself is visible: the log's owner
-- always, an accepted friend only while the log is public.
create policy "comment_likes_select_where_comment_visible"
  on comment_likes for select
  to authenticated
  using (
    exists (
      select 1 from log_comments c join logs l on l.id = c.log_id
      where c.id = comment_likes.comment_id
        and (
          l.user_id = auth.uid()
          or (
            l.visibility = 'public'
            and exists (
              select 1 from friendships f
              where f.status = 'accepted'
                and ((f.requester_id = auth.uid() and f.recipient_id = l.user_id)
                  or (f.recipient_id = auth.uid() and f.requester_id = l.user_id))
            )
          )
        )
    )
  );

create policy "comment_likes_insert_own_where_comment_visible"
  on comment_likes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from log_comments c join logs l on l.id = c.log_id
      where c.id = comment_likes.comment_id
        and (
          l.user_id = auth.uid()
          or (
            l.visibility = 'public'
            and exists (
              select 1 from friendships f
              where f.status = 'accepted'
                and ((f.requester_id = auth.uid() and f.recipient_id = l.user_id)
                  or (f.recipient_id = auth.uid() and f.requester_id = l.user_id))
            )
          )
        )
    )
  );

-- Same widening as log_likes (0004): the liker, or the post's owner.
create policy "comment_likes_delete_own_or_log_owner"
  on comment_likes for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from log_comments c join logs l on l.id = c.log_id
      where c.id = comment_likes.comment_id and l.user_id = auth.uid()
    )
  );

create index if not exists comment_likes_comment_id_idx on comment_likes (comment_id);
