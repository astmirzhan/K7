import type { Difficulty } from './types';

const LETTER: Record<Difficulty, string> = { 1: 'E', 3: 'M', 5: 'H' };

/** K7's LinkedIn Company Page (linkedin.com/company/145454247): credentials show its logo. Public, not a secret. */
export const K7_LINKEDIN_ORG_ID = '145454247';

/** Stable credential id for a finished level: K7-<3 letters of the goal>-<E|M|H>-<6 hex from user + goal>. */
export function credentialId(userId: string, interestSlug: string, difficulty: Difficulty): string {
  let h = 2166136261;
  for (const ch of `${userId}:${interestSlug}:${difficulty}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const hex = (h >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 6);
  const code = interestSlug.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  return `K7-${code}-${LETTER[difficulty]}-${hex}`;
}

/**
 * LinkedIn "Add licence or certification" form, prefilled. LinkedIn shows a logo only for a Company Page:
 * with `orgId` (the page's numeric id) the credential gets the K7 logo, without it LinkedIn shows a grey placeholder.
 */
export function linkedinAddUrl(opts: { name: string; certId: string; certUrl: string; issued: Date; orgId?: string }): string {
  const org: Record<string, string> = opts.orgId ? { organizationId: opts.orgId } : { organizationName: 'K7' };
  const q = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: opts.name,
    ...org,
    issueYear: String(opts.issued.getFullYear()),
    issueMonth: String(opts.issued.getMonth() + 1),
    certUrl: opts.certUrl,
    certId: opts.certId,
  });
  return `https://www.linkedin.com/profile/add?${q.toString()}`;
}
