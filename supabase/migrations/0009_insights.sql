-- Insights: server-side daily aggregation for the analytics screens.
--
-- Returns, for the calling user only, one row per local calendar day that has
-- logs (in the caller's timezone) plus their top protein meals by name, over
-- a window of max(2 × p_days, 56) days so the client can compare against the
-- previous period. All numbers come from coalesce(*_final, *_estimate) — the
-- same rule the rest of the app uses for "what the user actually logged".
--
-- security invoker → RLS on `logs` still applies, and we additionally pin
-- user_id = auth.uid() so a caller can never aggregate a friend's logs.
--
-- The client (src/hooks/useInsights.ts) falls back to aggregating its own
-- `logs` rows if this function is missing, so deploying it is an optimisation,
-- not a requirement — but it turns N log rows over the wire into ≤180 rows.

create or replace function public.get_insights(p_days int default 7, p_tz text default 'UTC')
returns jsonb
language sql
security invoker
stable
set search_path = public
as $$
with params as (
  select
    greatest(least(coalesce(p_days, 7), 90), 1) as days,
    coalesce(nullif(p_tz, ''), 'UTC')           as tz
),
window_start as (
  select (((now() at time zone p.tz)::date) - (greatest(p.days * 2, 56) - 1))::date as start_day, p.tz
  from params p
),
own_logs as (
  select
    l.id,
    l.name,
    l.meal_type,
    (l.created_at at time zone w.tz)                       as local_ts,
    (l.created_at at time zone w.tz)::date                 as local_day,
    coalesce(l.calories_final,  l.calories_estimate,  0)   as kcal,
    coalesce(l.protein_final_g, l.protein_estimate_g, 0)   as protein,
    coalesce(l.carbs_final_g,   l.carbs_estimate_g,   0)   as carbs,
    coalesce(l.fat_final_g,     l.fat_estimate_g,     0)   as fat
  from public.logs l
  cross join window_start w
  where l.user_id = auth.uid()
    and (l.created_at at time zone w.tz)::date >= w.start_day
),
daily as (
  select
    local_day,
    sum(kcal)    as calories,
    sum(protein) as protein,
    sum(carbs)   as carbs,
    sum(fat)     as fat,
    count(*)     as meals,
    jsonb_build_object(
      'breakfast', jsonb_build_object('calories', coalesce(sum(kcal) filter (where meal_type = 'breakfast'), 0), 'protein', coalesce(sum(protein) filter (where meal_type = 'breakfast'), 0), 'count', count(*) filter (where meal_type = 'breakfast')),
      'lunch',     jsonb_build_object('calories', coalesce(sum(kcal) filter (where meal_type = 'lunch'), 0),     'protein', coalesce(sum(protein) filter (where meal_type = 'lunch'), 0),     'count', count(*) filter (where meal_type = 'lunch')),
      'dinner',    jsonb_build_object('calories', coalesce(sum(kcal) filter (where meal_type = 'dinner'), 0),    'protein', coalesce(sum(protein) filter (where meal_type = 'dinner'), 0),    'count', count(*) filter (where meal_type = 'dinner')),
      'snack',     jsonb_build_object('calories', coalesce(sum(kcal) filter (where meal_type = 'snack'), 0),     'protein', coalesce(sum(protein) filter (where meal_type = 'snack'), 0),     'count', count(*) filter (where meal_type = 'snack'))
    ) as by_type,
    coalesce(bool_or(meal_type = 'breakfast' and local_ts::time < time '10:30'), false) as breakfast_before_1030
  from own_logs
  group by local_day
),
top_protein as (
  select
    min(name)                          as name,      -- first-seen casing
    count(*)                           as count,
    round(avg(protein))::int           as avg_protein
  from own_logs
  where name is not null and btrim(name) <> ''
  group by lower(btrim(name))
  having avg(protein) > 0
  order by avg(protein) desc, count(*) desc
  limit 3
)
select jsonb_build_object(
  'daily', coalesce((
    select jsonb_agg(jsonb_build_object(
      'date',                to_char(local_day, 'YYYY-MM-DD'),
      'calories',            calories,
      'protein',             protein,
      'carbs',               carbs,
      'fat',                 fat,
      'meals',               meals,
      'byType',              by_type,
      'breakfastBefore1030', breakfast_before_1030
    ) order by local_day)
    from daily
  ), '[]'::jsonb),
  'top_protein_meals', coalesce((
    select jsonb_agg(jsonb_build_object('name', name, 'count', count, 'avgProtein', avg_protein))
    from top_protein
  ), '[]'::jsonb)
);
$$;

grant execute on function public.get_insights(int, text) to authenticated;
