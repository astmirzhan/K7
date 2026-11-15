import { describe, expect, it } from 'vitest';
import { pairCoopItems } from '../../lib/feed-pairs';
import type { FeedItem } from '../../lib/types';

const avatar = { kind: 'preset', preset: 'ninja-1' } as const;
const interest = { slug: 'running', name: 'Running', icon: '🏃', category: 'fitness' } as const;
function item(id: string, author: string, partner: string | null, kind: FeedItem['kind'] = 'coop', slug = 'running'): FeedItem {
  return {
    id, kind, difficulty: 1, photoUrl: `https://x/${id}.jpg`, caption: '', visibility: 'public', createdAt: '2026-11-15T10:00:00Z',
    stageTitle: 'Run together', interest: { ...interest, slug },
    author: { userId: author, displayName: author, avatar, city: 'Austin', state: 'TX' },
    partner: partner ? { userId: partner, displayName: partner } : null,
  };
}

describe('pairCoopItems', () => {
  it('joins the two reports of one co-op stage', () => {
    const r = pairCoopItems([item('1', 'a', 'b'), item('2', 'x', null, 'solo'), item('3', 'b', 'a')]);
    expect(r.map((e) => e.kind)).toEqual(['pair', 'single']);
    expect(r[0]).toMatchObject({ a: { id: '1' }, b: { id: '3' } });
  });
  it('keeps a co-op report single while the partner has not posted', () => {
    expect(pairCoopItems([item('1', 'a', 'b')]).map((e) => e.kind)).toEqual(['single']);
  });
  it('does not pair reports of different interests', () => {
    expect(pairCoopItems([item('1', 'a', 'b', 'coop', 'running'), item('2', 'b', 'a', 'coop', 'yoga')]).map((e) => e.kind)).toEqual(['single', 'single']);
  });
});
