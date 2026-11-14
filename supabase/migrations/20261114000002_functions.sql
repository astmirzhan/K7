-- K7 business logic that must be atomic: onboarding, stage completion (co-op, coins, unlocks),
-- connections, blocks, matching and read models.
--
-- Errors: every function raises SQLSTATE P0001 with message = one of the API error codes
-- (NOT_FOUND, FORBIDDEN, VALIDATION, PLAN_LIMIT, STAGE_NOT_ACTIVE, PHOTO_REQUIRED, PARTNER_REQUIRED,
--  PARTNER_INVALID, CONNECT_REQUIRED, NO_SHARED_INTEREST, ALREADY_CONNECTED, ALREADY_ONBOARDED,
--  NOT_ONBOARDED, INVALID_STATE). The API maps the message to an HTTP status.
--
-- Lock order (prevents deadlocks): connections row -> roadmap_stages rows.
-- All functions are SECURITY INVOKER and executable only by service_role.

-- ---------- Plan rules (keep in sync with lib/server/plans.ts; a test checks this) ----------
create or replace function public.plan_max_difficulty(p_plan text) returns smallint
language sql immutable as $$
  select (case p_plan when 'free' then 1 when 'starter' then 3 else 5 end)::smallint
$$;

create or replace function public.plan_connects_per_month(p_plan text) returns integer
language sql immutable as $$
  select case p_plan when 'free' then 3 else null end
$$;

-- ---------- Helpers ----------
create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

-- true if p_user has an accepted, non-blocked connection with someone who also has p_interest
create or replace function public.has_buddy_for(p_user uuid, p_interest text) returns boolean
language sql stable as $$
  select exists (
    select 1
    from public.connections c
    join public.user_interests ui
      on ui.user_id = case when c.from_id = p_user then c.to_id else c.from_id end
     and ui.interest_slug = p_interest
    where c.status = 'accepted'
      and p_user in (c.from_id, c.to_id)
      and not public.is_blocked(c.from_id, c.to_id)
  )
$$;

-- idempotent: returns the amount actually credited (0 if this reward was already paid)
create or replace function public.award_coins(p_user uuid, p_amount integer, p_reason text, p_ref uuid)
returns integer language plpgsql as $$
declare v_rows integer;
begin
  if p_amount = 0 then return 0; end if;
  insert into public.coin_ledger (user_id, amount, reason, ref_id)
  values (p_user, p_amount, p_reason, p_ref)
  on conflict (user_id, reason, ref_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return 0; end if;
  update public.profiles set coins = coins + p_amount where id = p_user;
  return p_amount;
end $$;

-- marks a stage done, pays stage coins (x2 for co-op), unlocks the next stage; returns coins paid
create or replace function public.finish_stage(p_stage_id uuid, p_coop boolean)
returns integer language plpgsql as $$
declare
  v public.roadmap_stages%rowtype;
  v_amt integer := 0;
begin
  update public.roadmap_stages
     set status = 'done', completed_at = now()
   where id = p_stage_id and status <> 'done'
  returning * into v;
  if not found then return 0; end if;
  v_amt := public.award_coins(v.user_id, v.coins, 'stage', v.id);
  if p_coop then
    v_amt := v_amt + public.award_coins(v.user_id, v.coins, 'coop_bonus', v.id);
  end if;
  perform public.activate_next(v.user_id, v.interest_slug, v.idx);
  return v_amt;
end $$;

-- activates stage idx+1; a "connect" stage completes itself if the user already has a buddy
create or replace function public.activate_next(p_user uuid, p_interest text, p_idx smallint)
returns uuid language plpgsql as $$
declare
  v_id   uuid;
  v_kind text;
  v_diff smallint;
  v_plan text;
begin
  update public.roadmap_stages
     set status = 'active'
   where user_id = p_user and interest_slug = p_interest and idx = p_idx + 1 and status = 'locked'
  returning id, kind, difficulty into v_id, v_kind, v_diff;
  if v_id is null then return null; end if;
  if v_kind = 'connect' then
    select plan into v_plan from public.profiles where id = p_user;
    if v_diff <= public.plan_max_difficulty(v_plan) and public.has_buddy_for(p_user, p_interest) then
      perform public.finish_stage(v_id, false);
    end if;
  end if;
  return v_id;
end $$;

-- ---------- Onboarding (profile + 3 interests + 19 stages in one transaction) ----------
-- p_profile:   { displayName, avatar, state, city, ageRange, meetStyle, socialUrl, bio }
-- p_interests: [{ slug, difficulty }] x3, difficulties exactly 1,3,5
-- p_stages:    [{ interestSlug, difficulty, idx, kind, title, description, minutes, steps, requiresPhoto, coins, source }]
create or replace function public.create_onboarding(p_user uuid, p_profile jsonb, p_interests jsonb, p_stages jsonb)
returns void language plpgsql as $$
declare v_constraint text;
begin
  if exists (select 1 from public.profiles where id = p_user) then
    raise exception using message = 'ALREADY_ONBOARDED';
  end if;

  insert into public.profiles (id, display_name, avatar, state, city, age_range, meet_style, social_url, bio)
  values (p_user, p_profile->>'displayName', p_profile->'avatar', p_profile->>'state', p_profile->>'city',
          p_profile->>'ageRange', p_profile->>'meetStyle', p_profile->>'socialUrl', coalesce(p_profile->>'bio', ''));

  insert into public.user_interests (user_id, interest_slug, difficulty)
  select p_user, x->>'slug', (x->>'difficulty')::smallint
  from jsonb_array_elements(p_interests) x;

  if (select array_agg(difficulty order by difficulty) from public.user_interests where user_id = p_user)
     is distinct from array[1,3,5]::smallint[] then
    raise exception using message = 'VALIDATION', detail = 'need exactly 3 interests with difficulties 1, 3, 5';
  end if;

  insert into public.roadmap_stages
    (user_id, interest_slug, difficulty, idx, kind, title, description, minutes, steps, requires_photo, coins, status, source)
  select p_user, s->>'interestSlug', (s->>'difficulty')::smallint, (s->>'idx')::smallint, s->>'kind',
         s->>'title', s->>'description', (s->>'minutes')::smallint, coalesce(s->'steps', '[]'::jsonb),
         coalesce((s->>'requiresPhoto')::boolean, false), (s->>'coins')::smallint,
         case when (s->>'idx')::int = 1 then 'active' else 'locked' end,
         coalesce(s->>'source', 'template')
  from jsonb_array_elements(p_stages) s;

  if (select count(*) from public.roadmap_stages where user_id = p_user) <> 19
     or exists (
       select 1 from public.user_interests ui
       where ui.user_id = p_user
         and (select count(*) from public.roadmap_stages rs
               where rs.user_id = p_user and rs.interest_slug = ui.interest_slug and rs.difficulty = ui.difficulty)
             <> case ui.difficulty when 1 then 3 when 3 then 6 else 10 end
     ) then
    raise exception using message = 'VALIDATION', detail = 'roadmap must have 3 / 6 / 10 stages matching the interests';
  end if;
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'profiles_pkey' then
      raise exception using message = 'ALREADY_ONBOARDED';
    end if;
    raise exception using message = 'VALIDATION', detail = 'duplicate interest or difficulty';
  when check_violation or not_null_violation or foreign_key_violation or invalid_text_representation then
    raise exception using message = 'VALIDATION', detail = sqlerrm;
end $$;

-- ---------- Stage completion ----------
-- Solo: done immediately. Coop: needs partnerId (accepted connection, shares the interest);
-- stage waits for the partner; when both uploaded, both are done and both get coins x2.
-- Returns { stageId, status, coinsAwarded, coins, waitingForPartner, levelCompleted, nextStageId }
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
       or public.is_blocked(p_user, p_partner_id)
       or not exists (select 1 from public.user_interests
                       where user_id = p_partner_id and interest_slug = v_stage.interest_slug) then
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
       and interest_slug = v_stage.interest_slug
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

-- ---------- Connections ----------
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
  if not exists (select 1 from public.user_interests where user_id = p_from and interest_slug = p_interest)
     or not exists (select 1 from public.user_interests where user_id = p_to and interest_slug = p_interest) then
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

-- only the receiver can answer; accepting auto-completes active "connect" stages of both people
create or replace function public.respond_connection(p_user uuid, p_connection_id uuid, p_status text)
returns jsonb language plpgsql as $$
declare
  v_row public.connections%rowtype;
  r     record;
begin
  if p_status not in ('accepted', 'declined') then
    raise exception using message = 'VALIDATION', detail = 'status must be accepted or declined';
  end if;
  select * into v_row from public.connections where id = p_connection_id for update;
  if not found or p_user not in (v_row.from_id, v_row.to_id) then
    raise exception using message = 'NOT_FOUND';
  end if;
  if v_row.to_id <> p_user then
    raise exception using message = 'FORBIDDEN';
  end if;
  if v_row.status <> 'pending' then
    raise exception using message = 'INVALID_STATE';
  end if;

  update public.connections
     set status = p_status, responded_at = now()
   where id = p_connection_id
  returning * into v_row;

  if p_status = 'accepted' then
    for r in
      select s.id, s.user_id, s.interest_slug, s.difficulty
        from public.roadmap_stages s
       where s.user_id in (v_row.from_id, v_row.to_id)
         and s.kind = 'connect'
         and s.status = 'active'
       order by s.id
         for update
    loop
      if r.difficulty <= public.plan_max_difficulty((select plan from public.profiles where id = r.user_id))
         and public.has_buddy_for(r.user_id, r.interest_slug) then
        perform public.finish_stage(r.id, false);
      end if;
    end loop;
  end if;

  return to_jsonb(v_row);
end $$;

-- ---------- Safety ----------
-- two-way: hides both people from each other, declines their connection, cancels meetups,
-- releases co-op stages that were waiting for each other
create or replace function public.block_user(p_user uuid, p_target uuid)
returns void language plpgsql as $$
begin
  if p_user = p_target then
    raise exception using message = 'VALIDATION', detail = 'cannot block yourself';
  end if;
  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception using message = 'NOT_FOUND';
  end if;

  insert into public.blocks (blocker_id, blocked_id) values (p_user, p_target)
  on conflict do nothing;

  update public.meetups m
     set status = 'cancelled'
    from public.connections c
   where m.connection_id = c.id
     and m.status in ('proposed', 'confirmed')
     and least(c.from_id, c.to_id) = least(p_user, p_target)
     and greatest(c.from_id, c.to_id) = greatest(p_user, p_target);

  update public.connections
     set status = 'declined', responded_at = now()
   where least(from_id, to_id) = least(p_user, p_target)
     and greatest(from_id, to_id) = greatest(p_user, p_target)
     and status <> 'declined';

  update public.roadmap_stages
     set status = 'active', partner_id = null
   where status = 'waiting_partner'
     and ((user_id = p_user and partner_id = p_target) or (user_id = p_target and partner_id = p_user));
end $$;

-- ---------- Read models ----------
-- everyone sharing >= 1 interest with p_me, except blocked (both directions) and declined pairs, best first.
-- score = sum over shared interests of (my difficulty + their difficulty) + 3 same city + 1 same meet_style
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
         (c.interest_score
           + case when p.state = me.state and lower(trim(p.city)) = me.city_key then 3 else 0 end
           + case when p.meet_style = me.meet_style then 1 else 0 end)::int as score,
         c.shared
    from cand c
    join public.profiles p on p.id = c.uid
   cross join me
   where not public.is_blocked(p_me, p.id)
     and not exists (
       select 1 from public.connections x
        where least(x.from_id, x.to_id) = least(p_me, p.id)
          and greatest(x.from_id, x.to_id) = greatest(p_me, p.id)
          and x.status = 'declined')
   order by score desc, p.created_at asc
$$;

-- "12 people in TX also want running": per my interest, people in my state with it
create or replace function public.nearby_counts(p_me uuid)
returns table (interest_slug text, people integer) language sql stable as $$
  select m.interest_slug,
         (select count(*)::int
            from public.user_interests o
            join public.profiles p on p.id = o.user_id
           where o.interest_slug = m.interest_slug
             and o.user_id <> p_me
             and p.state = me.state
             and not public.is_blocked(p_me, o.user_id))
    from public.user_interests m
   cross join (select state from public.profiles where id = p_me) me
   where m.user_id = p_me
   order by m.difficulty
$$;

-- photo reports; co-op photos appear only after both partners uploaded
create or replace function public.feed_items(p_me uuid, p_scope text, p_limit integer default 30)
returns table (
  report_id uuid, author_id uuid, author_name text, author_avatar jsonb, author_city text, author_state text,
  interest_slug text, stage_title text, stage_kind text, difficulty smallint,
  photo_path text, caption text, visibility text, created_at timestamptz,
  partner_id uuid, partner_name text
) language sql stable as $$
  select r.id, r.user_id, p.display_name, p.avatar, p.city, p.state,
         s.interest_slug, s.title, s.kind, s.difficulty,
         r.photo_path, r.caption, r.visibility, r.created_at,
         case when s.kind = 'coop' then s.partner_id end,
         case when s.kind = 'coop' then pp.display_name end
    from public.stage_reports r
    join public.roadmap_stages s on s.id = r.stage_id
    join public.profiles p on p.id = r.user_id
    left join public.profiles pp on pp.id = s.partner_id
   where r.photo_path is not null
     and (s.kind <> 'coop' or s.status = 'done')
     and case when p_scope = 'mine' then r.user_id = p_me
              else r.visibility = 'public' and not public.is_blocked(p_me, r.user_id) end
   order by r.created_at desc
   limit least(greatest(coalesce(p_limit, 30), 1), 50)
$$;

-- my connections with the other person's public info; social_url only when accepted
create or replace function public.list_connections(p_me uuid)
returns table (
  id uuid, from_id uuid, to_id uuid, interest_slug text, status text, created_at timestamptz,
  other_id uuid, other_name text, other_avatar jsonb, other_city text, other_state text, other_bio text,
  social_url text
) language sql stable as $$
  select c.id, c.from_id, c.to_id, c.interest_slug, c.status, c.created_at,
         o.id, o.display_name, o.avatar, o.city, o.state, o.bio,
         case when c.status = 'accepted' then o.social_url end
    from public.connections c
    join public.profiles o on o.id = case when c.from_id = p_me then c.to_id else c.from_id end
   where p_me in (c.from_id, c.to_id)
     and c.status <> 'declined'
     and not public.is_blocked(c.from_id, c.to_id)
   order by c.created_at desc
$$;

-- ---------- Privileges: functions are server-only ----------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
