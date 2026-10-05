-- Weight tracking + BMI on the Insights screen.
--
-- users.height_cm / target_weight_kg are saved at sign-up (best-effort, so
-- sign-up still works before this runs) and editable from Insights.
-- weight_logs holds one weigh-in per user per day; only the owner can see it.

alter table users add column if not exists height_cm numeric(5,1);
alter table users add column if not exists target_weight_kg numeric(5,1);

create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  weight_kg numeric(5,1) not null check (weight_kg between 20 and 400),
  logged_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create index if not exists weight_logs_user_day_idx on weight_logs (user_id, logged_on);

alter table weight_logs enable row level security;

drop policy if exists "weight_logs_select_own" on weight_logs;
create policy "weight_logs_select_own" on weight_logs for select to authenticated using (auth.uid() = user_id);

drop policy if exists "weight_logs_insert_own" on weight_logs;
create policy "weight_logs_insert_own" on weight_logs for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "weight_logs_update_own" on weight_logs;
create policy "weight_logs_update_own" on weight_logs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "weight_logs_delete_own" on weight_logs;
create policy "weight_logs_delete_own" on weight_logs for delete to authenticated using (auth.uid() = user_id);
