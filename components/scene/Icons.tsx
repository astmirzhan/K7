// Small pixel icons used across the design: lock, flag, camera, check, people, plus, cross.
type P = { size?: number; className?: string; color?: string };

function Px({ rows, colors, size = 16, className = '' }: { rows: string[]; colors: Record<string, string>; size?: number; className?: string }) {
  const w = rows[0]!.length;
  const h = rows.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={size} height={(size / w) * h} aria-hidden="true" className={`pixelated inline-block shrink-0 ${className}`}>
      {rows.flatMap((row, y) =>
        [...row].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={colors[c]} />)),
      )}
    </svg>
  );
}

export const LockIcon = ({ size = 16, className, color = '#2e1b5b' }: P) => (
  <Px
    size={size}
    className={className}
    colors={{ '#': color }}
    rows={['..####..', '.#....#.', '.#....#.', '########', '########', '###..###', '###..###', '########']}
  />
);

export const FlagIcon = ({ size = 16, className, color = '#2e1b5b' }: P) => (
  <Px
    size={size}
    className={className}
    colors={{ '#': color }}
    rows={['#.......', '######..', '#######.', '#######.', '######..', '#.......', '#.......', '#.......']}
  />
);

export const CameraIcon = ({ size = 20, className, color = '#2e1b5b' }: P) => (
  <Px
    size={size}
    className={className}
    colors={{ '#': color, w: '#fff' }}
    rows={['...###......', '############', '#....####..#', '#...#wwww..#', '#...#w..#..#', '#...#wwww..#', '#....####..#', '############']}
  />
);

export const CheckIcon = ({ size = 14, className, color = '#2e1b5b' }: P) => (
  <Px size={size} className={className} colors={{ '#': color }} rows={['......#', '.....##', '#...##.', '##.##..', '.###...', '..#....']} />
);

export const PeopleIcon = ({ size = 16, className, color = '#2e1b5b' }: P) => (
  <Px
    size={size}
    className={className}
    colors={{ '#': color }}
    rows={['.##...##.', '.##...##.', '.........', '####.####', '####.####', '####.####']}
  />
);

export const PlusIcon = ({ size = 24, className, color = '#2e1b5b' }: P) => (
  <Px size={size} className={className} colors={{ '#': color }} rows={['...##...', '...##...', '...##...', '########', '########', '...##...', '...##...', '...##...']} />
);

export const CrossIcon = ({ size = 14, className, color = '#2e1b5b' }: P) => (
  <Px size={size} className={className} colors={{ '#': color }} rows={['#.....#', '##...##', '.##.##.', '..###..', '.##.##.', '##...##', '#.....#']} />
);

export const ArrowIcon = ({ size = 14, className, color = '#2e1b5b' }: P) => (
  <Px size={size} className={className} colors={{ '#': color }} rows={['....#..', '.....#.', '#######', '.....#.', '....#..']} />
);
