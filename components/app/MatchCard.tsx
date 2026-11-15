'use client';
import { useState } from 'react';
import { Coin } from '@/components/scene/Coin';
import { CheckIcon, PeopleIcon } from '@/components/scene/Icons';
import { AvatarTile } from '@/components/scene/Ninja';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Chip';
import { Field, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Panel } from '@/components/ui/Panel';
import { api, ApiRequestError } from '@/lib/api';
import { DIFFICULTY_LABEL, matchReason } from '@/lib/format';
import { invalidate } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import type { MatchCard as MatchCardData, SharedInterest } from '@/lib/types';
import { STATE_NAMES } from '@/lib/us';

function bestInterest(list: SharedInterest[]): SharedInterest | undefined {
  return [...list].sort((a, b) => b.myDifficulty + b.theirDifficulty - (a.myDifficulty + a.theirDifficulty))[0];
}

// 06 Match card: avatar · name · city · bio · shared interests with both difficulties · Connect · menu.
export function MatchCard({ card, onGone }: { card: MatchCardData; onGone?: () => void }) {
  const { user, sharedInterests, sameCity, connection } = card;
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [pick, setPick] = useState<string>(bestInterest(sharedInterests)?.slug ?? '');
  const [choosing, setChoosing] = useState(false);
  const [report, setReport] = useState<null | 'report' | 'block'>(null);
  const [reason, setReason] = useState('');

  async function run(fn: () => Promise<unknown>, after: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await after();
    } catch (e) {
      if (e instanceof ApiRequestError) {
        if (e.code === 'ALREADY_CONNECTED' || e.code === 'INVALID_STATE' || e.code === 'NOT_FOUND') {
          toast(e.message);
          await after();
        } else if (e.code !== 'PLAN_LIMIT') toast(e.message, { tone: 'error' });
      } else toast('Something went wrong. Try again.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  function connect() {
    if (sharedInterests.length > 1 && !choosing) {
      setChoosing(true);
      return;
    }
    const slug = pick || sharedInterests[0]?.slug;
    if (!slug) return;
    let accepted = false;
    void run(
      async () => {
        const c = await api.connect({ toUserId: user.userId, interestSlug: slug });
        accepted = c.status === 'accepted';
      },
      // an instant accept also completes "Find a buddy" and awards coins: refresh like a manual accept
      () => (accepted ? invalidate.afterRespond() : invalidate.afterConnect()),
    ).then(() => {
      setChoosing(false);
      if (accepted) toast(`${user.displayName} accepted. You're buddies now!`, { tone: 'success' });
    });
  }

  function respond(status: 'accepted' | 'declined') {
    if (!connection.id) return;
    void run(() => api.respondConnection(connection.id!, { status }), invalidate.afterRespond);
  }

  async function sendReport() {
    setBusy(true);
    try {
      await api.report({ targetUserId: user.userId, reason: reason.trim() || undefined });
      toast("Thanks, we'll review it", { tone: 'success' });
      setReport(null);
      setReason('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong. Try again.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function block() {
    setBusy(true);
    try {
      await api.block({ targetUserId: user.userId });
      await invalidate.afterBlock();
      toast(`${user.displayName} is blocked`);
      setReport(null);
      onGone?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong. Try again.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  let action: React.ReactNode;
  switch (connection.state) {
    case 'none':
      action = (
        <Button size="sm" pending={busy} onClick={connect} data-testid={`connect-${user.userId}`}>
          <PeopleIcon size={14} color="currentColor" /> connect
        </Button>
      );
      break;
    case 'outgoing_pending':
      action = (
        <Button size="sm" variant="secondary" disabled>
          requested
        </Button>
      );
      break;
    case 'incoming_pending':
      action = (
        <>
          <Button size="sm" pending={busy} onClick={() => respond('accepted')} data-testid={`accept-${connection.id}`}>
            <CheckIcon size={12} color="currentColor" /> accept
          </Button>
          <Button size="sm" variant="secondary" pending={busy} onClick={() => respond('declined')} data-testid={`decline-${connection.id}`}>
            decline
          </Button>
        </>
      );
      break;
    case 'accepted':
      action = (
        <ButtonLink href="/people" size="sm" variant="ink">
          buddies
        </ButtonLink>
      );
  }

  return (
    <Panel shadow="sm" className="relative flex flex-col gap-3 p-4" data-testid={`match-card-${user.userId}`}>
      <div className="flex items-start gap-3">
        <AvatarTile avatar={user.avatar} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-display text-[28px] leading-none">{user.displayName}</h3>
            {sameCity ? <Tag tone="grass">same city</Tag> : null}
          </div>
          <p className="mt-1 text-[13px] text-ink/70">
            {user.city}, {STATE_NAMES[user.state]} · {user.ageRange}
          </p>
        </div>
        <span className="inline-flex h-8 items-center gap-1 rounded-[8px] border-[3px] border-ink bg-ink px-2 font-display text-[18px] leading-none text-yellow" aria-label={`${user.coins} coins`}>
          <Coin size={12} /> {user.coins}
        </span>
        <button
          type="button"
          aria-label="More"
          aria-haspopup="menu"
          aria-expanded={menu}
          data-testid={`card-menu-${user.userId}`}
          onClick={() => setMenu((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] border-[3px] border-ink bg-white font-display text-[20px] leading-none hover:bg-mist"
        >
          ···
        </button>
      </div>

      {menu ? (
        <div role="menu" className="k7-outline k7-shadow-sm absolute right-4 top-14 z-10 flex flex-col overflow-hidden rounded-[10px] bg-white">
          <button type="button" role="menuitem" data-testid={`report-${user.userId}`} onClick={() => { setMenu(false); setReport('report'); }} className="px-4 py-2.5 text-left text-[14px] font-semibold hover:bg-mist">
            Report
          </button>
          <button type="button" role="menuitem" data-testid={`block-${user.userId}`} onClick={() => { setMenu(false); setReport('block'); }} className="px-4 py-2.5 text-left text-[14px] font-semibold text-danger hover:bg-mist">
            Block
          </button>
        </div>
      ) : null}

      <p className="text-[13px] font-semibold text-leaf">{matchReason(sharedInterests.map((s) => s.name), sameCity)}</p>
      {user.bio ? <p className="text-[14px] text-ink/85">{user.bio}</p> : null}

      <ul className="flex flex-wrap gap-2" aria-label="Shared interests">
        {sharedInterests.map((s) => (
          <li key={s.slug} className="k7-label inline-flex h-8 items-center gap-1.5 rounded-[8px] border-[3px] border-ink bg-mist px-2.5 text-[10px]">
            <span aria-hidden="true">{s.icon}</span>
            {s.name}
            <span className="text-ink/60">
              you {DIFFICULTY_LABEL[s.myDifficulty]} · them {DIFFICULTY_LABEL[s.theirDifficulty]}
            </span>
          </li>
        ))}
      </ul>

      {choosing ? (
        <div className="flex flex-col gap-2 rounded-[10px] border-[3px] border-ink bg-mist p-3">
          <span className="k7-label">Connect for</span>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {sharedInterests.map((s) => (
              <button
                key={s.slug}
                type="button"
                role="radio"
                aria-checked={pick === s.slug}
                onClick={() => setPick(s.slug)}
                className={`k7-label h-8 rounded-[8px] border-[3px] border-ink px-2.5 text-[10px] ${pick === s.slug ? 'bg-ink text-yellow' : 'bg-white'}`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">{action}</div>

      <Modal open={report === 'report'} onClose={() => setReport(null)} label="Report" width="max-w-[440px]">
        <div className="flex flex-col gap-4 pr-8">
          <h2 className="font-display text-[32px] leading-none">report {user.displayName}</h2>
          <Field label="What happened? (optional)" htmlFor="report-reason">
            <Textarea id="report-reason" maxLength={300} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Spam, harassment, fake profile…" />
          </Field>
          <Button pending={busy} onClick={sendReport}>send report</Button>
        </div>
      </Modal>
      <Modal open={report === 'block'} onClose={() => setReport(null)} label="Block" width="max-w-[440px]">
        <div className="flex flex-col gap-4 pr-8">
          <h2 className="font-display text-[32px] leading-none">block {user.displayName}?</h2>
          <p className="text-[14px] text-ink/80">They disappear from your map, people and feed. Pending requests and open co-op stages are released.</p>
          <div className="flex gap-2">
            <Button variant="danger" pending={busy} onClick={block} data-testid="confirm-block">block</Button>
            <Button variant="secondary" onClick={() => setReport(null)}>cancel</Button>
          </div>
        </div>
      </Modal>
    </Panel>
  );
}
