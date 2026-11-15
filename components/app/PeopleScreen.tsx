'use client';
import { useMemo, useState } from 'react';
import { OnboardedGate } from '@/components/OnboardedGate';
import { CheckIcon } from '@/components/scene/Icons';
import { AvatarTile } from '@/components/scene/Ninja';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Chip, Tag } from '@/components/ui/Chip';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Panel } from '@/components/ui/Panel';
import { EmptyState, ErrorState, PanelSkeleton } from '@/components/ui/States';
import { api, ApiRequestError } from '@/lib/api';
import { localInputToIso } from '@/lib/format';
import { invalidate, useConnections, useMeetups } from '@/lib/hooks';
import { formatWhen } from '@/lib/relative-time';
import { toast } from '@/lib/toast';
import type { Connection, Meetup, OnboardedMe } from '@/lib/types';
import { STATE_NAMES } from '@/lib/us';

type Tab = 'requests' | 'sent' | 'buddies';

// 09 People: Requests · Sent · Buddies, meetups under each buddy.
export function PeopleScreen() {
  return (
    <OnboardedGate fallback={<PanelSkeleton lines={6} />}>
      {(me) => <Inner me={me} />}
    </OnboardedGate>
  );
}

function Inner({ me }: { me: OnboardedMe }) {
  const conns = useConnections({ poll: true });
  const meetups = useMeetups();
  const [tab, setTab] = useState<Tab>('requests');
  const [propose, setPropose] = useState<Connection | null>(null);
  const [icebreak, setIcebreak] = useState<Connection | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const interestName = (slug: string) => me.interests.find((i) => i.interest.slug === slug)?.interest.name ?? slug;

  const data = conns.data;
  const byConnection = useMemo(() => {
    const map = new Map<string, Meetup[]>();
    for (const m of meetups.data ?? []) map.set(m.connectionId, [...(map.get(m.connectionId) ?? []), m]);
    for (const list of map.values()) list.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    return map;
  }, [meetups.data]);

  const activeTab: Tab = data && tab === 'requests' && data.incoming.length === 0 && data.accepted.length > 0 ? 'buddies' : tab;

  async function respond(c: Connection, status: 'accepted' | 'declined') {
    setBusyId(c.id);
    try {
      await api.respondConnection(c.id, { status });
      await invalidate.afterRespond();
      if (status === 'accepted') toast(`You and ${c.other.displayName} are buddies`, { tone: 'success' });
    } catch (e) {
      if (e instanceof ApiRequestError && (e.code === 'INVALID_STATE' || e.code === 'NOT_FOUND')) {
        toast(e.message);
        await invalidate.afterRespond();
      } else toast(e instanceof Error ? e.message : 'Something went wrong. Try again.', { tone: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function block(c: Connection) {
    if (!window.confirm(`Block ${c.other.displayName}? They disappear from your map, people and feed.`)) return;
    setBusyId(c.id);
    try {
      await api.block({ targetUserId: c.other.userId });
      await invalidate.afterBlock();
      toast(`${c.other.displayName} is blocked`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong. Try again.', { tone: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function updateMeetup(m: Meetup, status: 'confirmed' | 'cancelled' | 'done') {
    setBusyId(m.id);
    try {
      await api.updateMeetup(m.id, { status });
      await invalidate.afterMeetup();
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'INVALID_STATE') {
        toast(e.message);
        await invalidate.afterMeetup();
      } else toast(e instanceof Error ? e.message : 'Something went wrong. Try again.', { tone: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  if (conns.error && !data) return <ErrorState message={conns.error.message} onRetry={() => void conns.mutate()} />;
  if (!data) return <PanelSkeleton lines={6} />;

  const tabs: Array<{ id: Tab; label: string; n: number }> = [
    { id: 'requests', label: 'Requests', n: data.incoming.length },
    { id: 'sent', label: 'Sent', n: data.outgoing.length },
    { id: 'buddies', label: 'Buddies', n: data.accepted.length },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-[34px] leading-none">people</h1>
        <div role="tablist" className="ml-auto flex gap-2">
          {tabs.map((t) => (
            <Chip key={t.id} role="tab" aria-selected={activeTab === t.id} active={activeTab === t.id} size="sm" onClick={() => setTab(t.id)}>
              {t.label} <span className="opacity-60">{t.n}</span>
            </Chip>
          ))}
        </div>
      </div>

      {activeTab === 'requests' ? (
        data.incoming.length === 0 ? (
          <EmptyState title="No requests yet" text="People who want to start the same thing will show up here." action={{ label: 'open the map', href: '/map' }} />
        ) : (
          data.incoming.map((c) => (
            <Panel key={c.id} shadow="sm" className="flex flex-col gap-3 p-4" data-testid={`request-${c.id}`}>
              <Row c={c} subtitle={`wants to start ${interestName(c.interestSlug).toLowerCase()} with you`} />
              <div className="flex gap-2">
                <Button size="sm" pending={busyId === c.id} onClick={() => respond(c, 'accepted')} data-testid={`accept-${c.id}`}>
                  <CheckIcon size={12} color="currentColor" /> accept
                </Button>
                <Button size="sm" variant="secondary" pending={busyId === c.id} onClick={() => respond(c, 'declined')} data-testid={`decline-${c.id}`}>
                  decline
                </Button>
              </div>
            </Panel>
          ))
        )
      ) : activeTab === 'sent' ? (
        data.outgoing.length === 0 ? (
          <EmptyState title="Nothing sent" text="Find someone with a shared interest and tap Connect." action={{ label: 'open the map', href: '/map' }} />
        ) : (
          data.outgoing.map((c) => (
            <Panel key={c.id} shadow="sm" className="flex items-center gap-3 p-4">
              <Row c={c} subtitle={`${interestName(c.interestSlug)} · waiting for an answer`} />
              <Tag tone="lilac" className="ml-auto shrink-0">
                requested
              </Tag>
            </Panel>
          ))
        )
      ) : data.accepted.length === 0 ? (
        <EmptyState title="No buddies yet" text="Accept a request or connect with someone on the map. Buddies unlock co-op stages and meetups." action={{ label: 'open the map', href: '/map' }} />
      ) : (
        data.accepted.map((c) => {
          const list = byConnection.get(c.id) ?? [];
          return (
            <Panel key={c.id} shadow="sm" className="flex flex-col gap-3 p-4" data-testid={`buddy-${c.id}`}>
              <Row c={c} subtitle={`buddies for ${interestName(c.interestSlug).toLowerCase()} · ${c.other.city}`} />
              <div className="flex flex-wrap gap-2">
                {c.socialUrl ? (
                  <a href={c.socialUrl} target="_blank" rel="noopener noreferrer" data-testid={`social-${c.id}`} className="k7-label inline-flex h-10 items-center rounded-[10px] border-[3px] border-ink bg-white px-3.5 hover:bg-mist">
                    open profile ↗
                  </a>
                ) : null}
                <Button size="sm" onClick={() => setPropose(c)} data-testid={`propose-meetup-${c.id}`}>
                  propose a meetup
                </Button>
                <Button size="sm" variant="ink" onClick={() => setIcebreak(c)} data-testid={`icebreaker-${c.id}`}>
                  AI icebreaker{me.limits.aiSteps ? '' : ' · Pro'}
                </Button>
                <Button size="sm" variant="ghost" pending={busyId === c.id} onClick={() => block(c)} className="ml-auto text-danger">
                  block
                </Button>
              </div>
              {list.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {list.map((m) => (
                    <MeetupRow key={m.id} m={m} mine={m.proposedBy === me.id} other={c.other.displayName} interest={interestName(m.interestSlug)} busy={busyId === m.id} onUpdate={(s) => updateMeetup(m, s)} />
                  ))}
                </ul>
              ) : null}
            </Panel>
          );
        })
      )}

      <p className="text-[12px] text-ink/60">Meet in public places. Your social link opens only after you both accept.</p>

      {propose ? <ProposeMeetup c={propose} interestName={interestName} onClose={() => setPropose(null)} /> : null}
      {icebreak ? <Icebreaker c={icebreak} onClose={() => setIcebreak(null)} /> : null}
      <ButtonLink href="/map" variant="secondary" className="w-fit">
        find more people
      </ButtonLink>
    </div>
  );
}

function Row({ c, subtitle }: { c: Connection; subtitle: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <AvatarTile avatar={c.other.avatar} size={48} />
      <div className="min-w-0">
        <p className="font-display text-[26px] leading-none">{c.other.displayName}</p>
        <p className="truncate text-[13px] text-ink/70">
          {subtitle} · {STATE_NAMES[c.other.state]}
        </p>
      </div>
    </div>
  );
}

function MeetupRow({ m, mine, other, interest, busy, onUpdate }: { m: Meetup; mine: boolean; other: string; interest: string; busy: boolean; onUpdate: (s: 'confirmed' | 'cancelled' | 'done') => void }) {
  const tone = m.status === 'confirmed' ? 'grass' : m.status === 'done' ? 'ink' : m.status === 'cancelled' ? 'lilac' : 'yellow';
  return (
    <li data-testid={`meetup-${m.id}`} className="flex flex-col gap-2 rounded-[10px] border-[3px] border-ink bg-mist p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">
          {interest} · {formatWhen(m.startsAt)}
        </p>
        <p className="truncate text-[13px] text-ink/70">
          {m.place} · {mine ? 'you proposed' : `${other} proposed`}
        </p>
      </div>
      <Tag tone={tone} className="w-fit">
        {m.status === 'proposed' && mine ? 'waiting for confirmation' : m.status}
      </Tag>
      {m.status === 'proposed' ? (
        mine ? (
          <Button size="sm" variant="secondary" pending={busy} onClick={() => onUpdate('cancelled')} data-testid="meetup-action-cancelled">cancel</Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" pending={busy} onClick={() => onUpdate('confirmed')} data-testid="meetup-action-confirmed">confirm</Button>
            <Button size="sm" variant="secondary" pending={busy} onClick={() => onUpdate('cancelled')} data-testid="meetup-action-cancelled">decline</Button>
          </div>
        )
      ) : m.status === 'confirmed' ? (
        <div className="flex gap-2">
          <Button size="sm" pending={busy} onClick={() => onUpdate('done')} data-testid="meetup-action-done">mark as done</Button>
          <Button size="sm" variant="secondary" pending={busy} onClick={() => onUpdate('cancelled')} data-testid="meetup-action-cancelled">cancel</Button>
        </div>
      ) : null}
    </li>
  );
}

function ProposeMeetup({ c, interestName, onClose }: { c: Connection; interestName: (slug: string) => string; onClose: () => void }) {
  const [when, setWhen] = useState('');
  const [place, setPlace] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [slug, setSlug] = useState(c.interestSlug);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const options = c.sharedInterests.length > 0 ? c.sharedInterests : [c.interestSlug];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!when) errs.when = 'Pick a date and time';
    else if (new Date(when).getTime() < Date.now()) errs.when = 'Pick a time in the future';
    if (place.trim().length < 3 || place.trim().length > 120) errs.place = '3–120 characters';
    if (!isPublic) errs.public = 'Please confirm it is a public place';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api.proposeMeetup({ connectionId: c.id, startsAt: localInputToIso(when), place: place.trim(), interestSlug: slug });
      await invalidate.afterMeetup();
      toast(`Meetup proposed to ${c.other.displayName}`, { tone: 'success' });
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'VALIDATION') {
        const fe = err.fieldErrors();
        setErrors({ when: fe.startsAt ?? '', place: fe.place ?? '', form: Object.keys(fe).length ? '' : err.message });
      } else setErrors({ form: err instanceof Error ? err.message : 'Something went wrong. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} label="Propose a meetup" width="max-w-[480px]">
      <form onSubmit={submit} className="flex flex-col gap-4 pr-8" noValidate>
        <h2 className="font-display text-[32px] leading-none">meet {c.other.displayName}</h2>
        <Field label="Interest">
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {options.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={slug === s} onClick={() => setSlug(s)} className={`k7-label h-9 rounded-[8px] border-[3px] border-ink px-3 ${slug === s ? 'bg-ink text-yellow' : 'bg-white'}`}>
                {interestName(s)}
              </button>
            ))}
          </div>
        </Field>
        <Field label="When" htmlFor="meetup-when" error={errors.when || null}>
          <Input id="meetup-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-invalid={!!errors.when} />
        </Field>
        <Field label="Where" htmlFor="meetup-place" hint="a public place, e.g. Zilker Park" error={errors.place || null}>
          <Input id="meetup-place" maxLength={120} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Zilker Park, main entrance" aria-invalid={!!errors.place} />
        </Field>
        <label className="flex items-start gap-2 text-[14px]">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="mt-1 h-5 w-5 accent-ink" />
          <span>
            This is a public place
            {errors.public ? <span className="block text-[13px] font-semibold text-danger">{errors.public}</span> : null}
          </span>
        </label>
        {errors.form ? <p role="alert" className="text-[13px] font-semibold text-danger">{errors.form}</p> : null}
        <Button type="submit" pending={busy}>propose</Button>
      </form>
    </Modal>
  );
}

/** Pro: three AI-written first messages. On Free the API answers 402 and the global paywall opens. */
function Icebreaker({ c, onClose }: { c: Connection; onClose: () => void }) {
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ok'; lines: string[] } | { kind: 'error'; message: string }>({ kind: 'loading' });
  const [started, setStarted] = useState(false);

  async function load() {
    setState({ kind: 'loading' });
    try {
      const res = await api.icebreaker(c.id);
      setState({ kind: 'ok', lines: res.lines });
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'PLAN_LIMIT') return onClose(); // paywall is already open
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Something went wrong. Try again.' });
    }
  }
  if (!started) {
    setStarted(true);
    void load();
  }

  async function copy(line: string) {
    try {
      await navigator.clipboard.writeText(line);
      toast('Copied. Paste it in your chat with ' + c.other.displayName, { tone: 'success' });
    } catch {
      toast('Could not copy. Long-press the text instead.');
    }
  }

  return (
    <Modal open onClose={onClose} label="AI icebreaker" testId="icebreaker-sheet" width="max-w-[480px]">
      <div className="flex flex-col gap-4 pr-8">
        <h2 className="font-display text-[32px] leading-none">say hi to {c.other.displayName}</h2>
        <p className="text-[13px] text-ink/70">Written for your shared goals. Tap one to copy, then send it where you chat.</p>
        {state.kind === 'loading' ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="k7-skeleton h-14 w-full" />
            ))}
          </div>
        ) : state.kind === 'error' ? (
          <div className="flex flex-col items-start gap-2">
            <p role="alert" className="text-[14px] font-semibold text-danger">{state.message}</p>
            <Button size="sm" variant="secondary" onClick={() => void load()}>try again</Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {state.lines.map((line) => (
              <li key={line}>
                <button
                  type="button"
                  onClick={() => void copy(line)}
                  className="w-full rounded-[10px] border-[3px] border-ink bg-mist px-3 py-2.5 text-left text-[14px] hover:bg-white"
                >
                  {line}
                </button>
              </li>
            ))}
          </ul>
        )}
        {state.kind === 'ok' ? (
          <Button size="sm" variant="secondary" onClick={() => void load()} className="w-fit">
            new ideas
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}
