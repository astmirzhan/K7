// Pure helpers for typed goals (no server-only import, so unit tests can use them).

/** "  rock   climbing " -> { name: 'Rock climbing', slug: 'rock-climbing' }; null when nothing usable is left. */
export function normalizeGoalName(raw: string): { name: string; slug: string } | null {
  const collapsed = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (collapsed.length < 2 || collapsed.length > 30) return null;
  const name = collapsed.charAt(0).toLocaleUpperCase('en-US') + collapsed.slice(1);
  const slug = collapsed
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  if (slug.length < 2) return null;
  return { name, slug };
}
