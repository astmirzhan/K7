import { requireUser } from '@/lib/server/auth';
import { route } from '@/lib/server/http';
import { buildMe } from '@/lib/server/me';

export const GET = route(async (req) => buildMe(await requireUser(req)));
