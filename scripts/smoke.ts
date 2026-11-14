// Production smoke test: SMOKE_URL=https://<prod> pnpm smoke
// Signs in as the judges and walks the read side of the golden path without changing their data.
import { createClient } from '@supabase/supabase-js';
import type { ConnectionsResponse, Level, MapStateCount, MapUsersResponse, Me } from '../lib/types';

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const base = need('SMOKE_URL').replace(/\/+$/, '');
let failures = 0;

function check(cond: boolean, msg: string) {
  process.stdout.write(`${cond ? 'ok  ' : 'FAIL'} ${msg}\n`);
  if (!cond) failures += 1;
}

async function token(email: string): Promise<string> {
  const client = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: need('JUDGE_PASSWORD') });
  if (error || !data.session) throw new Error(`sign in ${email} failed: ${error?.message}`);
  return data.session.access_token;
}

async function get<T>(path: string, jwt?: string): Promise<{ status: number; body: T }> {
  const res = await fetch(`${base}${path}`, { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} });
  return { status: res.status, body: (await res.json().catch(() => null)) as T };
}

async function main() {
  const health = await get<{ ok: boolean; interests: number }>('/api/health');
  check(health.status === 200 && health.body.ok && health.body.interests === 30, `/api/health ${JSON.stringify(health.body)}`);

  const interests = await get<unknown[]>('/api/interests');
  check(interests.status === 200 && interests.body.length === 30, '/api/interests → 30');

  const anon = await get('/api/me');
  check(anon.status === 401, '/api/me without token → 401');

  const j1 = await token('judge1@example.com');
  const j2 = await token('judge2@example.com');

  const me = await get<Me>('/api/me', j1);
  check(me.status === 200 && me.body.onboarded, '/api/me judge1 onboarded');
  if (me.body.onboarded) {
    check(me.body.plan === 'free', `judge1 plan is free (${me.body.plan})`);
    check(me.body.nearby.some((n) => n.interestSlug === 'running' && n.people > 0), `nearby running > 0 (${JSON.stringify(me.body.nearby)})`);
    check(me.body.questOfDay !== null, 'quest of the day present');
    check(me.body.pendingIncoming >= 1, `judge1 has a pending request (${me.body.pendingIncoming})`);
  }

  const roadmap = await get<Level[]>('/api/roadmap', j1);
  check(roadmap.status === 200 && roadmap.body.flatMap((l) => l.stages).length === 19, 'roadmap has 19 stages');
  check(roadmap.body.find((l) => l.difficulty === 3)?.requiredPlan === 'starter', 'Medium locked with starter');

  const states = await get<MapStateCount[]>('/api/map/states', j1);
  const tx = states.body.find((s) => s.state === 'TX');
  check(states.status === 200 && (tx?.count ?? 0) >= 10, `TX on the map has ${tx?.count ?? 0} people`);

  const users = await get<MapUsersResponse>('/api/map/users?state=TX', j1);
  check(users.status === 200 && users.body.items.length > 0 && users.body.items.length <= 10, `map users TX: ${users.body.items?.length} shown`);
  check(users.body.hiddenCount > 0, `hiddenCount for Free: ${users.body.hiddenCount}`);
  check(users.body.items.some((c) => c.sameCity), 'at least one same-city card');
  check(!JSON.stringify(users.body).includes('instagram.com'), 'no social links on cards');

  const conns = await get<ConnectionsResponse>('/api/connections', j1);
  check(conns.status === 200 && conns.body.incoming.some((c) => c.other.displayName.startsWith('Sarah')), 'Sarah\'s request is incoming');

  const feed = await get<unknown[]>('/api/feed', j2);
  check(feed.status === 200 && feed.body.length >= 10, `feed has ${feed.body?.length} items`);

  const me2 = await get<Me>('/api/me', j2);
  check(me2.status === 200 && me2.body.onboarded && me2.body.coins === 0, 'judge2 fresh (0 coins)');

  process.stdout.write(failures === 0 ? '\nSMOKE PASSED\n' : `\nSMOKE FAILED (${failures})\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
