import type { APIRequestContext, APIResponse } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import type { Difficulty, OnboardingRequest, UsState } from '../../lib/types';

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in .env.local (API tests need a Supabase project)`);
  return v;
}

export const PASSWORD = 'test-pass-123';

let adminRef: SupabaseClient | null = null;
export function admin(): SupabaseClient {
  adminRef ??= createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminRef;
}

/** Client with the publishable key: what the browser would use (Auth + signed uploads). */
export function publicClient(): SupabaseClient {
  return createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

export class Users {
  private created: string[] = [];

  async create(): Promise<TestUser> {
    const email = `t-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const { data, error } = await admin().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
    this.created.push(data.user.id);
    const signIn = await publicClient().auth.signInWithPassword({ email, password: PASSWORD });
    if (signIn.error || !signIn.data.session) throw new Error(`signIn failed: ${signIn.error?.message}`);
    return { id: data.user.id, email, token: signIn.data.session.access_token };
  }

  async cleanup(): Promise<void> {
    await Promise.all(this.created.map((id) => admin().auth.admin.deleteUser(id)));
    this.created = [];
  }
}

export interface ApiResult<T = unknown> {
  status: number;
  body: T;
}

async function parse<T>(res: APIResponse): Promise<ApiResult<T>> {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status(), body: body as T };
}

export class Api {
  constructor(private readonly request: APIRequestContext) {}

  private headers(token?: string): Record<string, string> {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  get<T = unknown>(path: string, token?: string) {
    return this.request.get(path, { headers: this.headers(token) }).then((r) => parse<T>(r));
  }
  post<T = unknown>(path: string, body: unknown, token?: string) {
    return this.request.post(path, { data: body, headers: this.headers(token) }).then((r) => parse<T>(r));
  }
  patch<T = unknown>(path: string, body: unknown, token?: string) {
    return this.request.patch(path, { data: body, headers: this.headers(token) }).then((r) => parse<T>(r));
  }
}

export function onboardingBody(overrides: {
  state?: UsState;
  city?: string;
  interests?: Array<{ slug: string; difficulty: Difficulty }>;
  socialUrl?: string;
  meetStyle?: OnboardingRequest['profile']['meetStyle'];
} = {}): OnboardingRequest {
  return {
    avatar: { kind: 'preset', preset: 'ninja-1' },
    profile: {
      displayName: 'Test Ninja',
      state: overrides.state ?? 'TX',
      city: overrides.city ?? 'Austin',
      ageRange: '30-34',
      meetStyle: overrides.meetStyle ?? 'solo',
      socialUrl: overrides.socialUrl ?? 'https://instagram.com/test.ninja',
      bio: 'Here to test.',
    },
    interests: overrides.interests ?? [
      { slug: 'running', difficulty: 1 },
      { slug: 'spanish', difficulty: 3 },
      { slug: 'guitar', difficulty: 5 },
    ],
  };
}

/** Creates a user and onboards them. */
export async function onboardedUser(users: Users, api: Api, overrides: Parameters<typeof onboardingBody>[0] = {}) {
  const u = await users.create();
  const r = await api.post('/api/onboarding', onboardingBody(overrides), u.token);
  if (r.status !== 200) throw new Error(`onboarding failed: ${r.status} ${JSON.stringify(r.body)}`);
  return u;
}

/** A tiny real JPEG (sharp), uploaded through the same signed-URL path the browser uses. */
export async function uploadPhoto(api: Api, token: string, stageId: string): Promise<string> {
  const upload = await api.post<{ photoPath: string; token: string }>(`/api/stages/${stageId}/upload-url`, {}, token);
  if (upload.status !== 200) throw new Error(`upload-url failed: ${upload.status} ${JSON.stringify(upload.body)}`);
  const jpeg = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#71c5cf' } }).jpeg().toBuffer();
  const { error } = await publicClient()
    .storage.from('stage-photos')
    .uploadToSignedUrl(upload.body.photoPath, upload.body.token, jpeg, { contentType: 'image/jpeg' });
  if (error) throw new Error(`uploadToSignedUrl failed: ${error.message}`);
  return upload.body.photoPath;
}

interface StageLike { id: string; kind: string; status: string; idx: number }
interface LevelLike { difficulty: number; progress: { done: number; total: number }; stages: StageLike[] }

export async function roadmap(api: Api, token: string): Promise<LevelLike[]> {
  const r = await api.get<LevelLike[]>('/api/roadmap', token);
  if (r.status !== 200) throw new Error(`roadmap failed: ${r.status}`);
  return r.body;
}

export function level(levels: LevelLike[], difficulty: number): LevelLike {
  const l = levels.find((x) => x.difficulty === difficulty);
  if (!l) throw new Error(`no level with difficulty ${difficulty}`);
  return l;
}
