-- Water tracking: one row per user per day holding that day's total, plus
-- each user's glass size and daily goal. Private — only the owner can read
-- or change their water rows. Safe to run more than once.

alter table users add column if not exists water_goal_ml int check (water_goal_ml between 500 and 6000);
alter table users add column if not exists water_glass_ml int check (water_glass_ml between 50 and 1000);

create table if not exists water_logs (
  user_id uuid not null references users(id) on delete cascade,
  logged_on date not null default current_date,
  ml int not null default 0 check (ml between 0 and 10000),
  updated_at timestamptz not null default now(),
  primary key (user_id, logged_on)
);

alter table water_logs enable row level security;

drop policy if exists "water_logs_select_own" on water_logs;
create policy "water_logs_select_own" on water_logs for select to authenticated using (auth.uid() = user_id);
drop policy if exists "water_logs_insert_own" on water_logs;
create policy "water_logs_insert_own" on water_logs for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "water_logs_update_own" on water_logs;
create policy "water_logs_update_own" on water_logs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "water_logs_delete_own" on water_logs;
create policy "water_logs_delete_own" on water_logs for delete to authenticated using (auth.uid() = user_id);
