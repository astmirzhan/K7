'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { OnboardedGate } from '@/components/OnboardedGate';
import { Coin } from '@/components/scene/Coin';
import { AvatarTile } from '@/components/scene/Ninja';
import { Chip, Tag } from '@/components/ui/Chip';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useFeed } from '@/lib/hooks';
import { pairCoopItems } from '@/lib/feed-pairs';
import { timeAgo } from '@/lib/relative-time';
import type { FeedItem } from '@/lib/types';
import { STATE_NAMES } from '@/lib/us';

// 10 Feed: vertical cards that scroll with the page. Everyone / Mine.
export function FeedScreen() {
  return <OnboardedGate fallback={<FeedSkeleton />}>{() => <Inner />}</OnboardedGate>;
}

function FeedSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col gap-4">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-[70dvh] w-full rounded-[16px]" />
    </div>
  );
}

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const scope = params.get('scope') === 'mine' ? 'mine' : 'public';
  const { data, error, isLoading, mutate } = useFeed(scope);

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col gap-3">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-[34px] leading-none">feed</h1>
        <div role="tablist" className="ml-auto flex gap-2">
          <Chip role="tab" size="sm" aria-selected={scope === 'public'} active={scope === 'public'} onClick={() => router.replace('/feed')} data-testid="feed-scope-public">
            everyone
          </Chip>
          <Chip role="tab" size="sm" aria-selected={scope === 'mine'} active={scope === 'mine'} onClick={() => router.replace('/feed?scope=mine')} data-testid="feed-scope-mine">
            mine
          </Chip>
        </div>
      </div>

      {error && !data ? (
        <ErrorState message={error.message} onRetry={() => void mutate()} />
      ) : isLoading && !data ? (
        <Skeleton className="h-[70dvh] w-full rounded-[16px]" />
      ) : !data || data.length === 0 ? (
        scope === 'mine' ? (
          <EmptyState title="No reports yet" text="Finish a stage with a photo — it lands here and in the public feed if you want." action={{ label: 'open the roadmap', href: '/roadmap' }} />
        ) : (
          <EmptyState title="The feed is quiet" text="Be the first: finish a stage with a photo." action={{ label: 'open the roadmap', href: '/roadmap' }} />
        )
      ) : (
        <div className="flex flex-col gap-4 pb-2">
          {pairCoopItems(data).map((e) =>
            e.kind === 'pair' ? (
              <CoopCard key={`${e.a.id}-${e.b.id}`} a={e.a} b={e.b} onImageError={() => void mutate()} />
            ) : (
              <FeedCard key={e.item.id} item={e.item} scope={scope} onImageError={() => void mutate()} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function FeedCard({ item, scope, onImageError }: { item: FeedItem; scope: 'public' | 'mine'; onImageError: () => void }) {
  return (
    <article data-testid="feed-item" className="k7-outline k7-shadow-sm flex shrink-0 flex-col overflow-hidden rounded-[16px] bg-white">
      <div className="flex items-center gap-3 p-3">
        <AvatarTile avatar={item.author.avatar} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[22px] leading-none">{item.author.displayName}</p>
          <p className="truncate text-[12px] text-ink/70">
            {item.author.city}, {STATE_NAMES[item.author.state]} · {timeAgo(item.createdAt)}
          </p>
        </div>
        {scope === 'mine' && item.visibility === 'private' ? <Tag tone="lilac">private</Tag> : null}
      </div>
      <div className="relative min-h-[240px] flex-1 bg-ink/5">
        <img
          src={item.photoUrl}
          alt={item.caption || `${item.stageTitle} — ${item.author.displayName}`}
          loading="lazy"
          decoding="async"
          onError={onImageError}
          className="h-full max-h-[62dvh] w-full object-cover md:max-h-[520px]"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Tag tone="white">
            <span aria-hidden="true">{item.interest.icon}</span> {item.interest.name}
          </Tag>
          <DifficultyBadge difficulty={item.difficulty} coins={item.kind === 'coop' ? item.difficulty * 2 : item.difficulty} />
        </div>
      </div>
      <div className="flex flex-col gap-1 p-3">
        <p className="text-[14px] font-semibold">
          {item.stageTitle}
          {item.partner ? <span className="text-ink/70"> · with {item.partner.displayName}</span> : null}
        </p>
        {item.caption ? <p className="text-[14px] text-ink/85">{item.caption}</p> : null}
        <p className="flex items-center gap-1 text-[12px] text-ink/60">
          <Coin size={12} /> {item.kind === 'coop' ? 'co-op stage' : item.kind === 'connect' ? 'buddy stage' : 'solo stage'}
        </p>
      </div>
    </article>
  );
}

/** Co-op reveal: both partners' photos side by side in one card. */
function CoopCard({ a, b, onImageError }: { a: FeedItem; b: FeedItem; onImageError: () => void }) {
  return (
    <article data-testid="feed-item" className="k7-outline k7-shadow-sm flex shrink-0 flex-col overflow-hidden rounded-[16px] bg-white">
      <div className="flex items-center gap-2 p-3">
        <div className="flex -space-x-2">
          <AvatarTile avatar={a.author.avatar} size={40} />
          <AvatarTile avatar={b.author.avatar} size={40} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[22px] leading-none">
            {a.author.displayName} &amp; {b.author.displayName}
          </p>
          <p className="truncate text-[12px] text-ink/70">
            {a.author.city}, {STATE_NAMES[a.author.state]} · {timeAgo(a.createdAt > b.createdAt ? a.createdAt : b.createdAt)}
          </p>
        </div>
        <Tag tone="yellow">co-op</Tag>
      </div>
      <div className="grid grid-cols-2 gap-[4px] bg-ink">
        {[a, b].map((x) => (
          <figure key={x.id} className="relative">
            <img
              src={x.photoUrl}
              alt={x.caption || `${x.stageTitle} — ${x.author.displayName}`}
              loading="lazy"
              decoding="async"
              onError={onImageError}
              className="aspect-[3/4] h-full w-full object-cover"
            />
            <figcaption className="k7-label absolute bottom-2 left-2 rounded-[6px] border-[3px] border-ink bg-white px-1.5 py-0.5 text-[9px]">
              {x.author.displayName}
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="white">
            <span aria-hidden="true">{a.interest.icon}</span> {a.interest.name}
          </Tag>
          <DifficultyBadge difficulty={a.difficulty} coins={a.difficulty * 2} />
        </div>
        <p className="text-[14px] font-semibold">
          {a.stageTitle} <span className="text-ink/70">· with {b.author.displayName}</span>
        </p>
        {[a, b].filter((x) => x.caption).map((x) => (
          <p key={x.id} className="text-[14px] text-ink/85">
            <span className="font-semibold">{x.author.displayName}:</span> {x.caption}
          </p>
        ))}
      </div>
    </article>
  );
}
