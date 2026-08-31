'use client';
// ============================================================================
//  رادار الالتفات — the isnād trajectory.
//
//  One point per isnād-bearing word, plotted on the proximity axis: المتكلم
//  rides high, المخاطب sits at the centre line, الغائب drops low. Words with
//  no attribution are transparent to the line, because الالتفات is a turn
//  between attributions and not between tokens.
//
//  The line is drawn as a step-and-ease rather than a smooth spline: a shift
//  in person is a discontinuity, and smoothing it into a gentle curve would
//  draw the one thing the reader is here to see as though it were gradual.
// ============================================================================
import * as React from 'react';
import type { Word } from '@/lib/types';
import type { Seam } from '@/lib/isnad';
import { PERSON_STYLE, GOLD_HEX } from '@/lib/view';
import { arabicNumber, cn } from '@/lib/utils';

const H = 116;
const PAD_Y = 16;

/** المتكلم high, المخاطب mid, الغائب low. */
const Y_OF: Record<number, number> = {
  1: PAD_Y,
  2: H / 2,
  3: H - PAD_Y,
};

export interface WaveformProps {
  words: Word[];
  seams: Seam[];
  /** Word index the reader is currently looking at. */
  focus: number | null;
  /** Highlighted span from a selected discovery, if any. */
  span: { from: number; to: number; seam?: number } | null;
  onPick: (wordIdx: number) => void;
  ayahOf: (wordIdx: number) => number;
}

export function Waveform({ words, seams, focus, span, onPick, ayahOf }: WaveformProps) {
  const spine = React.useMemo(() => words.filter((w) => w.person !== null), [words]);
  const [hover, setHover] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  // Width scales with the sūrah so long ones stay legible under scroll.
  const W = Math.max(760, spine.length * 7);
  const x = React.useCallback(
    (i: number) => (spine.length <= 1 ? W / 2 : (i / (spine.length - 1)) * (W - 24) + 12),
    [spine.length, W],
  );

  const path = React.useMemo(() => {
    if (!spine.length) return '';
    const pts = spine.map((w, i) => [x(i), Y_OF[w.person!]] as const);
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = pts[i - 1];
      const [cx, cy] = pts[i];
      if (py === cy) {
        d += ` L ${cx} ${cy}`;
      } else {
        // Hold the old level, then turn hard: the seam should read as a cliff.
        const mid = px + (cx - px) * 0.62;
        d += ` L ${mid} ${py} C ${mid + (cx - mid) * 0.4} ${py}, ${mid + (cx - mid) * 0.6} ${cy}, ${cx} ${cy}`;
      }
    }
    return d;
  }, [spine, x]);

  const area = path ? `${path} L ${x(spine.length - 1)} ${H} L ${x(0)} ${H} Z` : '';

  const seamPoints = React.useMemo(() => {
    const idxOf = new Map(spine.map((w, i) => [w.idx, i]));
    return seams
      .map((s) => {
        const i = idxOf.get(s.at);
        return i === undefined ? null : { s, i };
      })
      .filter((v): v is { s: Seam; i: number } => v !== null);
  }, [seams, spine]);

  const focusIdx = React.useMemo(() => {
    if (focus === null) return null;
    let best: number | null = null;
    let bestDist = Infinity;
    spine.forEach((w, i) => {
      const d = Math.abs(w.idx - focus);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }, [focus, spine]);

  if (!spine.length) {
    return (
      <div className="flex h-24 items-center justify-center text-[0.72rem] text-muted-foreground">
        لا مواضع إسناد في هذه السورة
      </div>
    );
  }

  const hovered = hover !== null ? spine[hover] : null;

  return (
    <div className="relative">
      <div className="overflow-x-auto thin-scroll" dir="ltr">
        <svg
          ref={svgRef}
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block"
          role="img"
          aria-label="رادار الالتفات: مسار الإسناد عبر السورة"
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="wf-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PERSON_STYLE[1].hex} stopOpacity="0.3" />
              <stop offset="50%" stopColor={PERSON_STYLE[2].hex} stopOpacity="0.14" />
              <stop offset="100%" stopColor={PERSON_STYLE[3].hex} stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="wf-line" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PERSON_STYLE[1].soft} />
              <stop offset="50%" stopColor={PERSON_STYLE[2].soft} />
              <stop offset="100%" stopColor={PERSON_STYLE[3].soft} />
            </linearGradient>
          </defs>

          {/* the three stations of the axis */}
          {([1, 2, 3] as const).map((p) => (
            <g key={p}>
              <line
                x1={0}
                y1={Y_OF[p]}
                x2={W}
                y2={Y_OF[p]}
                stroke={PERSON_STYLE[p].hex}
                strokeOpacity={0.16}
                strokeWidth={1}
                strokeDasharray={p === 2 ? '0' : '3 5'}
              />
            </g>
          ))}

          {/* the discovery span under inspection */}
          {span && (
            <rect
              x={x(spine.findIndex((w) => w.idx >= span.from))}
              y={0}
              width={Math.max(
                4,
                x(
                  Math.max(
                    0,
                    spine.findLastIndex
                      ? spine.findLastIndex((w) => w.idx <= span.to)
                      : spine.length - 1,
                  ),
                ) - x(spine.findIndex((w) => w.idx >= span.from)),
              )}
              height={H}
              fill={GOLD_HEX}
              fillOpacity={0.09}
            />
          )}

          <path d={area} fill="url(#wf-area)" />
          <path
            d={path}
            fill="none"
            stroke="url(#wf-line)"
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.92}
          />

          {/* every turn of the attribution */}
          {seamPoints.map(({ s, i }) => (
            <g key={s.at}>
              <line
                x1={x(i)}
                y1={Y_OF[s.from]}
                x2={x(i)}
                y2={Y_OF[s.to]}
                stroke={GOLD_HEX}
                strokeOpacity={span?.seam === s.at ? 0.9 : 0.34}
                strokeWidth={span?.seam === s.at ? 1.8 : 1}
              />
              <circle
                cx={x(i)}
                cy={Y_OF[s.to]}
                r={span?.seam === s.at ? 3.6 : 2}
                fill={GOLD_HEX}
                opacity={span?.seam === s.at ? 1 : 0.6}
              />
            </g>
          ))}

          {/* where the reader is standing */}
          {focusIdx !== null && (
            <line
              x1={x(focusIdx)}
              y1={0}
              x2={x(focusIdx)}
              y2={H}
              stroke="#fff"
              strokeOpacity={0.4}
              strokeWidth={1}
            />
          )}

          {hover !== null && (
            <circle
              cx={x(hover)}
              cy={Y_OF[spine[hover].person!]}
              r={4}
              fill={PERSON_STYLE[spine[hover].person!].soft}
            />
          )}

          {/* one hit target per point, wide enough to actually catch a cursor */}
          {spine.map((w, i) => (
            <rect
              key={w.idx}
              x={x(i) - 3.5}
              y={0}
              width={7}
              height={H}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHover(i)}
              onClick={() => onPick(w.idx)}
            />
          ))}
        </svg>
      </div>

      {/* axis legend, pinned outside the scroll area */}
      <div className="pointer-events-none absolute right-1 top-0 flex h-full flex-col justify-between py-[10px]">
        {([1, 2, 3] as const).map((p) => (
          <span
            key={p}
            className="rounded bg-background/75 px-1 text-[0.6rem] font-medium backdrop-blur-sm"
            style={{ color: PERSON_STYLE[p].soft }}
          >
            {PERSON_STYLE[p].short}
          </span>
        ))}
      </div>

      {hovered && (
        <div className="pointer-events-none absolute -top-1 left-2 rounded-md glass-strong px-2 py-1 text-[0.68rem]">
          <span className="quran ml-1.5 text-[0.95rem]">{hovered.text}</span>
          <span style={{ color: PERSON_STYLE[hovered.person!].soft }}>
            {PERSON_STYLE[hovered.person!].label}
          </span>
          <span className="mr-1.5 text-muted-foreground">
            آية {arabicNumber(ayahOf(hovered.idx))}
          </span>
        </div>
      )}
    </div>
  );
}

/** Compact per-āyah sparkline used in the resonance and chamber lists. */
export function MiniContour({
  vec,
  className,
}: {
  vec: { p1: number; p2: number; p3: number };
  className?: string;
}) {
  const total = vec.p1 + vec.p2 + vec.p3 || 1;
  const parts = [
    { v: vec.p1 / total, hex: PERSON_STYLE[1].hex },
    { v: vec.p2 / total, hex: PERSON_STYLE[2].hex },
    { v: vec.p3 / total, hex: PERSON_STYLE[3].hex },
  ];
  return (
    <div className={cn('flex h-1 w-full overflow-hidden rounded-full bg-white/5', className)}>
      {parts.map((p, i) => (
        <div key={i} style={{ width: `${p.v * 100}%`, background: p.hex }} />
      ))}
    </div>
  );
}
