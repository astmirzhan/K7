// Scene/Pipe from the design: 96 × 320 pixel pipe, 4px ink outline. Flip it to hang from the top.
export function Pipe({
  height = 320,
  width = 96,
  hanging = false,
  className = '',
}: {
  height?: number;
  width?: number;
  hanging?: boolean;
  className?: string;
}) {
  const w = 96;
  const h = Math.max(80, Math.round((height / width) * 96));
  const cap = 40;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={width}
      height={height}
      aria-hidden="true"
      className={`pixelated block ${className}`}
      style={hanging ? { transform: 'scaleY(-1)' } : undefined}
    >
      {/* body */}
      <rect x="8" y={cap - 4} width="80" height={h - cap + 4} fill="#2e1b5b" />
      <rect x="12" y={cap} width="72" height={h - cap} fill="#86c46a" />
      <rect x="20" y={cap} width="12" height={h - cap} fill="#c8ee9a" />
      <rect x="32" y={cap} width="8" height={h - cap} fill="#a6d86a" />
      <rect x="68" y={cap} width="16" height={h - cap} fill="#4c8c4a" />
      {/* cap */}
      <rect x="0" y="0" width="96" height={cap} fill="#2e1b5b" />
      <rect x="4" y="4" width="88" height={cap - 8} fill="#86c46a" />
      <rect x="12" y="4" width="16" height={cap - 8} fill="#c8ee9a" />
      <rect x="28" y="4" width="8" height={cap - 8} fill="#a6d86a" />
      <rect x="72" y="4" width="20" height={cap - 8} fill="#4c8c4a" />
    </svg>
  );
}
