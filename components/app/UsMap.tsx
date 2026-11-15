'use client';
import { geoAlbersUsa, geoPath } from 'd3-geo';
import { useMemo } from 'react';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import statesTopo from 'us-atlas/states-albers-10m.json';
import { Ninja } from '@/components/scene/Ninja';
import type { Avatar, UsState } from '@/lib/types';
import { US_STATES } from '@/lib/types';
import { STATE_NAMES } from '@/lib/us';

// us-atlas "albers" files are pre-projected to this frame; cities use the same projection.
const W = 975;
const H = 610;
const projection = geoAlbersUsa().scale(1300).translate([487.5, 305]);
const NAME_TO_CODE = new Map<string, UsState>(US_STATES.map((s) => [STATE_NAMES[s], s]));

interface StateShape { code: UsState; d: string; centroid: [number, number]; bounds: [[number, number], [number, number]] }

let shapes: StateShape[] | null = null;
function stateShapes(): StateShape[] {
  if (shapes) return shapes;
  const topo = statesTopo as unknown as Topology<{ states: GeometryCollection<{ name: string }> }>;
  const fc = feature(topo, topo.objects.states);
  const path = geoPath(); // identity: the file is already projected
  shapes = fc.features.flatMap((f) => {
    const code = NAME_TO_CODE.get(f.properties.name);
    if (!code) return [];
    return [{ code, d: path(f) ?? '', centroid: path.centroid(f) as [number, number], bounds: path.bounds(f) as [[number, number], [number, number]] }];
  });
  return shapes;
}

export interface MapPin {
  id: string;
  name: string;
  avatar: Avatar;
  state: UsState;
  coords: [number, number] | null; // [lon, lat] of the city, null = somewhere in the state
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Real US map: states colored by how many people are there, people of the selected state as pins in their cities. */
export function UsMap({
  counts,
  selected,
  myState,
  zoomed,
  pins,
  onSelect,
  onPin,
}: {
  counts: Map<UsState, number>;
  selected: UsState;
  myState: UsState;
  zoomed: boolean;
  pins: MapPin[];
  onSelect: (s: UsState) => void;
  onPin?: (id: string) => void;
}) {
  const all = stateShapes();
  const max = Math.max(1, ...counts.values());
  const sel = all.find((s) => s.code === selected);

  // zoom to the selected state (keeps pins readable); k scales the frame, sizes divide by k to stay constant on screen
  const view = useMemo(() => {
    if (!zoomed || !sel) return { k: 1, tx: 0, ty: 0 };
    const [[x0, y0], [x1, y1]] = sel.bounds;
    const k = Math.min(6, 0.75 / Math.max((x1 - x0) / W, (y1 - y0) / H));
    return { k, tx: W / 2 - k * ((x0 + x1) / 2), ty: H / 2 - k * ((y0 + y1) / 2) };
  }, [zoomed, sel]);

  // pins: city coordinates, people in the same city fanned out in a small spiral
  const placed = useMemo(() => {
    const perCity = new Map<string, number>();
    return pins.flatMap((p) => {
      const shape = all.find((s) => s.code === p.state);
      const proj = p.coords ? projection(p.coords) : null;
      const base = proj ?? shape?.centroid;
      if (!base) return [];
      const key = proj ? `${Math.round(base[0])}:${Math.round(base[1])}` : `${p.state}:${hash(p.id) % 7}`;
      const i = perCity.get(key) ?? 0;
      perCity.set(key, i + 1);
      const r = i === 0 ? 0 : 7 + i * 2.2;
      const a = i * 2.4 + (hash(p.id) % 10) / 10;
      return [{ ...p, x: base[0] + (r * Math.cos(a)) / view.k * 1.4, y: base[1] + (r * Math.sin(a)) / view.k * 1.4 }];
    });
  }, [pins, all, view.k]);

  const heat = (n: number) => (n === 0 ? '#eef0fb' : n >= max * 0.6 ? '#ffc803' : n >= max * 0.25 ? '#a6d86a' : '#e1f2c8');
  const s = 1 / view.k; // keep strokes, labels and pins the same size at any zoom

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Map of the United States with people per state">
      <g style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.k})`, transition: 'transform 450ms ease-out' }} className="motion-reduce:transition-none">
        {all.map((st) => {
          const n = counts.get(st.code) ?? 0;
          const isSel = st.code === selected;
          return (
            <path
              key={st.code}
              d={st.d}
              data-testid={`map-tile-${st.code}`}
              role="button"
              tabIndex={0}
              aria-label={`${STATE_NAMES[st.code]}: ${n} ${n === 1 ? 'person' : 'people'}`}
              aria-pressed={isSel}
              onClick={() => onSelect(st.code)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(st.code)}
              fill={isSel ? '#2e1b5b' : heat(n)}
              stroke="#2e1b5b"
              strokeWidth={1.4 * s}
              strokeLinejoin="round"
              className="cursor-pointer outline-none transition-[fill] hover:brightness-95 focus-visible:brightness-90"
            >
              <title>{`${STATE_NAMES[st.code]} · ${n}`}</title>
            </path>
          );
        })}

        {/* count badges */}
        {all.map((st) => {
          const n = counts.get(st.code) ?? 0;
          if (n === 0) return null;
          const isSel = st.code === selected;
          if (zoomed && isSel && placed.length > 0) return null; // the pins tell the story there
          const label = String(n);
          const w = (10 + label.length * 9) * s;
          const h = 18 * s;
          return (
            <g key={`b-${st.code}`} transform={`translate(${st.centroid[0]} ${st.centroid[1]})`} pointerEvents="none">
              <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4 * s} fill={isSel ? '#ffc803' : '#ffffff'} stroke="#2e1b5b" strokeWidth={2 * s} />
              <text y={5 * s} textAnchor="middle" fontSize={13 * s} fontWeight={700} fill="#2e1b5b" fontFamily="var(--font-body)">
                {label}
              </text>
              {st.code === myState && !isSel ? <circle cx={w / 2} cy={-h / 2} r={4 * s} fill="#ff6fa8" stroke="#2e1b5b" strokeWidth={1.5 * s} /> : null}
            </g>
          );
        })}

        {/* people of the selected state */}
        {zoomed
          ? placed.map((p) => (
              // position via the SVG attribute on the outer group; the pop-in animation lives on the inner one
              // (a CSS transform animation would override the transform attribute and send every pin to 0,0)
              <g
                key={p.id}
                transform={`translate(${p.x} ${p.y}) scale(${s})`}
                role="button"
                tabIndex={0}
                aria-label={`${p.name}${p.coords ? '' : ' (somewhere in the state)'}`}
                onClick={() => onPin?.(p.id)}
                onKeyDown={(e) => e.key === 'Enter' && onPin?.(p.id)}
                className="cursor-pointer"
                data-testid={`map-pin-${p.id}`}
              >
                <g className="k7-pin">
                  <circle r={15} fill="#e8f6d0" stroke="#2e1b5b" strokeWidth={3} />
                  <g transform="translate(-11 -12)">
                    <Ninja avatar={p.avatar} size={22} />
                  </g>
                </g>
                <title>{p.name}</title>
              </g>
            ))
          : null}
      </g>
    </svg>
  );
}
