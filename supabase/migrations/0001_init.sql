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
  constraint friendships_no_self_friend check (requester_id <> recipient_id)
);

-- A plain table-level UNIQUE constraint only accepts column names, not
-- expressions — least()/greatest() need an expression index instead.
-- This still guarantees at most one friendship row per pair, regardless
-- of which side is requester vs. recipient.
create unique index friendships_unique_pair
  on friendships (least(requester_id, recipient_id), greatest(requester_id, recipient_id));

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
