-- RPC: checks eligibility server-side, generates code, inserts redemption.
-- Returns the redemption code on success; raises an exception if ineligible.
-- Apply via: Supabase Dashboard → SQL Editor → paste → Run

create or replace function redeem_reward(p_reward_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_milestone      int;
  v_user_streak    int;
  v_code           text;
  v_already boolean;
begin
  select milestone_required into v_milestone
    from rewards where id = p_reward_id;
  if not found then raise exception 'reward_not_found'; end if;

  select streak_count into v_user_streak
    from users where id = auth.uid();
  if not found then raise exception 'user_not_found'; end if;

  if v_user_streak < v_milestone then
    raise exception 'streak_too_low: need %, have %', v_milestone, v_user_streak;
  end if;

  select exists(
    select 1 from redemptions
    where user_id = auth.uid() and reward_id = p_reward_id
  ) into v_already;
  if v_already then raise exception 'already_redeemed'; end if;

  v_code := upper(substring(md5(random()::text || p_reward_id::text), 1, 8));

  insert into redemptions (user_id, reward_id, code, status)
  values (auth.uid(), p_reward_id, v_code, 'redeemed');

  return v_code;
end;
$$;
