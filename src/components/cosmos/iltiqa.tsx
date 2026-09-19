'use client';
// ============================================================================
//  الالتقاء — the surface where navigation *is* the relation.
//
//  There is no index here, no list of sūrahs and no control that sets a
//  destination. There are three states and they are the whole interface:
//
//    أنت هنا      the position you occupy, stated in the quantities the field
//                 actually computed — the proximity axis, the isnād mix, the
//                 contour, the realm, the detector that fired. Not a title.
//    ما يلتقي     the destinations more than one independent *reading* of the
//                 text agrees on, ranked by how many agree. Reading, not
//                 family: المثاني and الرنين both read the isnād contour, so
//                 the two of them are one witness — see `CLASS_OF`.
//    الشاهد       on arrival, each family's own evidence, verbatim, for the
//                 step you just took, grouped under the reading it belongs to —
//                 and the next position, which is the first state again.
//
//  The first position is computed, not defaulted: `computedOrigin` picks the
//  āyah on which the most readings agree about the most destinations. A list to
//  pick from would be the menu this surface exists to do without.
//
//  What is deliberately *not* here: filters, thresholds, a map, a search. Each
//  would be a way of getting somewhere that is not a relation, and the point of
//  the slice is that there is no such way.
// ============================================================================
import * as React from 'react';
import { Compass, Loader2, MoveRight, Radio } from 'lucide-react';
import type { StrandEvidence } from '@/lib/cosmos/strands';
import {
  CLASS_OF,
  type EvidenceFamily,
  type FamilyWitness,
  type IndependenceClass,
} from '@/lib/cosmos/convergence';
import { DISCOVERY_STYLE, PERSON_STYLE, PROXIMITY_MODES } from '@/lib/view';
import type { DiscoveryKind } from '@/lib/types';
import { MODALITIES } from '@/lib/time-module';
import { arabicDecimal, arabicNumber, cn } from '@/lib/utils';
import { IsnadVector } from './isnad-vector';
import { FAMILY, evidenceReason } from './strand-panel';

// ── what the route returns ──────────────────────────────────────────────────
interface NodeBrief {
  i: number;
  s: number;
  a: number;
  name: string;
  text: string;
  d: number;
  v: [number, number, number];
  sig: string;
  con: string;
  conAr: string;
  k: string | null;
  note: string | null;
  tm: number[];
}

interface PlacedConvergence {
  node: number;
  to: NodeBrief;
  /** Independence classes agreeing, not families — see `CLASS_OF`. */
  support: number;
  classes: IndependenceClass[];
  families: EvidenceFamily[];
  witnesses: FamilyWitness[];
  strength: number;
}

/**
 * What each class is a reading *of*. The distinction is load-bearing on this
 * surface: المثاني and الرنين are two ways of reading one contour, so a card
 * showing both is showing one witness twice, and the heading has to say
 * "reading" where the chips say "family".
 */
const CLASS_LABEL: Record<IndependenceClass, { label: string; gloss: string }> = {
  contour: { label: 'الكنتور', gloss: 'قراءة كنتور الإسناد — المثاني والرنين كلاهما منه' },
  lexical: { label: 'اللفظ', gloss: 'قراءة المادّة اللفظية — الجذر العائد' },
  detector: { label: 'الاستنباط', gloss: 'استنباطٌ بعينه أسند الضفّتين إحداهما إلى الأخرى' },
};

interface PlacedRoute {
  node: number;
  via: number;
  to: NodeBrief;
  through: NodeBrief;
  first: FamilyWitness;
  second: FamilyWitness;
  strength: number;
}

interface Movement {
  id: string;
  from: number;
  toPerson: number;
  axisDelta: number;
  fromDistance: number;
  toDistance: number;
  tenseShift: boolean;
  sharedRoots: string[];
  score: number;
  seam: number | null;
  landing: NodeBrief | null;
}

interface Payload {
  here: NodeBrief;
  computed: boolean;
  origin: { node: number; converging: number; strength: number } | null;
  movement: Movement[];
  field: {
    placed: number;
    relations: number;
    groups: number;
    families: EvidenceFamily[];
    minSupport: number;
  };
  report: {
    atAnchor: Record<EvidenceFamily, number>;
    neighbours: number;
    single: number;
    converging: number;
    convergences: PlacedConvergence[];
    reachable: number;
    routes: PlacedRoute[];
  };
}

/** How the reader got to where they are standing. */
type Arrival =
  | { kind: 'convergence'; from: NodeBrief; step: PlacedConvergence }
  | { kind: 'route'; from: NodeBrief; step: PlacedRoute }
  | { kind: 'movement'; from: NodeBrief; step: Movement };

const locusOf = (n: NodeBrief) => `${n.name} ${arabicNumber(n.a)}`;

// ── أنت هنا ─────────────────────────────────────────────────────────────────
/**
 * A position, not a heading. Every number below was already computed for this
 * āyah and is printed as it stands: `d` on the proximity axis, `v` as the
 * attribution mix, `sig` as the contour, `k` as the strongest detector at the
 * locus, `tm` as the time modalities the particles actually tag.
 */
function Position({ node }: { node: NodeBrief }) {
  const mode = PROXIMITY_MODES.find((m) => node.d >= m.range[0] && node.d < m.range[1]) ?? PROXIMITY_MODES[2];
  const style = node.k ? DISCOVERY_STYLE[node.k as DiscoveryKind] : null;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0a1018]/80 p-4 backdrop-blur-xl">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.62rem]">
        <span className="quran text-[1.15rem] text-gold">{locusOf(node)}</span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Compass className="h-2.5 w-2.5" />
          <span className="quran text-[0.9rem]">{node.conAr}</span>
        </span>
        <span className="font-mono tracking-widest text-muted-foreground/80">{node.sig || '—'}</span>
        {style && (
          <span
            className="rounded border px-1.5 py-px text-[0.58rem]"
            style={{ borderColor: `${style.hex}55`, color: style.hex }}
            title={style.hint}
          >
            {style.label}
          </span>
        )}
        {MODALITIES.map((m, k) =>
          node.tm[k] > 0 ? (
            <span
              key={m.id}
              title={m.gloss}
              className="rounded border px-1 font-mono text-[0.5rem]"
              style={{ borderColor: `${m.hue}55`, color: m.hue }}
            >
              {m.code}
            </span>
          ) : null,
        )}
      </div>

      <p className="quran max-h-[9rem] overflow-y-auto text-right text-[1.5rem] leading-[2] text-foreground/92 thin-scroll">
        {node.text}
      </p>

      <div className="mt-3 space-y-2">
        <ProximityAxis d={node.d} mode={mode} />
        <IsnadVector v={node.v} distance={node.d} compact />
      </div>
      {node.note && (
        <p className="mt-2 border-r-2 border-gold/30 pr-2 text-[0.66rem] leading-relaxed text-muted-foreground">
          {node.note}
        </p>
      )}
    </div>
  );
}

/**
 * The proximity axis with its three shells marked. المخاطب sits at 0 because
 * direct address is the nearest a discourse can stand; radius in the field is
 * this same quantity, so the bar is the field's own geometry flattened, not an
 * illustration of it.
 */
function ProximityAxis({ d, mode }: { d: number; mode: (typeof PROXIMITY_MODES)[number] }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[0.56rem] text-muted-foreground/70">
        <span>
          <span className="quran text-[0.82rem]" style={{ color: mode.hex }}>
            {mode.label}
          </span>{' '}
          — {mode.gloss}
        </span>
        <span className="font-mono">بُعد {arabicDecimal(d, 3)}</span>
      </div>
      <div className="relative h-4">
        <div className="absolute inset-x-0 top-1.5 h-1 rounded-full bg-gradient-to-l from-ghaib/45 via-mutakallim/45 to-mukhatab/45" />
        {([2, 1, 3] as const).map((p) => {
          const at = p === 2 ? 0 : p === 1 ? 0.5 : 1;
          return (
            <span
              key={p}
              className="absolute top-0 h-4 w-px"
              style={{ right: `${at * 100}%`, background: `${PERSON_STYLE[p].hex}88` }}
              title={`${PERSON_STYLE[p].label} — ${arabicDecimal(at, 2)}`}
            />
          );
        })}
        <span
          className="absolute top-0.5 -mr-1.5 h-3 w-3 rounded-full border border-black/50"
          style={{ right: `${d * 100}%`, background: mode.hex }}
        />
      </div>
    </div>
  );
}

// ── الشواهد ─────────────────────────────────────────────────────────────────
/** One family's chip: its name, how many strands it has here, its strongest. */
function FamilyChip({ w }: { w: FamilyWitness }) {
  const f = FAMILY[w.family];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[0.6rem]"
      style={{ borderColor: `${f.hue}44`, color: f.hue, background: `${f.hue}12` }}
      title={f.gloss}
    >
      {f.icon}
      <span className="quran text-[0.8rem]">{f.label}</span>
      {w.count > 1 && <span className="font-mono opacity-70">{arabicNumber(w.count)}</span>}
      <span className="font-mono opacity-55">{arabicDecimal(w.weight, 2)}</span>
    </span>
  );
}

/**
 * The engine's own words, never a paraphrase — `evidenceReason` is the same
 * function the canvas labels its lines with, so the two surfaces cannot drift
 * into describing one computation two ways.
 */
function EvidenceLine({ e, hue }: { e: StrandEvidence; hue: string }) {
  return (
    <li className="flex gap-1.5 text-[0.66rem] leading-relaxed text-muted-foreground">
      <span style={{ color: hue }}>·</span>
      <span className="quran text-[0.86rem] leading-relaxed">{evidenceReason(e)}</span>
    </li>
  );
}

function Witness({ w }: { w: FamilyWitness }) {
  return (
    <div>
      <FamilyChip w={w} />
      <ul className="mt-1 mr-1 space-y-0.5">
        {w.evidence.map((e, i) => (
          <EvidenceLine key={i} e={e} hue={FAMILY[w.family].hue} />
        ))}
        {w.count > w.evidence.length && (
          <li className="mr-3 text-[0.58rem] text-muted-foreground/55">
            و{arabicNumber(w.count - w.evidence.length)} أخرى من العائلة نفسها
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * Witnesses under the reading each one is a reading of. Flat, they would imply
 * that المثاني and الرنين are two agreements; grouped, the card shows exactly
 * what `support` counted.
 */
function Witnesses({ witnesses, dense = false }: { witnesses: FamilyWitness[]; dense?: boolean }) {
  if (dense) {
    return (
      <div className="space-y-1">
        {witnesses.map((w) => (
          <Witness key={w.family} w={w} />
        ))}
      </div>
    );
  }
  const byClass = new Map<IndependenceClass, FamilyWitness[]>();
  for (const w of witnesses) {
    const c = CLASS_OF[w.family];
    const list = byClass.get(c);
    if (list) list.push(w);
    else byClass.set(c, [w]);
  }
  return (
    <div className="space-y-2">
      {[...byClass].map(([c, ws]) => (
        <div key={c} className="border-r border-white/10 pr-2">
          <p className="mb-1 text-[0.55rem] text-muted-foreground/55" title={CLASS_LABEL[c].gloss}>
            قراءة <span className="quran text-[0.8rem] text-muted-foreground/80">{CLASS_LABEL[c].label}</span>
            {ws.length > 1 && ' — عائلتان منها، وهما شاهدٌ واحد'}
          </p>
          <div className="space-y-1.5">
            {ws.map((w) => (
              <Witness key={w.family} w={w} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── ما يلتقي هنا ────────────────────────────────────────────────────────────
function Bearing({ c, onFollow }: { c: PlacedConvergence; onFollow: () => void }) {
  return (
    <button
      onClick={onFollow}
      className="w-full rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-right transition-colors hover:border-gold/30 hover:bg-white/[0.05]"
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="quran text-[1rem] text-gold">{locusOf(c.to)}</span>
        <span className="text-[0.6rem] text-muted-foreground">
          تتفق عليها {arabicNumber(c.support)} قراءات مستقلّة —{' '}
          <span className="quran text-[0.82rem]">
            {c.classes.map((k) => CLASS_LABEL[k].label).join(' و')}
          </span>
        </span>
        <span className="font-mono text-[0.55rem] text-muted-foreground/60">
          {arabicDecimal(c.strength, 2)}
        </span>
        <MoveRight className="h-3 w-3 text-gold/60" />
      </div>
      <p className="quran mb-2 line-clamp-2 text-[1.05rem] leading-[1.9] text-foreground/75">
        {c.to.text}
      </p>
      <Witnesses witnesses={c.witnesses} dense />
    </button>
  );
}

/**
 * A route is not a relation and must not be laid out as one. Two legs on two
 * different families say nothing about the two ends — they are a way through
 * the field, and the intermediate is named because it is the only thing the
 * two legs actually have in common.
 */
function RouteCard({ r, onFollow }: { r: PlacedRoute; onFollow: () => void }) {
  return (
    <button
      onClick={onFollow}
      className="w-full rounded-xl border border-dashed border-white/[0.08] bg-transparent p-3 text-right transition-colors hover:border-white/20 hover:bg-white/[0.03]"
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6rem] text-muted-foreground">
        <span className="quran text-[0.95rem] text-foreground/80">{locusOf(r.to)}</span>
        <span>عبر</span>
        <span className="quran text-[0.9rem] text-foreground/60">{locusOf(r.through)}</span>
        <span className="font-mono text-[0.55rem] opacity-60">{arabicDecimal(r.strength, 2)}</span>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        <div>
          <p className="mb-0.5 text-[0.55rem] text-muted-foreground/55">الخطوة الأولى</p>
          <Witnesses witnesses={[r.first]} dense />
        </div>
        <div>
          <p className="mb-0.5 text-[0.55rem] text-muted-foreground/55">الخطوة الثانية</p>
          <Witnesses witnesses={[r.second]} dense />
        </div>
      </div>
    </button>
  );
}

// ── حركة المحور ─────────────────────────────────────────────────────────────
/**
 * رِباط الملتقى measured the attribution leaving one person and arriving at
 * another, signed, on the axis the bar above draws. It is part of the position
 * rather than a destination someone chose — and where it lands on a placed
 * āyah it is a movement the text itself makes, so it can be walked.
 */
function MovementCard({ m, onFollow }: { m: Movement; onFollow: (() => void) | null }) {
  const from = PERSON_STYLE[m.from as 1 | 2 | 3];
  const to = PERSON_STYLE[m.toPerson as 1 | 2 | 3];
  const nearer = m.axisDelta < 0;
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.62rem]">
        <span className="quran text-[0.9rem]" style={{ color: from.hex }}>
          {from.label}
        </span>
        <MoveRight className="h-3 w-3 text-muted-foreground/60" />
        <span className="quran text-[0.9rem]" style={{ color: to.hex }}>
          {to.label}
        </span>
        <span className="font-mono text-muted-foreground">
          {arabicDecimal(Math.abs(m.axisDelta), 2)} {nearer ? 'اقترابًا' : 'ابتعادًا'}
        </span>
        {m.tenseShift && <span className="text-muted-foreground/70">مع تغيّر الزمن</span>}
        {m.landing && (
          <span className="quran text-[0.88rem] text-gold">
            تنزل في {locusOf(m.landing)}
          </span>
        )}
      </div>
      {m.sharedRoots.length > 0 && (
        <p className="quran mt-1 text-[0.85rem] text-muted-foreground">
          الجذور الرابطة: {m.sharedRoots.slice(0, 6).join('، ')}
        </p>
      )}
    </>
  );
  const cls =
    'w-full rounded-xl border border-khalq/25 bg-khalq/[0.06] p-2.5 text-right transition-colors';
  return onFollow ? (
    <button onClick={onFollow} className={cn(cls, 'hover:border-khalq/50 hover:bg-khalq/10')}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// ── الشاهد عند الوصول ───────────────────────────────────────────────────────
/** Why you are standing here: the step you took, with its evidence in full. */
function ArrivalCard({ arrival }: { arrival: Arrival }) {
  return (
    <div className="rounded-2xl border border-gold/25 bg-gold/[0.05] p-3">
      <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.62rem] text-muted-foreground">
        <span>جئتَ من</span>
        <span className="quran text-[0.95rem] text-foreground/85">{locusOf(arrival.from)}</span>
        {arrival.kind === 'convergence' && (
          <span>
            على اتفاق {arabicNumber(arrival.step.support)} قراءات مستقلّة —{' '}
            <span className="quran text-[0.85rem]">
              {arrival.step.classes.map((k) => CLASS_LABEL[k].label).join(' و')}
            </span>{' '}
            — وهذا شاهدُ كلٍّ منها
          </span>
        )}
        {arrival.kind === 'route' && (
          <span>
            عبر {locusOf(arrival.step.through)} — خطوتان على قراءتين، ولا دعوى بين الطرفين
          </span>
        )}
        {arrival.kind === 'movement' && <span>على حركة المحور التي قاسها رِباط الملتقى</span>}
      </p>
      {arrival.kind === 'convergence' && <Witnesses witnesses={arrival.step.witnesses} />}
      {arrival.kind === 'route' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[0.55rem] text-muted-foreground/55">
              الخطوة الأولى — إلى {locusOf(arrival.step.through)}
            </p>
            <Witnesses witnesses={[arrival.step.first]} />
          </div>
          <div>
            <p className="mb-1 text-[0.55rem] text-muted-foreground/55">
              الخطوة الثانية — منها إلى هنا
            </p>
            <Witnesses witnesses={[arrival.step.second]} />
          </div>
        </div>
      )}
      {arrival.kind === 'movement' && <MovementCard m={arrival.step} onFollow={null} />}
    </div>
  );
}

// ── الأثر ───────────────────────────────────────────────────────────────────
/** Where you have been. The only way back, and the only history kept. */
function Trail({ trail, onStepBack }: { trail: NodeBrief[]; onStepBack: (i: number) => void }) {
  if (!trail.length) return null;
  return (
    <nav className="flex flex-wrap items-center gap-1 text-[0.6rem] text-muted-foreground/70">
      {trail.map((n, i) => (
        <React.Fragment key={`${n.i}:${i}`}>
          {i > 0 && <MoveRight className="h-2.5 w-2.5 opacity-50" />}
          <button
            onClick={() => onStepBack(i)}
            className="quran rounded px-1 py-px text-[0.82rem] transition-colors hover:bg-white/[0.06] hover:text-foreground"
          >
            {locusOf(n)}
          </button>
        </React.Fragment>
      ))}
      <MoveRight className="h-2.5 w-2.5 opacity-50" />
    </nav>
  );
}

// ── the ledger ──────────────────────────────────────────────────────────────
/**
 * What the ranking above left out. A surface that shows twelve destinations out
 * of some larger number and does not say so has quietly equated its own view
 * with the field, which is the failure this project keeps catching in itself.
 */
function Ledger({ p }: { p: Payload }) {
  const r = p.report;
  const families = (Object.keys(r.atAnchor) as EvidenceFamily[]).filter((f) => r.atAnchor[f] > 0);
  return (
    <div className="space-y-1.5 rounded-xl border border-white/[0.06] bg-black/25 p-3 text-[0.62rem] leading-relaxed text-muted-foreground/75">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {families.length ? (
          families.map((f) => (
            <span key={f} className="inline-flex items-center gap-1" style={{ color: FAMILY[f].hue }}>
              <span className="quran text-[0.82rem]">{FAMILY[f].label}</span>
              <span className="font-mono opacity-70">{arabicNumber(r.atAnchor[f])}</span>
            </span>
          ))
        ) : (
          <span>لا علاقة مباشرة عند هذه الآية</span>
        )}
      </p>
      <p>
        من هنا تُبلَغ {arabicNumber(r.neighbours)} آيةً بعلاقةٍ واحدة على الأقل؛ اتفقت قراءتان
        مستقلّتان فأكثر على {arabicNumber(r.converging)} منها، وانفردت قراءةٌ واحدة بـ
        {arabicNumber(r.single)} — والواحدة استنباطٌ لا بنية. و{arabicNumber(r.reachable)} آيةً أخرى
        تُبلَغ بخطوتين لا بعلاقة.
      </p>
      <p className="text-muted-foreground/55">
        الحقلُ {arabicNumber(p.field.placed)} آيةً موضوعة من ٦٢٣٦، و{arabicNumber(p.field.relations)}{' '}
        خيطًا في {arabicNumber(p.field.groups)} جماعةً محسوبة. والعلاقة تقتضي وقوعَ طرفيها معًا في
        الألف، فما يظهر هنا أقلُّ ممّا في المصحف بكثير. السنابل خارج هذا الحساب: سبعُ شُعَبٍ لكل
        حبّة، مشتقّةٌ من الإسناد والزمن، توافق كلَّ شيء بحكم بنائها؛ والمثاني والرنين قراءةٌ واحدة
        للكنتور لا قراءتان.
        {p.field.families.length < 4 && ' ولم يدخل الرنين في هذا التقرير.'}
      </p>
    </div>
  );
}

// ── the surface ─────────────────────────────────────────────────────────────
export function Iltiqa({ start }: { start?: { surah: number; ayah: number } }) {
  const [locus, setLocus] = React.useState<{ surah: number; ayah: number } | null>(start ?? null);
  const [payload, setPayload] = React.useState<Payload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [moving, setMoving] = React.useState(false);
  const [arrival, setArrival] = React.useState<Arrival | null>(null);
  const [trail, setTrail] = React.useState<NodeBrief[]>([]);

  React.useEffect(() => {
    const controller = new AbortController();
    setMoving(true);
    const q = locus ? `?surah=${locus.surah}&ayah=${locus.ayah}` : '';
    void fetch(`/api/cosmos/convergence${q}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d: Payload & { error?: string }) => {
        if (controller.signal.aborted) return;
        if (d.error) {
          setError(d.error);
          return;
        }
        setError(null);
        setPayload(d);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('تعذّر بلوغ الحقل');
      })
      .finally(() => {
        if (!controller.signal.aborted) setMoving(false);
      });
    return () => controller.abort();
  }, [locus]);

  /** Following is the same request with the destination as the anchor. */
  const follow = React.useCallback(
    (to: NodeBrief, step: Arrival) => {
      setTrail((t) => [...t, step.from]);
      setArrival(step);
      setLocus({ surah: to.s, ayah: to.a });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [],
  );

  const stepBack = React.useCallback(
    (i: number) => {
      const target = trail[i];
      if (!target) return;
      setTrail((t) => t.slice(0, i));
      setArrival(null);
      setLocus({ surah: target.s, ayah: target.a });
    },
    [trail],
  );

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl items-center justify-center p-6">
        <p className="quran text-center text-[1.05rem] text-muted-foreground">{error}</p>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gold/60" />
      </main>
    );
  }

  const r = payload.report;
  const walkable = payload.movement.filter((m) => m.landing);

  return (
    <main className={cn('mx-auto max-w-3xl space-y-4 p-4 pb-16', moving && 'opacity-60')}>
      <header className="space-y-2 pt-2">
        <div className="flex items-baseline justify-between">
          <h1 className="quran text-[1.1rem] text-gold/85">الالتقاء</h1>
          <span className="text-[0.58rem] text-muted-foreground/60">
            السيرُ على ما حُسِب، لا على قائمة
          </span>
        </div>
        <Trail trail={trail} onStepBack={stepBack} />
      </header>

      {payload.computed && !trail.length && (
        <p className="rounded-xl border border-white/[0.06] bg-black/20 p-2.5 text-[0.63rem] leading-relaxed text-muted-foreground/75">
          لم تُختَر هذه الآية ولم تُنتقَ من فهرس: هي الآيةُ التي اتفقت عندها أكثرُ القراءات
          المستقلّة على أكثر المقاصد في الحقل — {arabicNumber(payload.origin?.converging ?? 0)} مقصدًا
          بقوّة {arabicDecimal(payload.origin?.strength ?? 0, 2)}.
        </p>
      )}

      {arrival && <ArrivalCard arrival={arrival} />}

      <Position node={payload.here} />

      {walkable.length > 0 && (
        <section className="space-y-1.5">
          <h2 className="quran text-[0.95rem] text-khalq">حركة المحور — ما يتحرّك به النصّ نفسه</h2>
          {walkable.map((m) => (
            <MovementCard
              key={m.id}
              m={m}
              onFollow={() =>
                follow(m.landing!, { kind: 'movement', from: payload.here, step: m })
              }
            />
          ))}
        </section>
      )}
      {payload.movement.length > walkable.length && (
        <div className="space-y-1.5">
          {payload.movement
            .filter((m) => !m.landing)
            .map((m) => (
              <MovementCard key={m.id} m={m} onFollow={null} />
            ))}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="quran flex items-baseline gap-2 text-[1rem] text-gold">
          ما يلتقي هنا
          <span className="text-[0.6rem] text-muted-foreground/70">
            {arabicNumber(r.converging)} مقصدًا تتفق عليه {arabicNumber(payload.field.minSupport)}{' '}
            قراءتان مستقلّتان فأكثر
            {r.converging > r.convergences.length &&
              ` — يُعرَض منها ${arabicNumber(r.convergences.length)}`}
          </span>
        </h2>
        {r.convergences.length ? (
          r.convergences.map((c) => (
            <Bearing
              key={c.node}
              c={c}
              onFollow={() => follow(c.to, { kind: 'convergence', from: payload.here, step: c })}
            />
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-[0.68rem] text-muted-foreground">
            لا تتفق قراءتان مستقلّتان على مقصدٍ من هنا. ما تحتَه طرقٌ بخطوتين، وهي غيرُ ذلك.
          </p>
        )}
      </section>

      {r.routes.length > 0 && (
        <section className="space-y-2">
          <h2 className="quran flex items-baseline gap-2 text-[1rem] text-foreground/70">
            طرقٌ عبر آية
            <span className="text-[0.6rem] text-muted-foreground/70">
              خطوتان على قراءتين مختلفتين — طريقٌ في الحقل، لا علاقةٌ بين الطرفين
            </span>
          </h2>
          {r.routes.map((x) => (
            <RouteCard
              key={`${x.via}:${x.node}`}
              r={x}
              onFollow={() => follow(x.to, { kind: 'route', from: payload.here, step: x })}
            />
          ))}
        </section>
      )}

      <Ledger p={payload} />

      <p className="flex items-center justify-center gap-1.5 pt-2 text-[0.58rem] text-muted-foreground/45">
        <Radio className="h-2.5 w-2.5" />
        كلُّ ما يُعرَض هنا استنباطٌ آليّ من الوسم الصرفيّ — يدلّ على موضع النظر، ولا يفسّر.
      </p>
    </main>
  );
}
