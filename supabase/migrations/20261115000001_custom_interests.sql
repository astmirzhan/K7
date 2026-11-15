-- Goals typed by users: kept in the same catalog so matching by slug keeps working,
-- flagged `custom` so the public picker only suggests the curated 30.
alter table public.interests add column if not exists custom boolean not null default false;

alter table public.interests drop constraint if exists interests_category_check;
alter table public.interests add constraint interests_category_check
  check (category in ('fitness','outdoors','languages','music','creative','food','mind','social','other'));
