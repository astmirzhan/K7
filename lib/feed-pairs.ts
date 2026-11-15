import type { FeedItem } from './types';

export type FeedEntry = { kind: 'single'; item: FeedItem } | { kind: 'pair'; a: FeedItem; b: FeedItem };

/**
 * Joins the two reports of one co-op stage (each author names the other as partner, same interest)
 * into a single "pair" entry, so the feed can show both photos side by side. Keeps the feed order.
 */
export function pairCoopItems(items: FeedItem[]): FeedEntry[] {
  const used = new Set<string>();
  const out: FeedEntry[] = [];
  for (const item of items) {
    if (used.has(item.id)) continue;
    if (item.kind === 'coop' && item.partner) {
      const mate = items.find(
        (o) =>
          !used.has(o.id) && o.id !== item.id && o.kind === 'coop' &&
          o.author.userId === item.partner!.userId && o.partner?.userId === item.author.userId &&
          o.interest.slug === item.interest.slug,
      );
      if (mate) {
        used.add(item.id);
        used.add(mate.id);
        out.push({ kind: 'pair', a: item, b: mate });
        continue;
      }
    }
    used.add(item.id);
    out.push({ kind: 'single', item });
  }
  return out;
}
