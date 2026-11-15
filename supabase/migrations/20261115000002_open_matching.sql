-- Open matching: goals are typed freely now, so two people rarely have the very same goal.
-- 1. The map lists everyone (people with shared goals and the same city still come first).
-- 2. A connect request only needs a goal of the sender (it says what the request is about).
-- 3. "Find a buddy" counts any accepted buddy; a co-op stage pairs with the buddy's own co-op stage,
--    whatever goal it belongs to.

create or replace function public.has_buddy_for(p_user uuid, p_interest text) returns boolean
language sql stable as $$
  select exists (
    select 1
    from public.connections c
    where c.status = 'accepted'
      and p_user in (c.from_id, c.to_id)
      and not public.is_blocked(c.from_id, c.to_id)
  )
$$;

create or replace function public.match_users(p_me uuid)
returns table (
  user_id uuid, display_name text, avatar jsonb, state text, city text, age_range text,
  meet_style text, bio text, coins integer, score integer, shared jsonb
) language sql stable as $$
  with me as (
    select state, lower(trim(city)) as city_key, meet_style from public.profiles where id = p_me
  ),
  mine as (
    select interest_slug, difficulty from public.user_interests where user_id = p_me
  ),
  cand as (
    select ui.user_id as uid,
           sum(ui.difficulty + m.difficulty)::int as interest_score,
           jsonb_agg(jsonb_build_object(
             'slug', ui.interest_slug, 'myDifficulty', m.difficulty, 'theirDifficulty', ui.difficulty
           ) order by ui.interest_slug) as shared
      from public.user_interests ui
      join mine m on m.interest_slug = ui.interest_slug
     where ui.user_id <> p_me
     group by ui.user_id
  )
  select p.id, p.display_name, p.avatar, p.state, p.city, p.age_range, p.meet_style, p.bio, p.coins,
         (coalesce(c.interest_score, 0)
           + case when p.state = me.state and lower(trim(p.city)) = me.city_key then 3 else 0 end
           + case when p.meet_style = me.meet_style then 1 else 0 end)::int as score,
         coalesce(c.shared, '[]'::jsonb)
    from public.profiles p
    left join cand c on c.uid = p.id
   cross join me
   where p.id <> p_me
     and not public.is_blocked(p_me, p.id)
     and not exists (
       select 1 from public.connections x
        where least(x.from_id, x.to_id) = least(p_me, p.id)
          and greatest(x.from_id, x.to_id) = greatest(p_me, p.id)
          and x.status = 'declined')
   order by (c.uid is not null) desc, score desc, p.created_at asc
$$;

create or replace function public.request_connection(p_from uuid, p_to uuid, p_interest text)
returns jsonb language plpgsql as $$
declare
  v_plan  text;
  v_limit integer;
  v_used  integer;
  v_row   public.connections%rowtype;
begin
  if p_from = p_to then
    raise exception using message = 'VALIDATION', detail = 'cannot connect to yourself';
  end if;
  -- row lock serializes concurrent requests of the same user (monthly limit stays exact)
  select plan into v_plan from public.profiles where id = p_from for update;
  if not found then
    raise exception using message = 'NOT_ONBOARDED';
  end if;
  if not exists (select 1 from public.profiles where id = p_to) or public.is_blocked(p_from, p_to) then
    raise exception using message = 'NOT_FOUND';
  end if;
  -- the request is about one of the sender's goals; the receiver does not need to have it
  if not exists (select 1 from public.user_interests where user_id = p_from and interest_slug = p_interest) then
    raise exception using message = 'NO_SHARED_INTEREST';
  end if;
  if exists (select 1 from public.connections
              where least(from_id, to_id) = least(p_from, p_to)
                and greatest(from_id, to_id) = greatest(p_from, p_to)) then
    raise exception using message = 'ALREADY_CONNECTED';
  end if;
  v_limit := public.plan_connects_per_month(v_plan);
  if v_limit is not null then
    select count(*) into v_used from public.connections
     where from_id = p_from and created_at >= date_trunc('month', now());
    if v_used >= v_limit then
      raise exception using message = 'PLAN_LIMIT';
    end if;
  end if;
  insert into public.connections (from_id, to_id, interest_slug)
  values (p_from, p_to, p_interest)
  returning * into v_row;
  return to_jsonb(v_row);
exception
  when unique_violation then
    raise exception using message = 'ALREADY_CONNECTED';
end $$;

create or replace function public.complete_stage(
  p_user uuid, p_stage_id uuid, p_photo_path text, p_caption text, p_visibility text, p_partner_id uuid
) returns jsonb language plpgsql as $$
declare
  v_stage       public.roadmap_stages%rowtype;
  v_partner     public.roadmap_stages%rowtype;
  v_plan        text;
  v_visibility  text := coalesce(p_visibility, 'public');
  v_photo       integer := 0;
  v_stage_coins integer := 0;
  v_waiting     boolean := false;
  v_level_done  boolean;
  v_next        uuid;
begin
  if v_visibility not in ('public', 'private') then
    raise exception using message = 'VALIDATION', detail = 'visibility must be public or private';
  end if;

  select * into v_stage from public.roadmap_stages where id = p_stage_id;
  if not found or v_stage.user_id <> p_user then
    raise exception using message = 'NOT_FOUND';
  end if;

  select plan into v_plan from public.profiles where id = p_user;
  if v_stage.difficulty > public.plan_max_difficulty(v_plan) then
    raise exception using message = 'PLAN_LIMIT';
  end if;

  -- cheap early check; re-checked under lock below
  if v_stage.status = 'locked' or v_stage.status = 'done'
     or (v_stage.kind <> 'coop' and v_stage.status <> 'active') then
    raise exception using message = 'STAGE_NOT_ACTIVE';
  end if;

  if v_stage.kind = 'coop' then
    if p_partner_id is null then
      raise exception using message = 'PARTNER_REQUIRED';
    end if;
    -- serialize both partners on their shared connection row (lock order: connection -> stages)
    perform 1 from public.connections
     where least(from_id, to_id) = least(p_user, p_partner_id)
       and greatest(from_id, to_id) = greatest(p_user, p_partner_id)
       and status = 'accepted'
     for update;
    if not found
       or p_partner_id = p_user
       or public.is_blocked(p_user, p_partner_id) then
      raise exception using message = 'PARTNER_INVALID';
    end if;
    select * into v_stage from public.roadmap_stages where id = p_stage_id for update;
    -- waiting_partner is allowed: lets the user re-upload or switch partner
    if v_stage.status not in ('active', 'waiting_partner') then
      raise exception using message = 'STAGE_NOT_ACTIVE';
    end if;
  else
    select * into v_stage from public.roadmap_stages where id = p_stage_id for update;
    if v_stage.status <> 'active' then
      raise exception using message = 'STAGE_NOT_ACTIVE';
    end if;
    if v_stage.kind = 'connect' and not public.has_buddy_for(p_user, v_stage.interest_slug) then
      raise exception using message = 'CONNECT_REQUIRED';
    end if;
  end if;

  if v_stage.requires_photo and p_photo_path is null then
    raise exception using message = 'PHOTO_REQUIRED';
  end if;

  if p_photo_path is not null then
    if not starts_with(p_photo_path, p_user::text || '/' || p_stage_id::text || '/') then
      raise exception using message = 'VALIDATION', detail = 'photoPath does not belong to this stage';
    end if;
    insert into public.stage_reports (stage_id, user_id, photo_path, caption, visibility)
    values (p_stage_id, p_user, p_photo_path, coalesce(p_caption, ''), v_visibility)
    on conflict (stage_id) do update
      set photo_path = excluded.photo_path,
          caption    = excluded.caption,
          visibility = excluded.visibility,
          created_at = now();
    v_photo := public.award_coins(p_user, 2, 'photo', p_stage_id);
  end if;

  if v_stage.kind = 'coop' then
    update public.roadmap_stages
       set status = 'waiting_partner', partner_id = p_partner_id
     where id = p_stage_id;
    select * into v_partner from public.roadmap_stages
     where user_id = p_partner_id
       and kind = 'coop'
       and status = 'waiting_partner'
       and partner_id = p_user
     for update;
    if found then
      v_stage_coins := public.finish_stage(p_stage_id, true);
      perform public.finish_stage(v_partner.id, true);
    else
      v_waiting := true;
    end if;
  else
    v_stage_coins := public.finish_stage(p_stage_id, false);
  end if;

  select not exists (
    select 1 from public.roadmap_stages
     where user_id = p_user and interest_slug = v_stage.interest_slug and status <> 'done'
  ) into v_level_done;

  select id into v_next from public.roadmap_stages
   where user_id = p_user and interest_slug = v_stage.interest_slug and status = 'active'
   order by idx limit 1;

  return jsonb_build_object(
    'stageId',           p_stage_id,
    'status',            (select status from public.roadmap_stages where id = p_stage_id),
    'coinsAwarded',      v_photo + v_stage_coins,
    'coins',             (select coins from public.profiles where id = p_user),
    'waitingForPartner', v_waiting,
    'levelCompleted',    v_level_done,
    'nextStageId',       v_next
  );
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
