import { requireUser } from '@/lib/server/auth';
import { loadConnection } from '@/lib/server/connections';
import { AppError, fromDbError } from '@/lib/server/errors';
import { parseJson, parseWith, route } from '@/lib/server/http';
import { adminClient } from '@/lib/server/supabase';
import { idSchema, respondConnectionSchema } from '@/lib/server/validation';
import type { Avatar, Connection, UsState } from '@/lib/types';

interface ConnRpc { id: string; from_id: string; to_id: string; interest_slug: string; status: 'accepted' | 'declined'; created_at: string }
interface PublicRow { id: string; display_name: string; avatar: Avatar; city: string; state: UsState; bio: string }

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const connectionId = parseWith(idSchema, (await params).id);
  const body = await parseJson(req, respondConnectionSchema);

  const db = adminClient();
  const { data, error } = await db.rpc('respond_connection', {
    p_user: user.id,
    p_connection_id: connectionId,
    p_status: body.status,
  });
  if (error) throw fromDbError(error);
  const row = data as ConnRpc;

  if (row.status === 'accepted') return loadConnection(user.id, row.id);

  // declined connections are not listed any more: build the response from the row itself
  const otherId = row.from_id === user.id ? row.to_id : row.from_id;
  const other = await db.from('public_profiles').select('id, display_name, avatar, city, state, bio').eq('id', otherId).maybeSingle();
  if (other.error) throw new AppError('INTERNAL', undefined, { details: other.error.message });
  const o = other.data as PublicRow | null;
  if (!o) throw new AppError('NOT_FOUND');
  const res: Connection = {
    id: row.id,
    interestSlug: row.interest_slug,
    status: 'declined',
    direction: row.from_id === user.id ? 'outgoing' : 'incoming',
    createdAt: row.created_at,
    other: { userId: o.id, displayName: o.display_name, avatar: o.avatar, city: o.city, state: o.state, bio: o.bio },
    socialUrl: null,
  };
  return res;
});
