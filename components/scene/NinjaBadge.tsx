// Ninja badges for finished levels (Figma "Badges & sharing"): bronze = easy, silver = medium, gold = hard.
// Drawn in code: medal ring with studs, navy disc with crossed katanas over the K7 "N", label plate and ribbon tails.
import type { Difficulty } from '@/lib/types';

export const BADGES = {
  1: { title: 'Bronze Ninja', label: 'EASY', ring: '#c98a52', dark: '#7a4a22', blade: '#f0c48e', plate: '#7a4a22', text: '#f6d3a5', name: '#c98a52' },
  3: { title: 'Silver Ninja', label: 'MEDIUM', ring: '#c9d2e3', dark: '#7d8aa3', blade: '#f3f6fb', plate: '#7d8aa3', text: '#e8edf6', name: '#a9b4cb' },
  5: { title: 'Gold Ninja', label: 'HARD', ring: '#f2b93b', dark: '#8a6420', blade: '#fbe08a', plate: '#8a6420', text: '#fbe08a', name: '#e2a82a' },
} as const satisfies Record<Difficulty, Record<string, string>>;

const LOCKED = { ring: '#dfe3f5', dark: '#a7b2ec', blade: '#c9d1f4', plate: '#a7b2ec', text: '#5b4f8f' };

export function NinjaBadge({ difficulty, earned, size = 120 }: { difficulty: Difficulty; earned: boolean; size?: number }) {
  const c = earned ? BADGES[difficulty] : { ...LOCKED, label: BADGES[difficulty].label };
  const ink = '#2e1b5b';
  const studs = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return { x: 50 + Math.cos(a) * 38 - 2.5, y: 48 + Math.sin(a) * 38 - 2.5 };
  });
  return (
    <svg viewBox="0 0 100 112" width={size} height={(size * 112) / 100} role="img" aria-label={earned ? `${BADGES[difficulty].title} badge` : `${c.label.toLowerCase()} badge, locked`} className="pixelated block">
      {/* ribbon tails */}
      <polygon points="30,78 50,86 44,108 38,100 26,104" fill={c.dark} stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
      <polygon points="70,78 50,86 56,108 62,100 74,104" fill={c.ring} stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
      {/* medal ring + studs */}
      <circle cx="50" cy="48" r="44" fill={c.ring} stroke={ink} strokeWidth="4" />
      {studs.map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width="5" height="5" fill={c.dark} />
      ))}
      {/* navy disc */}
      <circle cx="50" cy="48" r="30" fill="#1e2f5a" stroke={c.dark} strokeWidth="3" />
      {/* pixel N */}
      <g fill={earned ? c.blade : '#e9edfb'}>
        <rect x="35" y="33" width="7" height="27" />
        <rect x="58" y="33" width="7" height="27" />
        <rect x="42" y="37" width="5" height="7" />
        <rect x="46" y="43" width="5" height="7" />
        <rect x="51" y="49" width="5" height="7" />
      </g>
      {/* crossed katanas */}
      <g transform="rotate(45 50 48)">
        <rect x="47.5" y="20" width="5" height="44" fill={c.blade} stroke={ink} strokeWidth="1.2" />
        <rect x="44" y="30" width="12" height="4" fill={c.dark} stroke={ink} strokeWidth="1" />
        <rect x="48" y="20" width="4" height="10" fill={c.dark} />
      </g>
      <g transform="rotate(-45 50 48)">
        <rect x="47.5" y="20" width="5" height="44" fill={c.blade} stroke={ink} strokeWidth="1.2" />
        <rect x="44" y="30" width="12" height="4" fill={c.dark} stroke={ink} strokeWidth="1" />
        <rect x="48" y="20" width="4" height="10" fill={c.dark} />
      </g>
      {!earned ? (
        <text x="50" y="57" textAnchor="middle" fontSize="26" fontWeight="700" fill="#5b4f8f" fontFamily="var(--font-display)">
          ?
        </text>
      ) : null}
      {/* label plate */}
      <rect x="27" y="67" width="46" height="13" rx="2" fill={c.plate} stroke={ink} strokeWidth="2.5" />
      <text x="50" y="77" textAnchor="middle" fontSize="9" fill={c.text} fontFamily="var(--font-label)" letterSpacing="0.5">
        {c.label}
      </text>
    </svg>
  );
}
