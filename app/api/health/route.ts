import { connection } from 'next/server';
import { adminClient } from '@/lib/server/supabase';

export async function GET(): Promise<Response> {
  await connection(); // never prerender at build time: this must hit the DB on every request
  // the 30 curated goals; goals typed by users (custom) do not change the health check
  const { count, error } = await adminClient().from('interests').select('slug', { count: 'exact', head: true }).eq('custom', false);
  return Response.json({ ok: !error && count === 30, interests: count ?? 0 }, { status: error ? 503 : 200 });
}
