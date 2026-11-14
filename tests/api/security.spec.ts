import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { Api, onboardedUser, Users } from './helpers';

const users = new Users();
test.afterAll(() => users.cleanup());

/** What a browser with the publishable key and a user JWT can reach directly (RLS is the second line of defence). */
test('publishable key + user JWT: only own profile row, no RPC, no public_profiles, no writes', async ({ request }) => {
  const api = new Api(request);
  const a = await onboardedUser(users, api);
  const b = await onboardedUser(users, api);

  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${a.token}` } },
  });

  const profiles = await client.from('profiles').select('id, social_url');
  expect(profiles.error).toBeNull();
  expect(profiles.data?.map((p) => p.id)).toEqual([a.id]);

  const other = await client.from('profiles').select('id').eq('id', b.id);
  expect(other.data).toEqual([]);

  const view = await client.from('public_profiles').select('id');
  expect(view.error).not.toBeNull();

  const rpc = await client.rpc('complete_stage', {
    p_user: a.id, p_stage_id: a.id, p_photo_path: null, p_caption: null, p_visibility: 'public', p_partner_id: null,
  });
  expect(rpc.error).not.toBeNull();

  const match = await client.rpc('match_users', { p_me: a.id });
  expect(match.error).not.toBeNull();

  const write = await client.from('profiles').update({ plan: 'crew', coins: 999 }).eq('id', a.id).select();
  expect(write.data ?? []).toEqual([]);
  const me = await api.get<{ plan: string; coins: number }>('/api/me', a.token);
  expect(me.body).toMatchObject({ plan: 'free', coins: 0 });

  const stages = await client.from('roadmap_stages').select('id');
  expect(stages.data?.length).toBe(19);
  const insert = await client.from('coin_ledger').insert({ user_id: a.id, amount: 100, reason: 'stage', ref_id: a.id });
  expect(insert.error).not.toBeNull();

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const anonProfiles = await anon.from('profiles').select('id');
  expect(anonProfiles.data ?? []).toEqual([]);
  const interests = await anon.from('interests').select('slug');
  expect(interests.data?.length).toBe(30);
});

test('API never leaks social_url, plan or stripe ids of other people', async ({ request }) => {
  const api = new Api(request);
  const a = await onboardedUser(users, api, { state: 'ME', city: 'Portland' });
  await onboardedUser(users, api, { state: 'ME', city: 'Portland', socialUrl: 'https://instagram.com/secret.handle' });

  const map = await api.get('/api/map/users?state=ME', a.token);
  const text = JSON.stringify(map.body);
  expect(text).not.toContain('secret.handle');
  expect(text).not.toContain('stripe');
  expect(text).not.toContain('"plan"');
});
