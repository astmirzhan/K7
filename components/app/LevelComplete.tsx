'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Cloud } from '@/components/scene/Cloud';
import { Coin } from '@/components/scene/Coin';
import { BADGES, NinjaBadge } from '@/components/scene/NinjaBadge';
import { Button } from '@/components/ui/Button';
import { credentialId, K7_LINKEDIN_ORG_ID, linkedinAddUrl } from '@/lib/credential';
import { DIFFICULTY_LABEL } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Avatar, Difficulty, Level } from '@/lib/types';
import { earnedBadges } from './BadgeShelf';

// "badge unlocked!" (Figma Badges & sharing A): the badge, its credential, LinkedIn + Instagram story, your badges.
export function LevelComplete({
  level,
  coins,
  userId,
  levels,
  onNext,
}: {
  level: Level;
  avatar: Avatar;
  coins: number;
  userId: string;
  levels: Level[];
  onNext: () => void;
}) {
  const badgeRef = useRef<HTMLDivElement>(null);
  const [storyFile, setStoryFile] = useState<File | null>(null);
  // build the story image as soon as the badge is on screen
  useEffect(() => {
    let alive = true;
    void makeStoryFile().then((f) => alive && f && setStoryFile(f));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  if (typeof document === 'undefined') return null;

  const d = level.difficulty;
  const badge = BADGES[d];
  const certId = credentialId(userId, level.interest.slug, d);
  const issued = new Date();
  const issuedText = issued.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  const title = `${level.interest.name} — ${badge.title} (${DIFFICULTY_LABEL[d]})`;
  const earned = earnedBadges(levels);
  earned.add(d);

  async function makeStoryFile(): Promise<File | null> {
    const svg = badgeRef.current?.querySelector('svg');
    if (!svg) return null;
    try {
      await document.fonts?.ready;
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const css = getComputedStyle(document.documentElement);
      const display = css.getPropertyValue('--font-display').trim() || 'monospace';
      const label = css.getPropertyValue('--font-label').trim() || 'monospace';
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('width', '640');
      clone.setAttribute('height', String(Math.round((640 * 112) / 100)));
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
      await img.decode();
      const text = (t: string, y: number, size: number, font: string, color: string) => {
        ctx.font = `${size}px ${font}`;
        ctx.textAlign = 'center';
        ctx.lineWidth = size / 6;
        ctx.strokeStyle = '#2e1b5b';
        ctx.strokeText(t, 540, y);
        ctx.fillStyle = color;
        ctx.fillText(t, 540, y);
      };
      text('LEVEL', 380, 150, display, '#ffffff');
      text('COMPLETE', 520, 150, display, '#ffffff');
      ctx.drawImage(img, 220, 600, 640, Math.round((640 * 112) / 100));
      text(`${level.interest.name} · ${DIFFICULTY_LABEL[d]}`, 1420, 96, display, '#ffffff');
      ctx.fillStyle = '#2e1b5b';
      ctx.fillRect(220, 1480, 640, 90);
      ctx.font = `40px ${label}`;
      ctx.fillStyle = '#ffc803';
      ctx.textAlign = 'center';
      ctx.fillText(`K7 · ${certId}`, 540, 1540);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
      return blob ? new File([blob], `k7-${badge.title.toLowerCase().replace(' ', '-')}.png`, { type: 'image/png' }) : null;
    } catch {
      return null;
    }
  }

  function addToLinkedin() {
    window.open(
      linkedinAddUrl({ name: title, certId, certUrl: window.location.origin, issued, orgId: process.env.NEXT_PUBLIC_LINKEDIN_ORG_ID || K7_LINKEDIN_ORG_ID }),
      '_blank',
      'noopener,noreferrer',
    );
  }

  /**
   * iPhone Safari only opens the share sheet straight from a tap, so the story PNG is made ahead of time
   * (when this screen opens) and the tap shares the ready file at once.
   */
  async function shareStory() {
    const file = storyFile ?? (await makeStoryFile());
    if (!file) return toast('Could not make the story image. Try again.', { tone: 'error' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: badge.title });
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // closed the share sheet
    }
    // no file sharing (desktop browsers): save the PNG, then post it from the gallery
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Story image saved. Open Instagram, add a story and pick it from your gallery.', { tone: 'success', ms: 6000 });
  }

  return createPortal(
    <div data-testid="level-complete" role="dialog" aria-modal="true" aria-label="Badge unlocked" className="fixed inset-0 z-[65] overflow-y-auto bg-[linear-gradient(180deg,var(--color-sky)_0%,#9fb4e4_45%,#c9e3c9_72%,var(--color-sky-low)_100%)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <Cloud width={110} className="absolute left-[8%] top-[8%]" />
        <Cloud width={140} className="absolute right-[6%] top-[14%]" />
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className="k7-confetti absolute top-0" style={{ left: `${(i * 53) % 100}%`, animation: `k7-confetti ${2.6 + (i % 5) * 0.4}s linear ${(i % 7) * 0.25}s both` }}>
            <Coin size={14 + (i % 3) * 6} />
          </span>
        ))}
      </div>
      <div className="relative mx-auto flex min-h-dvh max-w-[720px] flex-col items-center justify-center gap-4 px-4 py-10 text-center">
        <h1 className="k7-title text-[56px] md:text-[80px]">badge unlocked!</h1>
        <p className="k7-label text-[11px]">
          {level.interest.name} · {DIFFICULTY_LABEL[d]} · {level.progress.total} / {level.progress.total} stages
        </p>
        <div ref={badgeRef} className="k7-pop" data-testid="level-badge">
          <NinjaBadge difficulty={d} earned size={200} />
        </div>
        <p data-testid="credential" className="k7-label flex flex-wrap justify-center gap-x-4 gap-y-1 rounded-[10px] border-[3px] border-ink bg-ink px-4 py-2 text-[10px] text-white">
          <span style={{ color: badge.name }}>{badge.title}</span>
          <span>Credential {certId}</span>
          <span>Issued {issuedText}</span>
          <span className="flex items-center gap-1 text-yellow">
            <Coin size={12} /> +{coins}
          </span>
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={addToLinkedin} data-testid="add-to-linkedin">
            add to linkedin
          </Button>
          <Button variant="secondary" pending={!storyFile} onClick={() => void shareStory()} data-testid="instagram-story">
            instagram story
          </Button>
          <Button variant="secondary" onClick={onNext}>
            next goal
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="k7-label text-[10px]">Your badges {earned.size} / 3</span>
          {([1, 3, 5] as Difficulty[]).map((x) => (
            <NinjaBadge key={x} difficulty={x} earned={earned.has(x)} size={34} />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
