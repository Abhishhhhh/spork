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
-- It also pins the parent to the same log, so a reply can never
-- reference a top-level comment on a different log.
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
          and parent.log_id = log_comments.log_id
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
    and (
      type = 'like'
      or exists (
        select 1 from log_comments c
        where c.id = notifications.comment_id
          and c.log_id = notifications.log_id
          and c.user_id = auth.uid()
      )
    )
  );

create policy "notifications_update_own"
  on notifications for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- Caps a recipient to one outstanding "like" notification per (actor, log)
-- pair — re-liking after unliking re-inserts into the same slot rather than
-- piling up an undismissable duplicate (there's no DELETE policy on this
-- table). useToggleLike tolerates the resulting unique-violation (23505).
create unique index notifications_unique_like_per_actor_log
  on notifications (recipient_id, actor_id, log_id)
  where type = 'like';

-- Prototype-scale traffic doesn't need these yet, but they're free while
-- this file is still unexecuted.
create index log_comments_log_id_idx on log_comments (log_id);
create index log_comments_parent_comment_id_idx on log_comments (parent_comment_id);
create index notifications_recipient_id_idx on notifications (recipient_id);
