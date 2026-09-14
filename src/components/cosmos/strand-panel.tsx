'use client';
// ============================================================================
//  لوح الخيوط — what the lines are, and what each one affords.
//
//  A line on the canvas asserts that two āyāt stand in a relation. This panel
//  is where that assertion is made accountable: every strand states which
//  computation produced it, in the engine's own words, and offers the one
//  thing a relation can afford — going to the other end of it.
//
//  Arabic lives in the DOM, not in WebGL, for the same reason the labels do.
// ============================================================================
import * as React from 'react';
import { GitBranch, Repeat, Sprout, Radio, Waves, ArrowLeftRight } from 'lucide-react';
import type { SelectedRibat, SelectedStrand, StrandKind } from '@/lib/cosmos/strands';
import type { CosmosNode } from '@/lib/cosmos';
import type { FieldCoverage } from '@/lib/cosmos/coverage';
import { PERSON_STYLE } from '@/lib/view';
import { arabicDecimal, arabicNumber, cn } from '@/lib/utils';
import type { FamilyCount, StrandOptions } from './use-strands';

export const FAMILY: Record<
  StrandKind,
  { label: string; hue: string; icon: React.ReactNode; gloss: string }
> = {
  sunbula: {
    label: 'السنابل',
    hue: '#C8A45C',
    icon: <Sprout className="h-3 w-3" />,
    gloss: 'سبعُ شُعَبٍ من كل حبّة — طريقُ السير، لا دعوى قرابة',
  },
  motif: {
    label: 'المثاني',
    hue: '#A78BFA',
    icon: <Repeat className="h-3 w-3" />,
    gloss: 'كنتور إسنادٍ واحد تكرّر في أكثر من موضع',
  },
  root: {
    label: 'الجذور',
    hue: '#FB7185',
    icon: <GitBranch className="h-3 w-3" />,
    gloss: 'جذرٌ نادر يعود في مواضع معدودة — كلما قلّت، اشتدّ الرباط',
  },
  discovery: {
    label: 'الاستنباطات',
    hue: '#E2E8F0',
    icon: <Waves className="h-3 w-3" />,
    gloss: 'ضفّتا استنباطٍ بعينه، كلتاهما موضوعة في الحقل',
  },
  resonance: {
    label: 'الرنين',
    hue: '#FDE68A',
    icon: <Radio className="h-3 w-3" />,
    gloss: 'كنتور مطابقٌ أو معكوسٌ أو مقلوب، أو تقاربٌ في المتجه',
  },
};

/**
 * The engine's own account of why a strand exists. Never a paraphrase — and,
 * where the relation reaches past the placed 1,000, never silent about it: a
 * contour drawn as a few segments may recur far more often than the field can
 * show, and quoting only what is drawn would equate the field with the muṣḥaf.
 */
export function strandReason(s: SelectedStrand): string {
  const e = s.evidence;
  switch (e.kind) {
    case 'sunbula':
      return `الشعبة ${arabicNumber(e.branch + 1)}`;
    case 'motif':
      return (
        `${e.pattern} · ${arabicNumber(e.length)} مواضع إسناد · ` +
        `تكرّر ${arabicNumber(e.occurrences)} مرّة في المصحف، ` +
        `${arabicNumber(e.placed)} منها في الحقل`
      );
    case 'root':
      return (
        `«${e.root}» — لا يقع في المصحف إلا في ${arabicNumber(e.loci)} موضعًا، ` +
        `${arabicNumber(e.placed)} منها في الحقل`
      );
    case 'discovery':
      return (
        `${e.title} · درجة ${arabicDecimal(e.score, 2)}` +
        (e.sharedRoots.length ? ` · الجذور الرابطة: ${e.sharedRoots.slice(0, 4).join('، ')}` : '')
      );
    case 'resonance':
      return `${e.reason} · ${e.sig}`;
  }
}

/** The coverage line for one family: drawn, present in the field, in the muṣḥaf. */
function familyReach(k: StrandKind, coverage: FieldCoverage | null): string | null {
  if (!coverage) return null;
  if (k === 'motif') {
    const g = coverage.motif.groups!;
    return (
      `${arabicNumber(coverage.motif.placed)} من ${arabicNumber(coverage.motif.corpus)} موضعًا في الحقل · ` +
      `${arabicNumber(g.placed)} من ${arabicNumber(g.corpus)} كنتورًا`
    );
  }
  if (k === 'root') {
    const g = coverage.root.groups!;
    const gate = coverage.root.gate;
    return (
      `${arabicNumber(coverage.root.placed)} من ${arabicNumber(coverage.root.indexed)} موضعًا ضمن الحدّ · ` +
      `${arabicNumber(g.placed)} من ${arabicNumber(g.corpus)} جذرًا` +
      (gate
        ? ` · يُرسم الجذر إن وقع في ${arabicNumber(gate.min)}–${arabicNumber(gate.max)} موضعًا، ` +
          `وقد اجتاز ${arabicNumber(gate.passed)}`
        : '')
    );
  }
  if (k === 'discovery') {
    return (
      `${arabicNumber(coverage.discovery.placed)} ضفّةً موضوعة · ` +
      `من ${arabicNumber(coverage.discovery.indexed)} مفهرسًا من ` +
      `${arabicNumber(coverage.discovery.corpus)} استنباطًا في المصحف`
    );
  }
  if (k === 'sunbula') return 'كلُّها في الحقل — سبعٌ لكل حبّة';
  if (k === 'resonance') return `يُحسب عند كل آية على ${arabicNumber(coverage.ayaat.corpus)} آية`;
  return null;
}

export function StrandLegend({
  opt,
  setOpt,
  counts,
  drawn,
  total,
  coverage,
}: {
  opt: StrandOptions;
  setOpt: (o: StrandOptions) => void;
  counts: Record<StrandKind, FamilyCount>;
  drawn: number;
  total: number;
  coverage: FieldCoverage | null;
}) {
  const toggle = (k: StrandKind) => setOpt({ ...opt, kinds: { ...opt.kinds, [k]: !opt.kinds[k] } });
  return (
    <div className="w-48 rounded-xl border border-white/[0.07] bg-black/40 p-2 backdrop-blur-sm">
      <p className="mb-1 flex items-center justify-between text-[0.58rem] tracking-wider text-gold/70">
        <span>الخيوط</span>
        <span className="font-mono text-muted-foreground/70">
          {arabicNumber(drawn)}/{arabicNumber(total)}
        </span>
      </p>
      {coverage && (
        <p className="mb-1.5 text-[0.48rem] leading-snug text-muted-foreground/60">
          الحقلُ {arabicNumber(coverage.ayaat.placed)} آيةً من {arabicNumber(coverage.ayaat.corpus)} —
          فما تراه بعضُ العلاقة لا كلُّها.
        </p>
      )}
      <div className="space-y-0.5">
        {(Object.keys(FAMILY) as StrandKind[]).map((k) => {
          const f = FAMILY[k];
          const on = opt.kinds[k];
          const reach = familyReach(k, coverage);
          return (
            <button
              key={k}
              onClick={() => toggle(k)}
              title={reach ? `${f.gloss}\n\n${reach}` : f.gloss}
              className={cn(
                'w-full rounded px-1.5 py-1 text-right transition-colors',
                on ? 'bg-white/[0.05]' : 'opacity-40 hover:opacity-70',
              )}
            >
              <span className="flex items-center gap-1.5">
                <span style={{ color: f.hue }}>{f.icon}</span>
                <span className="quran flex-1 text-[0.85rem]" style={{ color: on ? f.hue : undefined }}>
                  {f.label}
                </span>
                <span className="font-mono text-[0.5rem] text-muted-foreground/60">
                  {arabicNumber(counts[k].drawn)}/{arabicNumber(counts[k].available)}
                </span>
              </span>
              {on && reach && (
                <span className="mt-0.5 block text-[0.46rem] leading-snug text-muted-foreground/55">
                  {reach}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setOpt({ ...opt, showRibat: !opt.showRibat })}
        title="حركة المحور — انتقال الإسناد من مقام إلى مقام، مرسومًا بمقداره"
        className={cn(
          'mt-1 flex w-full items-center gap-1.5 rounded border-t border-white/[0.06] px-1.5 pt-1.5 text-right transition-colors',
          opt.showRibat ? '' : 'opacity-40 hover:opacity-70',
        )}
      >
        <ArrowLeftRight className="h-3 w-3 text-gold/80" />
        <span className="quran flex-1 text-[0.85rem] text-gold/90">حركة المحور</span>
      </button>

      <label className="mt-2 block text-[0.52rem] text-muted-foreground/70">
        <span className="mb-0.5 block">كثافة الحقل · {arabicNumber(opt.budget)}</span>
        <input
          type="range"
          min={40}
          max={640}
          step={20}
          value={opt.budget}
          onChange={(e) => setOpt({ ...opt, budget: Number(e.target.value) })}
          className="isnad-range h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10"
        />
      </label>
    </div>
  );
}

/**
 * The strands touching the āyah in focus. Each row is the affordance: it says
 * what the engine computed, and going to the other end is one click.
 */
export function StrandInspector({
  strands,
  ribat,
  focus,
  nodes,
  onPick,
}: {
  strands: SelectedStrand[];
  ribat: SelectedRibat[];
  focus: number;
  nodes: CosmosNode[];
  onPick: (i: number) => void;
}) {
  if (!strands.length && !ribat.length) return null;
  return (
    <div className="space-y-1">
      {ribat.map((v) => {
        const from = PERSON_STYLE[v.from];
        const to = PERSON_STYLE[v.toPerson];
        const inward = v.axisDelta < 0;
        return (
          <div
            key={v.id}
            className="flex items-center gap-2 rounded-lg border border-gold/25 bg-gold/[0.06] px-2 py-1"
          >
            <ArrowLeftRight className="h-3 w-3 shrink-0 text-gold" />
            <span className="quran text-[0.85rem]" style={{ color: from.hex }}>
              {from.label}
            </span>
            <span className="text-[0.6rem] text-muted-foreground">←</span>
            <span className="quran text-[0.85rem]" style={{ color: to.hex }}>
              {to.label}
            </span>
            <span className="flex-1 text-[0.56rem] text-muted-foreground">
              {inward ? 'اقترابًا' : 'ابتعادًا'} بمقدار {arabicDecimal(Math.abs(v.axisDelta))} على محور
              المسافة{v.tenseShift ? '، مع تغيّر الزمن' : ''}
              {v.sharedRoots.length ? ` · ${v.sharedRoots.slice(0, 3).join('، ')}` : ''}
            </span>
            {v.to !== null && (
              <button
                onClick={() => onPick(v.to!)}
                className="quran shrink-0 rounded px-1 text-[0.8rem] text-gold/80 hover:text-gold"
              >
                {nodes[v.to].name} {arabicNumber(nodes[v.to].a)}
              </button>
            )}
          </div>
        );
      })}

      {strands.slice(0, 14).map((s) => {
        const other = s.a === focus ? s.b : s.a;
        const n = nodes[other];
        if (!n) return null;
        const f = FAMILY[s.kind];
        return (
          <button
            key={s.id}
            onClick={() => onPick(other)}
            title={f.gloss}
            className="group flex w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-right transition-colors hover:border-white/20 hover:bg-white/[0.05]"
          >
            <span className="shrink-0" style={{ color: f.hue }}>
              {f.icon}
            </span>
            <span className="quran shrink-0 text-[0.85rem] text-foreground/85 group-hover:text-gold">
              {n.name} {arabicNumber(n.a)}
            </span>
            <span className="flex-1 truncate text-right text-[0.56rem] text-muted-foreground">
              {strandReason(s)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
