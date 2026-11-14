-- DB scenario tests. Run on a fresh DB after supabase_stub.sql + migrations:
--   psql -v ON_ERROR_STOP=1 -f tests/db/scenarios.sql
-- Any failed assertion raises and stops the run.
\set ON_ERROR_STOP 1
set client_min_messages = warning;

create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ASSERT FAILED: %', msg; end if;
end $$;

create function pg_temp.fails_with(stmt text, code text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'NO_ERROR';
exception when others then
  if sqlerrm <> code then
    raise exception 'EXPECTED % BUT GOT "%" FOR: %', code, sqlerrm, stmt;
  end if;
end $$;

-- ===== T0 plan rules match lib/server/plans.ts (PLAN_RULES) =====
select pg_temp.ok(array[public.plan_max_difficulty('free'), public.plan_max_difficulty('starter'),
                        public.plan_max_difficulty('pro'), public.plan_max_difficulty('crew')] = array[1,3,5,5]::smallint[],
                  'T0 maxDifficulty free/starter/pro/crew = 1/3/5/5');
select pg_temp.ok(public.plan_connects_per_month('free') = 3 and public.plan_connects_per_month('starter') is null
                  and public.plan_connects_per_month('pro') is null and public.plan_connects_per_month('crew') is null,
                  'T0 connectsPerMonth free = 3, paid = unlimited');

-- users: A, B (Austin, both running Easy), C (Austin, no running), D/E/F (running, other states), G (fresh)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.com'),
  ('00000000-0000-0000-0000-00000000000d', 'd@example.com'),
  ('00000000-0000-0000-0000-00000000000e', 'e@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'f@example.com'),
  ('00000000-0000-0000-0000-000000000099', 'g@example.com');

\set A '''00000000-0000-0000-0000-00000000000a'''
\set B '''00000000-0000-0000-0000-00000000000b'''
\set C '''00000000-0000-0000-0000-00000000000c'''
\set D '''00000000-0000-0000-0000-00000000000d'''
\set E '''00000000-0000-0000-0000-00000000000e'''
\set F '''00000000-0000-0000-0000-00000000000f'''
\set G '''00000000-0000-0000-0000-000000000099'''

-- ===== T1 onboarding =====
select public.create_onboarding(:A, testkit.profile('Alice', 'TX', 'Austin', 'solo'),  testkit.interests('running','spanish','guitar'),  testkit.stages('running','spanish','guitar'));
select public.create_onboarding(:B, testkit.profile('Bob',   'TX', ' austin ', 'solo'), testkit.interests('running','cooking','chess'),  testkit.stages('running','cooking','chess'));
select public.create_onboarding(:C, testkit.profile('Cara',  'TX', 'Austin', 'family'), testkit.interests('yoga','spanish','piano'),     testkit.stages('yoga','spanish','piano'));
select public.create_onboarding(:D, testkit.profile('Dan',   'CA', 'Oakland', 'solo'), testkit.interests('running','french','drawing'), testkit.stages('running','french','drawing'));
select public.create_onboarding(:E, testkit.profile('Eve',   'NY', 'Brooklyn', 'couple'), testkit.interests('running','baking','coding'), testkit.stages('running','baking','coding'));
select public.create_onboarding(:F, testkit.profile('Fay',   'TX', 'Dallas', 'solo'),  testkit.interests('running','writing','hiking'), testkit.stages('running','writing','hiking'));

select pg_temp.ok((select count(*) from roadmap_stages where user_id = :A) = 19, 'T1 19 stages');
select pg_temp.ok((select count(*) from roadmap_stages where user_id = :A and status = 'active') = 3, 'T1 three active first stages');
select pg_temp.ok((select bool_and(is_coop = (kind = 'coop')) from roadmap_stages), 'T1 is_coop generated');
select pg_temp.fails_with(format('select public.create_onboarding(%L, testkit.profile(''Al'',''TX'',''Austin'',''solo''), testkit.interests(''running'',''spanish'',''guitar''), testkit.stages(''running'',''spanish'',''guitar''))', :A), 'ALREADY_ONBOARDED');
select pg_temp.fails_with(format('select public.create_onboarding(%L, testkit.profile(''Gi'',''TX'',''Austin'',''solo''), testkit.interests(''running'',''running'',''guitar''), testkit.stages(''running'',''spanish'',''guitar''))', :G), 'VALIDATION');
select pg_temp.fails_with(format('select public.create_onboarding(%L, testkit.profile(''Gi'',''Texas'',''Austin'',''solo''), testkit.interests(''running'',''spanish'',''guitar''), testkit.stages(''running'',''spanish'',''guitar''))', :G), 'VALIDATION');
select pg_temp.fails_with(format('select public.create_onboarding(%L, testkit.profile(''Gi'',''TX'',''Austin'',''solo''), testkit.interests(''running'',''spanish'',''nope''), testkit.stages(''running'',''spanish'',''nope''))', :G), 'VALIDATION');
select pg_temp.fails_with(format('select public.create_onboarding(%L, testkit.profile(''Gi'',''TX'',''Austin'',''solo''), testkit.interests(''running'',''spanish'',''guitar''), testkit.stages(''running'',''spanish'',''piano''))', :G), 'VALIDATION');
select pg_temp.ok(not exists (select 1 from profiles where id = :G), 'T1 failed onboarding leaves nothing behind');

-- ===== T2 solo stage =====
select public.complete_stage(:A, testkit.stage(:A, 'running', 1), null, null, 'public', null);
select pg_temp.ok(testkit.coins(:A) = 1, 'T2 easy stage pays 1');
select pg_temp.ok((select status from roadmap_stages where id = testkit.stage(:A, 'running', 2)) = 'active', 'T2 next stage unlocked');
select pg_temp.fails_with(format('select public.complete_stage(%L, %L, null, null, ''public'', null)', :A, testkit.stage(:A, 'running', 1)), 'STAGE_NOT_ACTIVE');
select pg_temp.fails_with(format('select public.complete_stage(%L, %L, null, null, ''public'', null)', :A, testkit.stage(:A, 'running', 3)), 'STAGE_NOT_ACTIVE');
select pg_temp.fails_with(format('select public.complete_stage(%L, %L, null, null, ''public'', null)', :B, testkit.stage(:A, 'running', 2)), 'NOT_FOUND');
select pg_temp.fails_with(format('select public.complete_stage(%L, %L, null, null, ''friends'', null)', :A, testkit.stage(:A, 'running', 2)), 'VALIDATION');

-- ===== T3 plan limits on levels =====
select pg_temp.fails_with(format('select public.complete_stage(%L, %L, null, null, ''public'', null)', :A, testkit.stage(:A, 'spanish', 1)), 'PLAN_LIMIT');
select pg_temp.fails_with(format('select public.complete_stage(%L, %L, null, null, ''public'', null)', :A, testkit.stage(:A, 'guitar', 1)), 'PLAN_LIMIT');

-- ===== T4 connect stage can't be done by hand without a buddy =====
select pg_temp.fails_with(format('select public.complete_stage(%L, %L, null, null, ''public'', null)', :A, testkit.stage(:A, 'running', 2)), 'CONNECT_REQUIRED');

-- ===== T5 connection requests =====
select pg_temp.fails_with(format('select public.request_connection(%L, %L, ''running'')', :A, :A), 'VALIDATION');
select pg_temp.fails_with(format('select public.request_connection(%L, %L, ''running'')', :A, :C), 'NO_SHARED_INTEREST');
select pg_temp.fails_with(format('select public.request_connection(%L, %L, ''running'')', :G, :A), 'NOT_ONBOARDED');
select public.request_connection(:A, :B, 'running');
select pg_temp.fails_with(format('select public.request_connection(%L, %L, ''running'')', :A, :B), 'ALREADY_CONNECTED');
select pg_temp.fails_with(format('select public.request_connection(%L, %L, ''running'')', :B, :A), 'ALREADY_CONNECTED');
select public.request_connection(:A, :D, 'running');
select public.request_connection(:A, :E, 'running');
select pg_temp.fails_with(format('select public.request_connection(%L, %L, ''running'')', :A, :F), 'PLAN_LIMIT');

-- ===== T6 respond + auto-complete of "connect" stages =====
select pg_temp.fails_with(format('select public.respond_connection(%L, (select id from connections where from_id = %L and to_id = %L), ''accepted'')', :A, :A, :B), 'FORBIDDEN');
select pg_temp.fails_with(format('select public.respond_connection(%L, (select id from connections where from_id = %L and to_id = %L), ''accepted'')', :C, :A, :B), 'NOT_FOUND');
select public.respond_connection(:B, (select id from connections where from_id = :A and to_id = :B), 'accepted');
select pg_temp.fails_with(format('select public.respond_connection(%L, (select id from connections where from_id = %L and to_id = %L), ''declined'')', :B, :A, :B), 'INVALID_STATE');
select pg_temp.ok((select status from roadmap_stages where id = testkit.stage(:A, 'running', 2)) = 'done', 'T6 A connect stage auto-done on accept');
select pg_temp.ok((select status from roadmap_stages where id = testkit.stage(:A, 'running', 3)) = 'active', 'T6 A coop stage active');
select pg_temp.ok(testkit.coins(:A) = 2, 'T6 A coins 1 + 1');
select pg_temp.ok((select status from roadmap_stages where id = testkit.stage(:B, 'running', 2)) = 'locked', 'T6 B connect still locked (B has not done stage 1)');
-- B finishes stage 1 -> connect stage activates and completes itself because B already has a buddy
select public.complete_stage(:B, testkit.stage(:B, 'running', 1), null, null, 'public', null);
select pg_temp.ok((select status from roadmap_stages where id = testkit.stage(:B, 'running', 2)) = 'done', 'T6 B connect auto-done on activation');
select pg_temp.ok((select status from roadmap_stages where id = testkit.stage(:B, 'running', 3)) = 'active', 'T6 B coop active');
select pg_temp.ok(testkit.coins(:B) = 2, 'T6 B coins 1 + 1');

-- ===== T7 co-op =====
select pg_temp.fails_with(format('select public.complete_stage(%L, %L, null, null, ''public'', %L)', :A, testkit.stage(:A, 'running', 3), :B), 'PHOTO_REQUIRED');
select pg_temp.fails_with(format('select public.complete_stage(%L, %L, ''x/y/z.jpg'', null, ''public'', null)', :A, testkit.stage(:A, 'running', 3)), 'PARTNER_REQUIRED');
select pg_temp.fails_with(format('select public.complete_stage(%L, %L, ''x/y/z.jpg'', null, ''public'', %L)', :A, testkit.stage(:A, 'running', 3), :D), 'PARTNER_INVALID'); -- pending, not accepted
select pg_temp.fails_with(format('select public.complete_stage(%L, %L, ''x/y/z.jpg'', null, ''public'', %L)', :A, testkit.stage(:A, 'running', 3), :C), 'PARTNER_INVALID'); -- no connection
select pg_temp.fails_with(format('select public.complete_stage(%L, %L, ''x/y/z.jpg'', null, ''public'', %L)', :A, testkit.stage(:A, 'running', 3), :B), 'VALIDATION');      -- foreign path

select public.complete_stage(:A, testkit.stage(:A, 'running', 3),
  :A || '/' || testkit.stage(:A, 'running', 3) || '/p1.jpg', 'first run together', 'public', :B);
select pg_temp.ok((select status from roadmap_stages where id = testkit.stage(:A, 'running', 3)) = 'waiting_partner', 'T7 A waits for partner');
select pg_temp.ok(testkit.coins(:A) = 4, 'T7 A photo bonus +2 while waiting');
select pg_temp.ok((select count(*) from public.feed_items(:C, 'public', 30)) = 0, 'T7 waiting co-op photo hidden from feed');
-- re-upload while waiting is allowed and does not pay the photo bonus twice
select public.complete_stage(:A, testkit.stage(:A, 'running', 3),
  :A || '/' || testkit.stage(:A, 'running', 3) || '/p2.jpg', 'retake', 'public', :B);
select pg_temp.ok(testkit.coins(:A) = 4, 'T7 re-upload no double photo bonus');

select pg_temp.ok((public.complete_stage(:B, testkit.stage(:B, 'running', 3),
  :B || '/' || testkit.stage(:B, 'running', 3) || '/q.jpg', 'with Alice', 'public', :A))->>'levelCompleted' = 'true', 'T7 B level completed');
select pg_temp.ok((select status from roadmap_stages where id = testkit.stage(:A, 'running', 3)) = 'done', 'T7 A coop done when B uploaded');
select pg_temp.ok((select status from roadmap_stages where id = testkit.stage(:B, 'running', 3)) = 'done', 'T7 B coop done');
select pg_temp.ok(testkit.coins(:A) = 6, 'T7 A coins: 1 + 1 + 2 photo + 1 stage + 1 coop bonus');
select pg_temp.ok(testkit.coins(:B) = 6, 'T7 B coins: 1 + 1 + 2 photo + 1 stage + 1 coop bonus');
select pg_temp.ok((select count(*) from public.feed_items(:C, 'public', 30)) = 2, 'T7 both co-op photos in feed');
select pg_temp.ok((select partner_name from public.feed_items(:C, 'public', 30) where author_id = :A) = 'Bob', 'T7 feed shows partner');

-- ===== T8 ledger is the single source of truth, rewards are idempotent =====
select public.finish_stage(testkit.stage(:A, 'running', 3), true);
select pg_temp.ok(testkit.coins(:A) = 6, 'T8 finishing twice pays nothing');
select pg_temp.ok(not exists (
  select 1 from profiles p
  where p.coins <> coalesce((select sum(amount) from coin_ledger l where l.user_id = p.id), 0)
), 'T8 profiles.coins == sum(ledger) for everyone');

-- ===== T9 matching, nearby, private feed =====
select pg_temp.ok((select score from public.match_users(:A) where user_id = :B) = 1 + 1 + 3 + 1, 'T9 score: running 1+1, same city (case/space-insensitive) +3, same meet_style +1');
select pg_temp.ok((select score from public.match_users(:A) where user_id = :C) = 3 + 3 + 3, 'T9 score: spanish 3+3, same city +3, different meet_style');
select pg_temp.ok((select user_id from public.match_users(:A) limit 1) = :C, 'T9 sorted by score desc');
select pg_temp.ok(not exists (select 1 from public.match_users(:A) where user_id = :A), 'T9 never matches self');
select pg_temp.ok((select people from public.nearby_counts(:A) where interest_slug = 'running') = 2, 'T9 nearby running in TX = B and F');
update stage_reports set visibility = 'private' where user_id = :B;
select pg_temp.ok((select count(*) from public.feed_items(:C, 'public', 30)) = 1, 'T9 private report hidden from others');
select pg_temp.ok((select count(*) from public.feed_items(:B, 'mine', 30)) = 1, 'T9 private report visible in mine');
select pg_temp.ok((select social_url from public.list_connections(:A) where other_id = :B) is not null, 'T9 social_url revealed when accepted');
select pg_temp.ok((select social_url from public.list_connections(:A) where other_id = :D) is null, 'T9 social_url hidden while pending');

-- ===== T10 upgrade unlocks Medium =====
update profiles set plan = 'starter' where id = :A;
select public.complete_stage(:A, testkit.stage(:A, 'spanish', 1), null, null, 'public', null);
select pg_temp.ok(testkit.coins(:A) = 9, 'T10 medium stage pays 3 after upgrade');
select pg_temp.fails_with(format('select public.complete_stage(%L, %L, null, null, ''public'', null)', :A, testkit.stage(:A, 'guitar', 1)), 'PLAN_LIMIT');
select public.request_connection(:A, :F, 'running');  -- starter: no monthly limit
-- declined pairs disappear from each other's map
select public.respond_connection(:E, (select id from connections where from_id = :A and to_id = :E), 'declined');
select pg_temp.ok(not exists (select 1 from public.match_users(:A) where user_id = :E), 'T10 declined hidden for sender');
select pg_temp.ok(not exists (select 1 from public.match_users(:E) where user_id = :A), 'T10 declined hidden for receiver');

-- ===== T11 block (two-way) =====
-- set up: C and A connect over spanish and both wait in a co-op... simulate with a direct waiting stage of D
select public.respond_connection(:D, (select id from connections where from_id = :A and to_id = :D), 'accepted');
select public.complete_stage(:D, testkit.stage(:D, 'running', 1), null, null, 'public', null);
select public.complete_stage(:D, testkit.stage(:D, 'running', 3),
  :D || '/' || testkit.stage(:D, 'running', 3) || '/d.jpg', '', 'public', :A);
select pg_temp.ok((select status from roadmap_stages where id = testkit.stage(:D, 'running', 3)) = 'waiting_partner', 'T11 D waiting for A');
select public.block_user(:A, :D);
select pg_temp.ok(not exists (select 1 from public.match_users(:A) where user_id = :D), 'T11 blocked hidden for blocker');
select pg_temp.ok(not exists (select 1 from public.match_users(:D) where user_id = :A), 'T11 blocker hidden for blocked');
select pg_temp.ok((select status from connections where from_id = :A and to_id = :D) = 'declined', 'T11 connection declined');
select pg_temp.ok((select status from roadmap_stages where id = testkit.stage(:D, 'running', 3)) = 'active', 'T11 waiting co-op released');
select pg_temp.fails_with(format('select public.request_connection(%L, %L, ''running'')', :D, :A), 'NOT_FOUND');
select pg_temp.fails_with(format('select public.block_user(%L, %L)', :A, :A), 'VALIDATION');

-- ===== T12 RLS and privileges as a real client =====
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.ok((select count(*) from profiles) = 1, 'T12 client sees only own profile');
select pg_temp.ok((select count(*) from profiles where social_url is not null and id <> auth.uid()) = 0, 'T12 no foreign social_url via client');
select pg_temp.ok((select count(*) from interests) = 30, 'T12 catalog readable');
select pg_temp.ok((select count(*) from roadmap_stages) = 19, 'T12 own stages only');
reset role;

create function pg_temp.denied(stmt text) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  execute stmt;
  raise exception 'NO_ERROR';
exception when insufficient_privilege then null;
          when others then raise exception 'EXPECTED permission denied BUT GOT "%" FOR: %', sqlerrm, stmt;
end $$;
select pg_temp.denied('select * from public.public_profiles');
select pg_temp.denied(format('select public.complete_stage(%L, %L, null, null, ''public'', null)', :A, testkit.stage(:A, 'spanish', 2)));
select pg_temp.denied('select * from public.match_users(auth.uid())');
-- RLS: client writes silently affect 0 rows
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update profiles set plan = 'crew', coins = 9999 where id = auth.uid();
reset role;
select pg_temp.ok((select plan from profiles where id = :A) = 'starter' and testkit.coins(:A) = 9, 'T12 client cannot change plan or coins');

\echo 'ALL DB SCENARIOS PASSED'
