-- Friend challenges: a group of friends each try to hit a daily goal for
-- 7, 14 or 30 days. Everyone is scored against their *own* goals, and the
-- scoring function only ever returns "hit / missed" per person per day —
-- never meals or numbers — so private meals stay private.
-- Safe to run more than once.

create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('protein', 'on_target', 'log_daily', 'hydration')),
  name text not null check (char_length(name) between 1 and 40),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on < 31)
);

create table if not exists challenge_members (
  challenge_id uuid not null references challenges(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'joined', 'declined')),
  created_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index if not exists challenge_members_user_idx on challenge_members (user_id);

alter table challenges enable row level security;
alter table challenge_members enable row level security;

-- Is the caller part of this challenge (any status)? Security definer so
-- the policies below don't recurse into challenge_members' own RLS.
create or replace function in_challenge(cid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from challenge_members where challenge_id = cid and user_id = auth.uid())
      or exists (select 1 from challenges where id = cid and creator_id = auth.uid());
$$;

-- Challenges: visible to their members; created and deleted by the creator.
drop policy if exists "challenges_select_member" on challenges;
-- creator_id is checked on the row itself so "insert … returning id" works
-- (in_challenge can't see a row that's still being inserted).
create policy "challenges_select_member" on challenges for select to authenticated using (creator_id = auth.uid() or in_challenge(id));
drop policy if exists "challenges_insert_own" on challenges;
create policy "challenges_insert_own" on challenges for insert to authenticated with check (auth.uid() = creator_id);
drop policy if exists "challenges_delete_creator" on challenges;
create policy "challenges_delete_creator" on challenges for delete to authenticated using (auth.uid() = creator_id);

-- Members: visible to everyone in the same challenge.
drop policy if exists "challenge_members_select" on challenge_members;
create policy "challenge_members_select" on challenge_members for select to authenticated using (in_challenge(challenge_id));

-- The creator adds themselves (joined) and invites their accepted friends.
drop policy if exists "challenge_members_insert" on challenge_members;
create policy "challenge_members_insert" on challenge_members for insert to authenticated with check (
  exists (select 1 from challenges c where c.id = challenge_id and c.creator_id = auth.uid())
  and (
    (user_id = auth.uid() and status = 'joined')
    or (status = 'invited' and exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.recipient_id = user_id) or (f.recipient_id = auth.uid() and f.requester_id = user_id))
    ))
  )
);

-- You answer your own invite (join / decline).
drop policy if exists "challenge_members_update_own" on challenge_members;
create policy "challenge_members_update_own" on challenge_members for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id and status in ('joined', 'declined'));

-- You can leave; the creator can remove anyone.
drop policy if exists "challenge_members_delete" on challenge_members;
create policy "challenge_members_delete" on challenge_members for delete to authenticated using (
  auth.uid() = user_id or exists (select 1 from challenges c where c.id = challenge_id and c.creator_id = auth.uid())
);

-- One row per joined member per day so far: did they hit the goal?
-- Days are counted in the caller's timezone. Only booleans leave the database.
create or replace function challenge_board(p_challenge uuid, p_tz text default 'UTC')
returns table (user_id uuid, day date, hit boolean)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
declare
  ch challenges%rowtype;
  tz text := coalesce(nullif(p_tz, ''), 'UTC');
  today date := (now() at time zone coalesce(nullif(p_tz, ''), 'UTC'))::date;
begin
  if not in_challenge(p_challenge) then
    raise exception 'not a member of this challenge';
  end if;
  select * into ch from challenges where id = p_challenge;

  return query
  with members as (
    select m.user_id, u.calorie_goal, u.protein_goal, u.water_goal_ml
    from challenge_members m join users u on u.id = m.user_id
    where m.challenge_id = p_challenge and m.status = 'joined'
  ),
  days as (
    select generate_series(ch.starts_on, least(ch.ends_on, today), interval '1 day')::date as d
  ),
  daily as (
    select l.user_id,
           (l.created_at at time zone tz)::date as d,
           count(*) as meals,
           sum(coalesce(l.calories_final, l.calories_estimate, 0)) as kcal,
           sum(coalesce(l.protein_final_g, l.protein_estimate_g, 0)) as protein
    from logs l
    where l.user_id in (select members.user_id from members)
      and (l.created_at at time zone tz)::date between ch.starts_on and least(ch.ends_on, today)
    group by 1, 2
  )
  select m.user_id, days.d,
    case ch.type
      when 'log_daily' then coalesce(dl.meals, 0) >= 2
      when 'protein' then coalesce(dl.protein, 0) >= 0.9 * coalesce(m.protein_goal, coalesce(m.calorie_goal, 2000) * 0.25 / 4)
      when 'on_target' then coalesce(dl.kcal, 0) > 0 and abs(dl.kcal - coalesce(m.calorie_goal, 2000)) <= 0.1 * coalesce(m.calorie_goal, 2000)
      when 'hydration' then coalesce(w.ml, 0) >= coalesce(m.water_goal_ml, 2500)
    end as hit
  from members m
  cross join days
  left join daily dl on dl.user_id = m.user_id and dl.d = days.d
  left join water_logs w on w.user_id = m.user_id and w.logged_on = days.d;
end;
$$;

revoke all on function in_challenge(uuid) from public;
grant execute on function in_challenge(uuid) to authenticated;
revoke all on function challenge_board(uuid, text) from public;
grant execute on function challenge_board(uuid, text) to authenticated;
