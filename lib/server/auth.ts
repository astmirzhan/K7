import 'server-only';
import { AppError } from './errors';
import { adminClient, sessionClient } from './supabase';

export interface AuthUser {
  id: string;
  email: string | null;
}

/**
 * Browser: Supabase session cookie. Tests / scripts / curl: `Authorization: Bearer <access_token>`.
 * Both are verified by Supabase Auth (getUser), never just decoded.
 */
export async function requireUser(req: Request): Promise<AuthUser> {
  const header = req.headers.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) {
    const { data, error } = await adminClient().auth.getUser(header.slice(7).trim());
    if (error || !data.user) throw new AppError('UNAUTHORIZED');
    return { id: data.user.id, email: data.user.email ?? null };
  }
  const supabase = await sessionClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new AppError('UNAUTHORIZED');
  return { id: data.user.id, email: data.user.email ?? null };
}
