import 'server-only';
import type { Avatar, Difficulty, FeedItem, StageKind, UsState, Visibility } from '../types';
import { AppError } from './errors';
import { interestCatalog } from './roadmap/read';
import { signPhotos } from './storage';
import { adminClient } from './supabase';

interface FeedRow {
  report_id: string;
  author_id: string;
  author_name: string;
  author_avatar: Avatar;
  author_city: string;
  author_state: UsState;
  interest_slug: string;
  stage_title: string;
  stage_kind: StageKind;
  difficulty: Difficulty;
  photo_path: string;
  caption: string;
  visibility: Visibility;
  created_at: string;
  partner_id: string | null;
  partner_name: string | null;
}

export async function loadFeed(meId: string, scope: 'public' | 'mine', limit = 30): Promise<FeedItem[]> {
  const [{ data, error }, catalog] = await Promise.all([
    adminClient().rpc('feed_items', { p_me: meId, p_scope: scope, p_limit: limit }),
    interestCatalog(),
  ]);
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  const rows = data as FeedRow[];
  const urls = await signPhotos(rows.map((r) => r.photo_path));

  return rows.flatMap((r) => {
    const photoUrl = urls.get(r.photo_path);
    if (!photoUrl) return [];
    return [{
      id: r.report_id,
      author: {
        userId: r.author_id,
        displayName: r.author_name,
        avatar: r.author_avatar,
        city: r.author_city,
        state: r.author_state,
      },
      interest: catalog.get(r.interest_slug) ?? { slug: r.interest_slug, name: r.interest_slug, icon: '⭐', category: 'social' },
      stageTitle: r.stage_title,
      kind: r.stage_kind,
      difficulty: r.difficulty,
      photoUrl,
      caption: r.caption,
      visibility: r.visibility,
      createdAt: r.created_at,
      partner: r.partner_id && r.partner_name ? { userId: r.partner_id, displayName: r.partner_name } : null,
    }];
  });
}
