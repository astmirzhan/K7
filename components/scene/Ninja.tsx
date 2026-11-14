// Pixel ninja avatars (16 × 16 grid) drawn in code: 4 presets from the design + the custom builder.
import type { Avatar } from '@/lib/types';

// Legend: . empty · o ink outline · s suit · b band · k skin · h band tail (band colour) · w white (eyes)
const GRID = [
  '.....oooooo.....',
  '....osssssso....',
  '...ossssssssooo.',
  '...obbbbbbbbobho',
  '...okkkkkkkko.o.',
  '...okwkkkkwko...',
  '...osskkkkkso...',
  '...ossssssssoo..',
  '..oossssssssooo.',
  '.osossbbbbssoso.',
  '.osossssssssoso.',
  '.okossssssssoko.',
  '..oossssssssoo..',
  '...osss..ssso...',
  '...osss..ssso...',
  '...oooo..oooo...',
];

export const PRESET_COLORS: Record<string, { suit: string; band: string; name: string }> = {
  'ninja-1': { suit: '#3f8f4a', band: '#ffc803', name: 'Moss' },
  'ninja-2': { suit: '#2e1b5b', band: '#ff7fb0', name: 'Dusk' },
  'ninja-3': { suit: '#3b6fd6', band: '#ffffff', name: 'Sky' },
  'ninja-4': { suit: '#8b5ad6', band: '#9ae04c', name: 'Plum' },
};

export function avatarColors(avatar: Avatar): { suit: string; band: string; accessory: string } {
  if (avatar.kind === 'preset') {
    const p = PRESET_COLORS[avatar.preset] ?? PRESET_COLORS['ninja-1']!;
    return { suit: p.suit, band: p.band, accessory: 'none' };
  }
  return { suit: avatar.suit, band: avatar.band, accessory: avatar.accessory };
}

function Accessory({ kind }: { kind: string }) {
  switch (kind) {
    case 'katana':
      return (
        <>
          <rect x="13" y="6" width="1" height="7" fill="#e9edff" />
          <rect x="12.5" y="12" width="2" height="1" fill="#8a5a2b" />
        </>
      );
    case 'staff':
      return <rect x="1" y="3" width="1" height="12" fill="#8a5a2b" />;
    case 'shuriken':
      return (
        <>
          <rect x="13" y="8" width="3" height="1" fill="#c9d2f7" />
          <rect x="14" y="7" width="1" height="3" fill="#c9d2f7" />
          <rect x="14" y="8" width="1" height="1" fill="#2e1b5b" />
        </>
      );
    case 'headphones':
      return (
        <>
          <rect x="3" y="2" width="1" height="4" fill="#2e1b5b" />
          <rect x="12" y="2" width="1" height="4" fill="#2e1b5b" />
          <rect x="2" y="4" width="2" height="2" fill="#ff6fa8" />
          <rect x="12" y="4" width="2" height="2" fill="#ff6fa8" />
        </>
      );
    default:
      return null;
  }
}

export function Ninja({ avatar, size = 64, className = '' }: { avatar: Avatar; size?: number; className?: string }) {
  const c = avatarColors(avatar);
  const skin = '#d8a06c';
  const fill: Record<string, string> = { o: '#2e1b5b', s: c.suit, b: c.band, h: c.band, k: skin, w: '#ffffff' };
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" className={`pixelated block shrink-0 ${className}`}>
      {GRID.flatMap((row, y) =>
        [...row].map((ch, x) => (ch === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={fill[ch]} />)),
      )}
      <Accessory kind={c.accessory} />
    </svg>
  );
}

/** Framed avatar (lilac tile with ink outline), as in the top nav, cards and feed. */
export function AvatarTile({
  avatar,
  size = 48,
  tone = 'lilac',
  className = '',
}: {
  avatar: Avatar;
  size?: number;
  tone?: 'lilac' | 'mist' | 'yellow' | 'white' | 'grass';
  className?: string;
}) {
  const bg = { lilac: 'bg-[#e9ecff]', mist: 'bg-mist', yellow: 'bg-[#fff2b3]', white: 'bg-white', grass: 'bg-[#e8f6d0]' }[tone];
  const pad = Math.round(size * 0.12);
  return (
    <div
      className={`k7-outline inline-flex shrink-0 items-center justify-center rounded-[10px] ${bg} ${className}`}
      style={{ width: size, height: size, padding: pad }}
    >
      <Ninja avatar={avatar} size={size - pad * 2 - 8} />
    </div>
  );
}
