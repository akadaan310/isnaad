'use client';
// ============================================================================
//  القَطْع — the threshold a finding stands on.
//
//  A discovery is not a fact about an āyah. It is the output of a detector
//  whose configuration is a set of numbers, and until now those numbers were
//  invisible, which let a drawn line read as something the text simply
//  contains. Moving them makes findings appear and vanish, and that is the
//  point: the reader should see the cut being made.
//
//  Two scopes, and the panel keeps them apart because they are not the same
//  claim:
//
//    الحقل    a filter over findings already mined. Exact — every finding
//             carries its score — but it can only remove. The index was
//             truncated, so below its floor there is nothing to recover and
//             the control says so rather than sliding over empty range.
//
//    السورة   a real re-derivation. /api/surah/[id] re-runs every detector over
//             the focused sūrah at these thresholds, in about 80 ms. Here
//             stitchWindow and echoWindow mean something, because here the
//             engine is actually looking again.
// ============================================================================
import * as React from 'react';
import { Loader2, Scissors } from 'lucide-react';
import type { FieldCoverage } from '@/lib/cosmos/coverage';
import { arabicDecimal, arabicNumber, cn } from '@/lib/utils';
import type { CutState, Derivation } from './use-strands';

/** The bounds `optionsFromQuery` clamps to, mirrored so the UI cannot exceed them. */
const BOUNDS = {
  minScore: { min: 0, max: 0.95, step: 0.01 },
  stitchWindow: { min: 2, max: 40, step: 1 },
  echoWindow: { min: 4, max: 80, step: 1 },
} as const;

export function DetectorCut({
  cut,
  setCut,
  coverage,
  cutAway,
  derivation,
}: {
  cut: CutState;
  setCut: (c: CutState) => void;
  coverage: FieldCoverage | null;
  cutAway: number;
  derivation: Derivation | null;
}) {
  const floor = coverage?.discoveryFloor ?? 0;
  const minedAt = coverage?.minedAt.minScore;
  const belowFloor = cut.minScore < floor;

  return (
    <div className="w-48 rounded-xl border border-white/[0.07] bg-black/40 p-2 backdrop-blur-sm">
      <p className="mb-1.5 flex items-center gap-1 text-[0.58rem] tracking-wider text-gold/70">
        <Scissors className="h-3 w-3" />
        القَطْع — حدُّ الاستنباط
        {derivation?.pending && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      </p>

      <p className="mb-2 text-[0.5rem] leading-snug text-muted-foreground/70">
        الاستنباط نتيجةُ كاشفٍ عند حدٍّ، لا واقعةٌ ثابتة. حرِّك الحدَّ يظهرْ ويختفِ.
      </p>

      <Dial
        label="أدنى درجة"
        field="minScore"
        value={cut.minScore}
        display={arabicDecimal(cut.minScore, 2)}
        onChange={(v) => setCut({ ...cut, minScore: v })}
      />
      <Dial
        label="نافذة الرِّباط"
        field="stitchWindow"
        value={cut.stitchWindow}
        display={`${arabicNumber(cut.stitchWindow)} كلمة`}
        onChange={(v) => setCut({ ...cut, stitchWindow: v })}
      />
      <Dial
        label="نافذة رجع الجذر"
        field="echoWindow"
        value={cut.echoWindow}
        display={`${arabicNumber(cut.echoWindow)} كلمة`}
        onChange={(v) => setCut({ ...cut, echoWindow: v })}
      />

      {/* ── scope 1: the field, filtered ── */}
      <div className="mt-2 border-t border-white/[0.06] pt-2">
        <p className="text-[0.5rem] leading-snug text-muted-foreground/80">
          <span className="text-gold/80">الحقل</span> — تصفيةٌ لما استُخرج سلفًا.{' '}
          {cutAway > 0
            ? `حُجب ${arabicNumber(cutAway)} خيطَ استنباط.`
            : 'لم يُحجب شيء.'}
        </p>
        {coverage && (
          <p
            className={cn(
              'mt-1 text-[0.5rem] leading-snug',
              belowFloor ? 'text-[#FCA5A5]' : 'text-muted-foreground/60',
            )}
          >
            {belowFloor
              ? `أدنى درجةٍ في فهرس الحقل ${arabicDecimal(floor, 3)}؛ ما دونها ليس فيه أصلًا، ` +
                `فالخفضُ هنا لا يُظهر شيئًا — انظر السورة.`
              : `قاع الفهرس ${arabicDecimal(floor, 3)}` +
                (minedAt !== undefined ? ` (عُدِّن المحرّكُ على ${arabicDecimal(minedAt, 2)})` : '')}
          </p>
        )}
        {coverage && (
          <p className="mt-1 text-[0.48rem] leading-snug text-muted-foreground/50">
            احتُفظ بأقوى {arabicNumber(coverage.discovery.indexed)} من{' '}
            {arabicNumber(coverage.discovery.corpus)} استنباطًا، فالحقلُ قِطعةٌ من قِطعة.
          </p>
        )}
      </div>

      {/* ── scope 2: the sūrah, re-derived ── */}
      <div className="mt-2 border-t border-white/[0.06] pt-2">
        <p className="text-[0.5rem] leading-snug text-muted-foreground/80">
          <span className="text-[#6EE7B7]">السورة</span> — استنباطٌ جديد عند هذه الحدود.
        </p>
        {derivation ? (
          <p className="mt-1 text-[0.52rem] leading-snug text-muted-foreground">
            <span className="quran text-[0.8rem] text-foreground/85">{derivation.name}</span>{' '}
            — <span className="font-mono">{arabicNumber(derivation.discoveries.length)}</span> استنباطًا،{' '}
            منها <span className="font-mono text-gold">{arabicNumber(derivation.atAyah.length)}</span> على هذه الآية.
          </p>
        ) : (
          <p className="mt-1 text-[0.5rem] text-muted-foreground/60">اختر آيةً ليُعاد الاستنباط.</p>
        )}
      </div>
    </div>
  );
}

function Dial({
  label,
  field,
  value,
  display,
  onChange,
}: {
  label: string;
  field: keyof typeof BOUNDS;
  value: number;
  display: string;
  onChange: (v: number) => void;
}) {
  const b = BOUNDS[field];
  const pct = ((value - b.min) / (b.max - b.min)) * 100;
  return (
    <label className="mb-1.5 block text-[0.52rem] text-muted-foreground/70">
      <span className="mb-0.5 flex items-baseline justify-between gap-2">
        <span>{label}</span>
        <span className="font-mono text-[0.55rem] text-gold/90">{display}</span>
      </span>
      <input
        id={`cut-${field}`}
        type="range"
        min={b.min}
        max={b.max}
        step={b.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="isnad-range h-1 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(to left, #C8A45C 0%, #C8A45C ${pct}%, rgba(255,255,255,0.09) ${pct}%, rgba(255,255,255,0.09) 100%)`,
        }}
      />
    </label>
  );
}
