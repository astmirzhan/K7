// Pixel cloud from Scene/Flappy. Two sizes used in the design.
const ROWS = [
  '......####......',
  '....########....',
  '..############..',
  '################',
  '################',
];

export function Cloud({ width = 160, className = '' }: { width?: number; className?: string }) {
  const cell = 1;
  const cols = ROWS[0]!.length;
  const rects: React.ReactNode[] = [];
  ROWS.forEach((row, y) => {
    let start = -1;
    for (let x = 0; x <= row.length; x++) {
      const on = x < row.length && row[x] === '#';
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        rects.push(<rect key={`${y}-${start}`} x={start * cell} y={y * cell} width={(x - start) * cell} height={cell} fill="#fff" />);
        start = -1;
      }
    }
  });
  // soft lilac underside like the design
  rects.push(<rect key="shade" x="0" y={ROWS.length - 1} width={cols} height="1" fill="#e9edff" />);
  return (
    <svg
      viewBox={`0 0 ${cols} ${ROWS.length}`}
      width={width}
      height={(width / cols) * ROWS.length}
      aria-hidden="true"
      className={`pixelated block ${className}`}
    >
      {rects}
    </svg>
  );
}
