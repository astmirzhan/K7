-- K7 schema: tables, indexes, RLS, safe profile view, storage bucket.
-- All data access goes through the Next.js API with the secret (service_role) key.
-- RLS is the second line of defence: clients can read only their own rows and cannot write at all.

-- ---------- Catalog ----------
create table public.interests (
  slug     text primary key check (slug ~ '^[a-z0-9-]+$'),
  name     text not null,
  icon     text not null,
  category text not null check (category in ('fitness','outdoors','languages','music','creative','food','mind','social'))
);

-- ---------- Users ----------
create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  display_name       text not null check (char_length(display_name) between 2 and 30),
  avatar             jsonb not null,
  state              text not null check (state ~ '^[A-Z]{2}$'),
  city               text not null check (char_length(city) between 2 and 50),
  age_range          text not null check (age_range in ('25-29','30-34','35-39','40-45')),
  meet_style         text not null check (meet_style in ('solo','couple','family')),
  social_url         text not null,
  bio                text not null default '' check (char_length(bio) <= 160),
  plan               text not null default 'free' check (plan in ('free','starter','pro','crew')),
  coins              integer not null default 0 check (coins >= 0),
  stripe_customer_id text unique,
  created_at         timestamptz not null default now()
);
create index profiles_state_idx on public.profiles (state);

create table public.user_interests (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  interest_slug text not null references public.interests(slug),
  difficulty    smallint not null check (difficulty in (1,3,5)),
  primary key (user_id, interest_slug),
  unique (user_id, difficulty)
);
create index user_interests_slug_idx on public.user_interests (interest_slug);

-- ---------- Roadmap ----------
-- One "level" = one interest at one difficulty: Easy 3 stages, Medium 6, Hard 10.
-- kind: solo = do it yourself; connect = auto-completes when you have an accepted buddy with this interest;
--       coop = final stage, done together, requires a photo from BOTH people.
create table public.roadmap_stages (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  interest_slug  text not null references public.interests(slug),
  difficulty     smallint not null check (difficulty in (1,3,5)),
  idx            smallint not null check (idx >= 1),
  kind           text not null check (kind in ('solo','connect','coop')),
  title          text not null check (char_length(title) between 3 and 80),
  description    text not null check (char_length(description) <= 300),
  minutes        smallint not null default 15 check (minutes between 5 and 120),
  steps          jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  requires_photo boolean not null default false,
  is_coop        boolean generated always as (kind = 'coop') stored,
  partner_id     uuid references public.profiles(id) on delete set null,
  status         text not null default 'locked' check (status in ('locked','active','waiting_partner','done')),
  coins          smallint not null check (coins > 0),
  source         text not null default 'template' check (source in ('template','ai')),
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  unique (user_id, interest_slug, idx)
);
create index roadmap_stages_user_status_idx on public.roadmap_stages (user_id, status);
create index roadmap_stages_partner_idx on public.roadmap_stages (partner_id) where partner_id is not null;

create table public.stage_reports (
  id         uuid primary key default gen_random_uuid(),
  stage_id   uuid not null unique references public.roadmap_stages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  photo_path text,
  caption    text not null default '' check (char_length(caption) <= 140),
  visibility text not null default 'public' check (visibility in ('public','private')),
  created_at timestamptz not null default now()
);
create index stage_reports_feed_idx on public.stage_reports (visibility, created_at desc);
create index stage_reports_user_idx on public.stage_reports (user_id, created_at desc);

-- ---------- People ----------
create table public.connections (
  id            uuid primary key default gen_random_uuid(),
  from_id       uuid not null references public.profiles(id) on delete cascade,
  to_id         uuid not null references public.profiles(id) on delete cascade,
  interest_slug text not null references public.interests(slug),
  status        text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  check (from_id <> to_id)
);
-- one connection per pair, regardless of direction
create unique index connections_pair_uniq on public.connections (least(from_id, to_id), greatest(from_id, to_id));
create index connections_to_status_idx on public.connections (to_id, status);
create index connections_from_created_idx on public.connections (from_id, created_at);

create table public.meetups (
  id            uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  proposed_by   uuid not null references public.profiles(id) on delete cascade,
  interest_slug text not null references public.interests(slug),
  starts_at     timestamptz not null,
  place         text not null check (char_length(place) between 3 and 120),
  status        text not null default 'proposed' check (status in ('proposed','confirmed','cancelled','done')),
  created_at    timestamptz not null default now()
);
create index meetups_connection_idx on public.meetups (connection_id);

-- ---------- Economy ----------
create table public.coin_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  amount     integer not null,
  reason     text not null check (reason in ('stage','photo','coop_bonus','streak','spend')),
  ref_id     uuid,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref_id)  -- the same reward for the same thing is never paid twice
);

-- ---------- Safety ----------
create table public.abuse_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_id   uuid not null references public.profiles(id) on delete cascade,
  reason      text not null default '' check (char_length(reason) <= 300),
  created_at  timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

-- ---------- Safe projection of other people (never contains social_url / plan / stripe id) ----------
create view public.public_profiles as
  select id, display_name, avatar, state, city, age_range, meet_style, bio, coins, created_at
  from public.profiles;

-- ---------- RLS: read own rows only, no client writes ----------
alter table public.interests      enable row level security;
alter table public.profiles       enable row level security;
alter table public.user_interests enable row level security;
alter table public.roadmap_stages enable row level security;
alter table public.stage_reports  enable row level security;
alter table public.connections    enable row level security;
alter table public.meetups        enable row level security;
alter table public.coin_ledger    enable row level security;
alter table public.abuse_reports  enable row level security;
alter table public.blocks         enable row level security;

create policy interests_read      on public.interests      for select to anon, authenticated using (true);
create policy profiles_own        on public.profiles       for select to authenticated using (id = (select auth.uid()));
create policy user_interests_own  on public.user_interests for select to authenticated using (user_id = (select auth.uid()));
create policy roadmap_stages_own  on public.roadmap_stages for select to authenticated using (user_id = (select auth.uid()));
create policy stage_reports_own   on public.stage_reports  for select to authenticated using (user_id = (select auth.uid()));
create policy connections_party   on public.connections    for select to authenticated using ((select auth.uid()) in (from_id, to_id));
create policy meetups_party       on public.meetups        for select to authenticated using (
  exists (select 1 from public.connections c where c.id = connection_id and (select auth.uid()) in (c.from_id, c.to_id))
);
create policy coin_ledger_own     on public.coin_ledger    for select to authenticated using (user_id = (select auth.uid()));
create policy abuse_reports_own   on public.abuse_reports  for select to authenticated using (reporter_id = (select auth.uid()));
create policy blocks_own          on public.blocks         for select to authenticated using (blocker_id = (select auth.uid()));

-- The view runs with its owner's rights, so clients must not see it at all. Server-only.
revoke all on public.public_profiles from anon, authenticated;

-- ---------- Storage: private bucket for stage photos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stage-photos', 'stage-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
