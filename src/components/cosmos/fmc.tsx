'use client';
// ============================================================================
//  لوحُ الزمن — the time flight board.
//
//  Shaped after an aircraft CDU because that is the right instrument for the
//  job: a flight computer does not *show* a route, it lets you enter legs and
//  then flies them. Here the legs are time modalities and the airway is the
//  muṣḥaf — enter ماضٍ → لَوْ → لَنْ and the field narrows to the āyāt that carry
//  a closed past, a branch that did not happen, and a foreclosed future, in
//  that order, and the camera flies them.
//
//  The three pages mirror a real CDU: TIME is the modality catalogue, LEGS is
//  the programmed route with its counts, and PROG is the standing state of the
//  field. Line-select keys down each side, scratchpad at the bottom.
// ============================================================================
import * as React from 'react';
import { Plane, X, ChevronLeft, ChevronRight, Trash2, Play } from 'lucide-react';
import { MODALITIES, type ModalityId } from '@/lib/time-module';
import type { CosmosNode } from '@/lib/cosmos';
import { arabicNumber, cn } from '@/lib/utils';

export type FmcPage = 'TIME' | 'LEGS' | 'PROG';

export interface RouteState {
  legs: ModalityId[];
  /** true = an āyah must carry every leg; false = any leg. */
  strict: boolean;
}

/** Which nodes a route admits. null when no route is programmed. */
export function routeFilter(nodes: CosmosNode[], route: RouteState): Set<number> | null {
  if (!route.legs.length) return null;
  const idx = route.legs.map((l) => MODALITIES.findIndex((m) => m.id === l));
  const out = new Set<number>();
  nodes.forEach((n, i) => {
    const hits = idx.filter((k) => k >= 0 && n.tm[k] > 0).length;
    if (route.strict ? hits === idx.length : hits > 0) out.add(i);
  });
  return out;
}

/**
 * The order the route is flown. Legs are ordered by their own position on the
 * before↔after axis, and within a leg the āyāt that lean hardest that way come
 * first — so a programmed route reads as a movement through time, not a list.
 */
export function routeSequence(nodes: CosmosNode[], route: RouteState): number[] {
  const filter = routeFilter(nodes, route);
  if (!filter) return [];
  const legOrder = [...route.legs]
    .map((l) => MODALITIES.find((m) => m.id === l)!)
    .sort((a, b) => a.axis - b.axis);

  const seen = new Set<number>();
  const out: number[] = [];
  for (const m of legOrder) {
    const k = MODALITIES.findIndex((x) => x.id === m.id);
    const bucket = [...filter]
      .filter((i) => !seen.has(i) && nodes[i].tm[k] > 0)
      .sort((a, b) => (m.axis < 0 ? nodes[a].ax - nodes[b].ax : nodes[b].ax - nodes[a].ax));
    for (const i of bucket) {
      seen.add(i);
      out.push(i);
    }
  }
  return out;
}

export function TimeBoard({
  open,
  onClose,
  nodes,
  route,
  setRoute,
  onFly,
  focus,
}: {
  open: boolean;
  onClose: () => void;
  nodes: CosmosNode[];
  route: RouteState;
  setRoute: (r: RouteState) => void;
  onFly: (sequence: number[]) => void;
  focus: CosmosNode | null;
}) {
  const [page, setPage] = React.useState<FmcPage>('TIME');
  const [scratch, setScratch] = React.useState('');

  const counts = React.useMemo(() => {
    const c = MODALITIES.map(() => 0);
    for (const n of nodes) MODALITIES.forEach((_, k) => (n.tm[k] > 0 ? c[k]++ : 0));
    return c;
  }, [nodes]);

  const admitted = React.useMemo(() => routeFilter(nodes, route), [nodes, route]);
  const sequence = React.useMemo(() => routeSequence(nodes, route), [nodes, route]);

  const toggleLeg = (id: ModalityId) => {
    const has = route.legs.includes(id);
    setRoute({ ...route, legs: has ? route.legs.filter((l) => l !== id) : [...route.legs, id] });
    setScratch(has ? `DELETED ${id.toUpperCase()}` : `ENTERED ${id.toUpperCase()}`);
  };

  if (!open) return null;

  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-30 w-[23rem] select-none">
      <div className="overflow-hidden rounded-xl border border-gold/25 bg-[#0a1018]/95 shadow-2xl shadow-black/70 backdrop-blur-xl">
        {/* ── CDU head ── */}
        <header className="flex items-center justify-between border-b border-gold/20 bg-black/50 px-3 py-1.5">
          <span className="flex items-center gap-1.5 font-mono text-[0.62rem] tracking-[0.18em] text-gold/85">
            <Plane className="h-3 w-3" />
            TIME MGMT
          </span>
          <div className="flex items-center gap-1">
            {(['TIME', 'LEGS', 'PROG'] as FmcPage[]).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  'rounded px-1.5 py-0.5 font-mono text-[0.58rem] tracking-wider transition-colors',
                  page === p ? 'bg-gold/20 text-gold' : 'text-emerald-300/45 hover:text-emerald-300/80',
                )}
              >
                {p}
              </button>
            ))}
            <button onClick={onClose} className="mr-1 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        <div className="max-h-[52vh] min-h-[15rem] overflow-y-auto thin-scroll px-2 py-2 font-mono">
          {page === 'TIME' && (
            <ul className="space-y-px">
              {MODALITIES.map((m, k) => {
                const on = route.legs.includes(m.id);
                const pos = route.legs.indexOf(m.id) + 1;
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => toggleLeg(m.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded px-1.5 py-1 text-right transition-colors',
                        on ? 'bg-gold/[0.13]' : 'hover:bg-white/[0.05]',
                      )}
                    >
                      {/* line-select key */}
                      <span
                        className={cn(
                          'w-5 shrink-0 text-center text-[0.55rem]',
                          on ? 'text-gold' : 'text-emerald-300/40',
                        )}
                      >
                        {on ? `${pos}` : `L${k + 1}`}
                      </span>
                      <span className="w-9 shrink-0 text-[0.6rem] tracking-wider" style={{ color: m.hue }}>
                        {m.code}
                      </span>
                      <span className="quran min-w-0 flex-1 truncate text-[0.95rem] text-foreground/90">
                        {m.label}
                      </span>
                      <span className="shrink-0 text-[0.55rem] text-emerald-300/40">
                        {String(counts[k]).padStart(3, '0')}
                      </span>
                    </button>
                    <p className="px-8 pb-0.5 text-right text-[0.58rem] leading-snug text-muted-foreground/70">
                      {m.gloss}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          {page === 'LEGS' && (
            <div className="space-y-1">
              {!route.legs.length && (
                <p className="px-2 py-8 text-center text-[0.62rem] text-emerald-300/40">
                  NO ROUTE ENTERED
                  <span className="mt-1 block text-muted-foreground/60">
                    اختر أطوارًا من صفحة TIME
                  </span>
                </p>
              )}
              {[...route.legs]
                .map((l) => MODALITIES.find((m) => m.id === l)!)
                .sort((a, b) => a.axis - b.axis)
                .map((m, i, arr) => (
                  <div key={m.id} className="flex items-center gap-2 rounded bg-white/[0.04] px-1.5 py-1">
                    <span className="w-5 shrink-0 text-center text-[0.55rem] text-gold">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="w-9 shrink-0 text-[0.6rem]" style={{ color: m.hue }}>
                      {m.code}
                    </span>
                    <span className="quran min-w-0 flex-1 truncate text-[0.9rem]">{m.label}</span>
                    <span className="shrink-0 text-[0.52rem] text-emerald-300/40">
                      {m.axis < 0 ? '◀ قبل' : m.axis > 0.5 ? 'بعد ▶' : 'الآن'}
                    </span>
                    <button
                      onClick={() => toggleLeg(m.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    {i < arr.length - 1 && <span className="sr-only">then</span>}
                  </div>
                ))}

              {route.legs.length > 0 && (
                <>
                  <div className="mt-2 flex items-center gap-2 px-1.5">
                    <button
                      onClick={() => setRoute({ ...route, strict: !route.strict })}
                      className={cn(
                        'rounded border px-2 py-0.5 text-[0.55rem] tracking-wider transition-colors',
                        route.strict
                          ? 'border-gold/50 bg-gold/15 text-gold'
                          : 'border-white/12 text-emerald-300/50',
                      )}
                    >
                      {route.strict ? 'ALL LEGS' : 'ANY LEG'}
                    </button>
                    <span className="text-[0.55rem] text-emerald-300/40">
                      {String(admitted?.size ?? 0).padStart(4, '0')} ĀYĀT
                    </span>
                    <button
                      onClick={() => onFly(sequence)}
                      disabled={!sequence.length}
                      className="mr-auto flex items-center gap-1 rounded border border-gold/50 bg-gold/15 px-2 py-0.5 text-[0.58rem] text-gold transition-colors hover:bg-gold/25 disabled:opacity-30"
                    >
                      <Play className="h-2.5 w-2.5" />
                      EXEC
                    </button>
                  </div>
                  <p className="px-1.5 pt-1 text-right text-[0.58rem] leading-relaxed text-muted-foreground/70">
                    يُطار المسار من أبعدِ الأطوار في الماضي إلى أبعدِها في المستقبل.
                  </p>
                </>
              )}
            </div>
          )}

          {page === 'PROG' && (
            <div className="space-y-1.5 text-[0.62rem]">
              <Row k="FIELD" v={`${nodes.length} ĀYĀT`} />
              <Row k="ADMITTED" v={admitted ? `${admitted.size}` : 'ALL'} />
              <Row k="LEGS" v={route.legs.length ? route.legs.length.toString().padStart(2, '0') : '--'} />
              <Row k="MODE" v={route.strict ? 'ALL' : 'ANY'} />
              <div className="my-1.5 h-px bg-gold/15" />
              {focus ? (
                <>
                  <Row k="POSN" v={`${focus.s}:${focus.a}`} />
                  <Row k="REALM" v={focus.conAr} arabic />
                  <Row k="ISNAD" v={focus.sig || '--'} />
                  <Row k="DIST" v={`${Math.round(focus.d * 100)}%`} />
                  <Row k="T-AXIS" v={focus.ax.toFixed(2)} />
                  <Row k="T-TENS" v={focus.tn.toFixed(2)} />
                  <div className="my-1.5 h-px bg-gold/15" />
                  <p className="px-1 text-right text-[0.55rem] tracking-wider text-emerald-300/50">
                    CARRIES
                  </p>
                  <div className="flex flex-wrap gap-1 px-1">
                    {MODALITIES.map((m, k) =>
                      focus.tm[k] > 0 ? (
                        <span
                          key={m.id}
                          className="rounded border px-1 text-[0.52rem]"
                          style={{ borderColor: `${m.hue}55`, color: m.hue }}
                        >
                          {m.code}
                          {focus.tm[k] > 1 ? `×${focus.tm[k]}` : ''}
                        </span>
                      ) : null,
                    )}
                  </div>
                </>
              ) : (
                <p className="px-1 py-6 text-center text-emerald-300/40">NO POSN SELECTED</p>
              )}
            </div>
          )}
        </div>

        {/* ── scratchpad ── */}
        <div className="flex items-center gap-2 border-t border-gold/20 bg-black/60 px-2.5 py-1">
          <ChevronLeft className="h-3 w-3 shrink-0 text-emerald-300/30" />
          <span className="min-w-0 flex-1 truncate font-mono text-[0.58rem] tracking-wider text-emerald-300/80">
            {scratch || (route.legs.length ? `${route.legs.length} LEG ROUTE` : 'READY')}
          </span>
          <ChevronRight className="h-3 w-3 shrink-0 text-emerald-300/30" />
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, arabic }: { k: string; v: string; arabic?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-1">
      <span className="tracking-wider text-emerald-300/50">{k}</span>
      <span className={cn('text-foreground/85', arabic && 'quran text-[0.9rem]')}>{v}</span>
    </div>
  );
}

export { arabicNumber };
