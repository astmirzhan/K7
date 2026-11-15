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

// Accessories are small sprites with an ink outline, drawn on top of the ninja. They may stick out of the
// 16 x 16 grid a little (the svg has overflow visible), like a sword held at the side.
// Palette: o ink · s steel · S steel shade · g gold · h handle · w wood · W wood knot · k skin · p cushion
const ACC_COLORS: Record<string, string> = {
  o: '#2e1b5b', s: '#e4e9f7', S: '#9aa4c7', g: '#ffc803', h: '#5a3a1a', w: '#b07a3e', W: '#6b4420', k: '#d8a06c', p: '#ff6fa8',
};
type Sprite = { x: number; y: number; rows: string[] };
export const ACCESSORY_SPRITES: Record<string, Sprite> = {
  // blade up, guard and grip in the right hand
  katana: {
    x: 14, y: -1,
    rows: ['..o..', '.oso.', '.oso.', '.oso.', '.oso.', '.oso.', '.oSo.', '.oSo.', '.oSo.', 'ogggo', '.oho.', 'kkho.', 'kkho.', '.oho.', '..o..'],
  },
  // tall wooden staff in the left hand
  staff: {
    x: -3, y: -1,
    rows: ['.o..', 'owo.', 'owo.', 'oWo.', 'owo.', 'owo.', 'owo.', 'oWo.', 'owo.', 'owo.', 'owo.', 'owkk', 'owkk', 'owo.', 'oWo.', 'owo.', '.o..'],
  },
  // throwing star next to the right hand
  shuriken: {
    x: 14, y: 6,
    rows: ['...o...', '..oso..', '.osSso.', 'osSoSso', '.osSso.', '..oso..', '...o...'],
  },
  // band over the head, cushions over the ears
  headphones: {
    x: 2, y: -1,
    rows: ['..oooooooo..', '.o........o.', '.o........o.', '.o........o.', 'opp......ppo', 'opp......ppo', '.oo......oo.'],
  },
};

function Accessory({ kind }: { kind: string }) {
  const sprite = ACCESSORY_SPRITES[kind];
  if (!sprite) return null;
  return (
    <>
      {sprite.rows.flatMap((row, dy) =>
        [...row].map((ch, dx) =>
          ch === '.' ? null : (
            <rect key={`a${dx}-${dy}`} x={sprite.x + dx} y={sprite.y + dy} width="1" height="1" fill={ACC_COLORS[ch]} />
          ),
        ),
      )}
    </>
  );
}

export function Ninja({ avatar, size = 64, className = '' }: { avatar: Avatar; size?: number; className?: string }) {
  const c = avatarColors(avatar);
  const skin = '#d8a06c';
  const fill: Record<string, string> = { o: '#2e1b5b', s: c.suit, b: c.band, h: c.band, k: skin, w: '#ffffff' };
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" overflow="visible" className={`pixelated block shrink-0 overflow-visible ${className}`}>
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
