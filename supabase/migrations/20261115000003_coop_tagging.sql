-- Co-op as tagging: one person posts the photo and tags a buddy, and the co-op stage is done for both
-- right away (the buddy's open co-op stage, the same goal first). No more waiting for a second photo.
-- If the buddy has no open co-op stage yet, only the poster's stage is done.

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
    -- tagging, like on social: my post closes my co-op stage and the tagged buddy's open co-op stage
    update public.roadmap_stages set partner_id = p_partner_id where id = p_stage_id;
    v_stage_coins := public.finish_stage(p_stage_id, true);
    select * into v_partner from public.roadmap_stages
     where user_id = p_partner_id
       and kind = 'coop'
       and status in ('active', 'waiting_partner')
     order by (interest_slug = v_stage.interest_slug) desc, difficulty, idx
     limit 1
     for update;
    if found then
      update public.roadmap_stages set partner_id = p_user where id = v_partner.id;
      perform public.finish_stage(v_partner.id, true);
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
