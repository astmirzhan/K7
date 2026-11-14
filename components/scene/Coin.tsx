// Pixel coin (yellow with ink outline and a white slit), used in badges, headers and bursts.
const ROWS = [
  '...####...',
  '..#yyyy#..',
  '.#yyyyyy#.',
  '#yyywwyyy#',
  '#yyywwyyy#',
  '#yyywwyyy#',
  '#yyywwyyy#',
  '.#yyyyyy#.',
  '..#yyyy#..',
  '...####...',
];
const COLORS: Record<string, string> = { '#': '#2e1b5b', y: '#ffc803', w: '#fff7cc' };

export function Coin({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 10 10" width={size} height={size} aria-hidden="true" className={`pixelated inline-block shrink-0 ${className}`}>
      {ROWS.flatMap((row, y) =>
        [...row].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={COLORS[c]} />)),
      )}
    </svg>
  );
}
