-- Unsend / unfollow / block.
--
-- 1. Either person can now remove a friendship of any status. 0001 only
--    allowed deleting *pending* rows, so friends could never unfollow.
-- 2. `blocks`: a private list of people you've blocked. Blocking removes any
--    friendship between the two of you (trigger below) and stops either side
--    sending a new request. Since meals are only shown to friends, the
--    blocked person also loses access to your meals. They aren't notified.
-- Safe to run more than once.

drop policy if exists "friendships_delete_participant" on friendships;
create policy "friendships_delete_participant"
  on friendships for delete
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

create table if not exists blocks (
  blocker_id uuid not null references users(id) on delete cascade,
  blocked_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on blocks (blocked_id);

alter table blocks enable row level security;

-- Only the blocker ever sees or changes their own block list.
drop policy if exists "blocks_select_own" on blocks;
create policy "blocks_select_own" on blocks for select to authenticated using (auth.uid() = blocker_id);
drop policy if exists "blocks_insert_own" on blocks;
create policy "blocks_insert_own" on blocks for insert to authenticated with check (auth.uid() = blocker_id);
drop policy if exists "blocks_delete_own" on blocks;
create policy "blocks_delete_own" on blocks for delete to authenticated using (auth.uid() = blocker_id);

-- True if the caller and `other` have blocked each other in either
-- direction. Security definer so the friend-request check can see blocks
-- made by the *other* person; it only ever answers about the caller.
create or replace function is_blocked_with(other uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from blocks
    where (blocker_id = auth.uid() and blocked_id = other) or (blocker_id = other and blocked_id = auth.uid())
  );
$$;

-- No friend requests across a block, in either direction.
drop policy if exists "friendships_insert_as_requester" on friendships;
create policy "friendships_insert_as_requester"
  on friendships for insert
  to authenticated
  with check (auth.uid() = requester_id and not is_blocked_with(recipient_id));

-- Blocking ends any friendship or pending request between the two.
create or replace function blocks_remove_friendship()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from friendships
  where (requester_id = new.blocker_id and recipient_id = new.blocked_id)
     or (requester_id = new.blocked_id and recipient_id = new.blocker_id);
  return new;
end;
$$;

drop trigger if exists blocks_remove_friendship on blocks;
create trigger blocks_remove_friendship after insert on blocks
  for each row execute function blocks_remove_friendship();

-- Everyone the caller should not see in search / suggestions / profiles:
-- people they blocked plus people who blocked them.
create or replace function my_hidden_user_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select blocked_id from blocks where blocker_id = auth.uid()
  union
  select blocker_id from blocks where blocked_id = auth.uid();
$$;

revoke all on function is_blocked_with(uuid) from public;
grant execute on function is_blocked_with(uuid) to authenticated;
revoke all on function my_hidden_user_ids() from public;
grant execute on function my_hidden_user_ids() to authenticated;
