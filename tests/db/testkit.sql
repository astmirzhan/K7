-- Test helpers shared by scenarios.sql and concurrency.sh (test DB only).
create schema if not exists testkit;

create function testkit.skeleton(d int) returns text[] language sql immutable as $$
  select case d
    when 1 then array['solo','connect','coop']
    when 3 then array['solo','solo','solo','connect','solo','coop']
    else array['solo','solo','solo','solo','connect','solo','solo','solo','solo','coop'] end
$$;

create function testkit.stages(e text, m text, h text) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object(
    'interestSlug', x.slug, 'difficulty', x.d, 'idx', t.i, 'kind', t.k,
    'title', 'Stage ' || t.i || ' of ' || x.slug, 'description', 'test stage', 'minutes', 10,
    'steps', '["one","two","three"]'::jsonb, 'requiresPhoto', t.k = 'coop', 'coins', x.d, 'source', 'template'))
  from (values (e, 1), (m, 3), (h, 5)) x(slug, d),
       lateral unnest(testkit.skeleton(x.d)) with ordinality t(k, i)
$$;

create function testkit.profile(name text, st text, city text, meet text) returns jsonb language sql as $$
  select jsonb_build_object('displayName', name, 'avatar', '{"kind":"preset","preset":"ninja-1"}'::jsonb,
    'state', st, 'city', city, 'ageRange', '30-34', 'meetStyle', meet,
    'socialUrl', 'https://instagram.com/' || lower(name), 'bio', 'hi')
$$;

create function testkit.interests(e text, m text, h text) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('slug', e, 'difficulty', 1),
                           jsonb_build_object('slug', m, 'difficulty', 3),
                           jsonb_build_object('slug', h, 'difficulty', 5))
$$;

create function testkit.stage(u uuid, slug text, i int) returns uuid language sql as $$
  select id from public.roadmap_stages where user_id = u and interest_slug = slug and idx = i
$$;

create function testkit.coins(u uuid) returns int language sql as $$
  select coins from public.profiles where id = u
$$;

