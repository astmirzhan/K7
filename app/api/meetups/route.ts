import { requireUser } from '@/lib/server/auth';
import { parseJson, route } from '@/lib/server/http';
import { requireProfile } from '@/lib/server/me';
import { createMeetup, listMeetups } from '@/lib/server/meetups';
import { createMeetupSchema } from '@/lib/server/validation';

export const GET = route(async (req) => {
  const user = await requireUser(req);
  await requireProfile(user.id);
  return listMeetups(user.id);
});

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const body = await parseJson(req, createMeetupSchema);
  await requireProfile(user.id);
  return createMeetup(user.id, body);
});
