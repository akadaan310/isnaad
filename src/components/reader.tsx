'use client';
// ============================================================================
//  Pane 2 — the muṣḥaf, with the isnād laid over it.
//
//  Colour never fills the box behind a word: Uthmani script carries marks well
//  above and below the baseline, and a solid highlight swallows them. The
//  attribution is carried by an underline and a very low tint instead, so the
//  text stays the text.
// ============================================================================
import * as React from 'react';
import { Layers, CornerDownLeft, Quote } from 'lucide-react';
import type { Ayah, Segment, Word } from '@/lib/types';
import { describeSegment, PERSON_AR, ROLE_AR, TENSE_AR, VERB_FORM_AR } from '@/lib/morphology';
import { PERSON_STYLE, KHALQ_HEX, ROLE_TONE } from '@/lib/view';
import { arabicNumber, cn } from '@/lib/utils';
import { Badge } from './ui';

export type Overlay = 'isnad' | 'khalq' | 'depth' | 'none';

export interface ReaderProps {
  ayaat: Ayah[];
  words: Word[];
  seamAt: Set<number>;
  overlay: Overlay;
  showSeams: boolean;
  /** Āyāt outside the proximity range are dimmed rather than hidden. */
  inRange: (a: Ayah) => boolean;
  span: { from: number; to: number; seam?: number } | null;
  activeAyah: number;
  selected: number | null;
  onSelectWord: (idx: number | null) => void;
  onActivateAyah: (n: number) => void;
  /** Uthmani source text instead of the segment-joined reconstruction. */
  mushafText: boolean;
}

const DEPTH_TINT = ['transparent', 'rgba(200,164,92,0.05)', 'rgba(200,164,92,0.1)', 'rgba(200,164,92,0.16)', 'rgba(200,164,92,0.22)'];

export function Reader({
  ayaat,
  words,
  seamAt,
  overlay,
  showSeams,
  inRange,
  span,
  activeAyah,
  selected,
  onSelectWord,
  onActivateAyah,
  mushafText,
}: ReaderProps) {
  const [hover, setHover] = React.useState<number | null>(null);
  const anchor = React.useRef<HTMLDivElement>(null);

  const shown = hover ?? selected;
  const shownWord = shown !== null ? words[shown] : null;

  return (
    <div className="relative" ref={anchor}>
      {ayaat.map((a) => {
        const dim = !inRange(a);
        const active = a.n === activeAyah;
        return (
          <div
            key={a.n}
            id={`ayah-${a.n}`}
            onClick={() => onActivateAyah(a.n)}
            className={cn(
              'group relative rounded-xl px-3 py-3 transition-all duration-300',
              active && 'bg-white/[0.035] ring-1 ring-gold/20',
              dim && 'opacity-25 saturate-50',
            )}
          >
            <div className="mb-1 flex items-center gap-2">
              <span
                className={cn(
                  'flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[0.6rem] font-semibold tabular-nums',
                  active ? 'bg-gold/25 text-gold' : 'bg-white/[0.06] text-muted-foreground',
                )}
              >
                {arabicNumber(a.n)}
              </span>
              {a.dominant && (
                <span
                  className="text-[0.6rem] font-medium"
                  style={{ color: PERSON_STYLE[a.dominant].soft }}
                >
                  {PERSON_STYLE[a.dominant].label}
                </span>
              )}
              {a.clock.bridge > 0.55 && (
                <Badge tone="gold">
                  <CornerDownLeft className="h-2.5 w-2.5" />
                  جسرٌ إلى الحاضر
                </Badge>
              )}
            </div>

            {mushafText && a.uthmani ? (
              <p className="quran text-right text-[1.65rem] text-foreground/90">{a.uthmani}</p>
            ) : (
              <p className="quran text-right text-[1.65rem]">
                {words.slice(a.from, a.to).map((w) => (
                  <WordSpan
                    key={w.idx}
                    w={w}
                    overlay={overlay}
                    isSeam={showSeams && seamAt.has(w.idx)}
                    inSpan={!!span && w.idx >= span.from && w.idx <= span.to}
                    isSeamOfSpan={span?.seam === w.idx}
                    selected={selected === w.idx}
                    onHover={setHover}
                    onSelect={onSelectWord}
                  />
                ))}
              </p>
            )}
          </div>
        );
      })}

      {shownWord && <WordCard w={shownWord} />}
    </div>
  );
}

function WordSpan({
  w,
  overlay,
  isSeam,
  inSpan,
  isSeamOfSpan,
  selected,
  onHover,
  onSelect,
}: {
  w: Word;
  overlay: Overlay;
  isSeam: boolean;
  inSpan: boolean;
  isSeamOfSpan: boolean;
  selected: boolean;
  onHover: (i: number | null) => void;
  onSelect: (i: number | null) => void;
}) {
  const style: React.CSSProperties = {};
  let cls = '';

  if (overlay === 'isnad' && w.person) {
    style.textDecoration = 'underline';
    style.textDecorationColor = PERSON_STYLE[w.person].hex;
    style.textDecorationThickness = '2px';
    style.textUnderlineOffset = '0.34em';
    style.backgroundColor = `${PERSON_STYLE[w.person].hex}14`;
  } else if (overlay === 'khalq') {
    if (w.khalq) {
      style.textDecoration = 'underline';
      style.textDecorationColor = KHALQ_HEX;
      style.textDecorationThickness = w.khalq.speech ? '3px' : '2px';
      style.textUnderlineOffset = '0.34em';
      style.backgroundColor = `${KHALQ_HEX}1f`;
    } else {
      cls = 'opacity-35';
    }
  } else if (overlay === 'depth') {
    style.backgroundColor = DEPTH_TINT[Math.min(w.depth, DEPTH_TINT.length - 1)];
  }

  if (inSpan) style.backgroundColor = 'rgba(200,164,92,0.12)';
  if (isSeamOfSpan) {
    style.backgroundColor = 'rgba(200,164,92,0.28)';
    style.boxShadow = '0 0 0 1px rgba(200,164,92,0.5)';
  }

  return (
    <>
      <span
        className={cn(
          'w',
          cls,
          isSeam && 'w-seam',
          selected && 'ring-1 ring-white/40',
          'hover:bg-white/10',
        )}
        style={style}
        onMouseEnter={() => onHover(w.idx)}
        onMouseLeave={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(selected ? null : w.idx);
        }}
      >
        {w.text}
      </span>{' '}
    </>
  );
}

/**
 * The floating morphology card. Pinned to the bottom of the reader rather than
 * following the cursor: Arabic lines wrap densely, and a tooltip that chases
 * the pointer through them covers the words either side of the one being read.
 */
function WordCard({ w }: { w: Word }) {
  const stem = w.segments.find((s) => !s.clitic && (s.root || s.lemma)) ?? w.segments[0];
  const verb = w.segments.find((s) => s.cls === 'V');

  return (
    <div className="pointer-events-none sticky bottom-2 z-20 mt-3 animate-fade-up">
      <div className="rounded-xl glass-strong p-3 shadow-2xl shadow-black/50">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <span className="quran text-[1.7rem] leading-tight">{w.text}</span>

          {stem?.root && (
            <span className="flex items-baseline gap-1 text-[0.7rem] text-muted-foreground">
              الجذر
              <b className="quran text-[1.15rem] tracking-[0.22em] text-gold">{stem.root}</b>
            </span>
          )}
          {stem?.lemma && (
            <span className="flex items-baseline gap-1 text-[0.7rem] text-muted-foreground">
              المادّة
              <b className="quran text-[1.05rem] text-foreground/80">{stem.lemma}</b>
            </span>
          )}
          {verb?.vf && VERB_FORM_AR[verb.vf] && (
            <span className="flex items-baseline gap-1 text-[0.7rem] text-muted-foreground">
              الوزن
              <b className="quran text-[1.05rem] text-foreground/80">{VERB_FORM_AR[verb.vf]}</b>
            </span>
          )}
          {w.depth > 0 && (
            <Badge tone="gold">
              <Quote className="h-2.5 w-2.5" />
              داخل القول · الطبقة {arabicNumber(w.depth)}
            </Badge>
          )}
          {w.khalq && (
            <Badge tone="khalq">
              <Layers className="h-2.5 w-2.5" />
              {w.khalq.label}
              {w.khalq.speech && ' · ناطق'}
            </Badge>
          )}
        </div>

        {/* the isnād trajectory of this single word */}
        <div className="mt-2.5 border-t border-white/[0.07] pt-2">
          {w.person ? (
            <p className="mb-2 text-[0.72rem]">
              <span className="text-muted-foreground">مقعد الإسناد: </span>
              <b style={{ color: PERSON_STYLE[w.person].soft }}>{PERSON_AR[w.person]}</b>
              {w.role && <span className="text-muted-foreground"> — {ROLE_AR[w.role]}</span>}
              {w.tense && <span className="text-muted-foreground"> · {TENSE_AR[w.tense]}</span>}
            </p>
          ) : (
            <p className="mb-2 text-[0.72rem] text-muted-foreground">
              لا إسناد في هذه الكلمة — {w.refs.length ? 'فيها إحالةٌ فقط' : 'ولا إحالة'}
            </p>
          )}

          <div className="flex flex-wrap gap-1">
            {w.segments.map((s, i) => (
              <SegmentChip key={i} s={s} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SegmentChip({ s }: { s: Segment }) {
  const tone = s.role ? ROLE_TONE[s.role] : undefined;
  const hex = s.person ? PERSON_STYLE[s.person].hex : undefined;
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1.5 rounded-md border px-1.5 py-0.5',
        s.person ? '' : 'border-white/[0.08] bg-white/[0.02]',
      )}
      style={
        s.person
          ? {
              borderColor: `${hex}55`,
              background: `${hex}12`,
              // A subject office is the isnād itself; a reference merely points.
              borderStyle: tone === 'reference' ? 'dashed' : 'solid',
            }
          : undefined
      }
    >
      <b className="quran text-[1rem]">{s.form || '—'}</b>
      <span className="text-[0.62rem] text-muted-foreground">{describeSegment(s)}</span>
      {s.role && (
        <span className="text-[0.6rem]" style={{ color: hex }}>
          {ROLE_AR[s.role]}
        </span>
      )}
    </span>
  );
}
