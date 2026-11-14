import { requireUser } from '@/lib/server/auth';
import { parseJson, parseWith, route } from '@/lib/server/http';
import { requireProfile } from '@/lib/server/me';
import { updateMeetup } from '@/lib/server/meetups';
import { idSchema, updateMeetupSchema } from '@/lib/server/validation';

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const meetupId = parseWith(idSchema, (await params).id);
  const body = await parseJson(req, updateMeetupSchema);
  await requireProfile(user.id);
  return updateMeetup(user.id, meetupId, body.status);
});
