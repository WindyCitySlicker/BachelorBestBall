-- Allow an authorized foursome access code to transfer the active scorekeeper lock.
-- This changes only the lock row; tournament scores, player names, and handicaps are untouched.
create or replace function public.takeover_scorekeeper(
  p_group_id integer,
  p_token text,
  p_pin text
) returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  expected_code text;
  claimed boolean;
begin
  if p_group_id not between 1 and 3
     or p_token is null or length(p_token) < 20 or length(p_token) > 100
     or p_pin is null or length(btrim(p_pin)) = 0 or length(p_pin) > 100 then
    return false;
  end if;

  select upper(btrim(coalesce(
    state->'accessCodes'->>p_group_id::text,
    case p_group_id
      when 1 then 'IRISH1'
      when 2 then 'IRISH2'
      when 3 then 'IRISH3'
    end
  )))
  into expected_code
  from public.tournament_state
  where id = 'irish-course-invitational';

  if expected_code is null or upper(btrim(p_pin)) <> expected_code then
    return false;
  end if;

  insert into public.scorekeeper_locks(group_id, token, claimed_at, expires_at)
  values (p_group_id, p_token, now(), now() + interval '5 minutes')
  on conflict (group_id) do update
    set token = excluded.token,
        claimed_at = now(),
        expires_at = now() + interval '5 minutes';

  select exists(
    select 1 from public.scorekeeper_locks
    where group_id = p_group_id and token = p_token and expires_at > now()
  ) into claimed;
  return claimed;
end;
$function$;

revoke all on function public.takeover_scorekeeper(integer, text, text) from public;
grant execute on function public.takeover_scorekeeper(integer, text, text) to anon, authenticated;
