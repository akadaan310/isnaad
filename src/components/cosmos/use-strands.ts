'use client';
// ============================================================================
//  الخيوط — the client side of the strand layer.
//
//  Four sources, joined here and nowhere else:
//
//    السنابل     rebuilt locally from `node.sb`, so 7,000 edges cost nothing
//                on the wire. They stay a navigation layer: traversable
//                always, drawable only when asked for, and never evidence of
//                anything — seven neighbours per node is a regular degree and
//                carries no information.
//    the wire    motifs, roots and detector findings, built server-side
//                because they need 2.3 MB of mined indices to produce.
//    الرنين      resonance, which is computed *against* an āyah and so is
//                fetched for whichever one is in focus.
//    القَطْع     the focused sūrah, re-derived under the reader's own detector
//                thresholds. This is the only place the field asks the engine
//                to compute rather than to recall.
//
//  Selection is the other half of the hook. The field holds ~10,300
//  relationships; a frame is allowed a few hundred, and which few hundred
//  depends on where the reader stands and what the flight board admits.
// ============================================================================
import * as React from 'react';
import type { CosmosNode } from '@/lib/cosmos';
import { buildLocusJoin, type LocusJoin } from '@/lib/cosmos/locus';
import type { FieldCoverage } from '@/lib/cosmos/coverage';
import {
  buildAdjacency,
  resonanceStrands,
  selectRibat,
  selectStrands,
  sunbulaStrands,
  type RibatVector,
  type SelectedRibat,
  type SelectedStrand,
  type Strand,
  type StrandKind,
} from '@/lib/cosmos/strands';
import { unpackStrands, type PackedStrands } from '@/lib/cosmos/wire';
import type { Resonance } from '@/lib/engine/graph';
import type { Discovery } from '@/lib/types';

// ── القَطْع — the detector threshold in force ───────────────────────────────
/**
 * The three options a reader may move. They are not new: `DEFAULT_OPTIONS` has
 * always held them and `/api/surah/[id]` has always accepted them — the canvas
 * simply never passed any.
 *
 * They do not act in the same place, and the interface must not pretend they
 * do. `minScore` can be applied to the field as a filter, because the mined
 * index stores each finding's score. `stitchWindow` and `echoWindow` change
 * *what is found at all*, so they only mean anything where the engine actually
 * re-runs: the focused sūrah.
 */
export interface CutState {
  minScore: number;
  stitchWindow: number;
  echoWindow: number;
}

export const DEFAULT_CUT: CutState = { minScore: 0.28, stitchWindow: 8, echoWindow: 22 };

export interface StrandOptions {
  kinds: Record<StrandKind, boolean>;
  /** Hard ceiling on drawn strands. */
  budget: number;
  /** Hops out from the focused āyah. */
  depth: number;
  showRibat: boolean;
}

export const DEFAULT_STRAND_OPTIONS: StrandOptions = {
  // السنابل default off in *this* layer: the focused grain already draws its
  // seven branches in gold, and putting all 7,000 into the same selection
  // would only duplicate them. They stay one click away.
  kinds: { sunbula: false, motif: true, root: true, discovery: true, resonance: true },
  budget: 120,
  depth: 2,
  showRibat: true,
};

/** What the engine returned for the focused sūrah at the reader's thresholds. */
export interface Derivation {
  surah: number;
  name: string;
  /** Every finding in the sūrah under these thresholds. */
  discoveries: Discovery[];
  /** Those whose span covers the focused āyah. */
  atAyah: Discovery[];
  options: CutState;
  pending: boolean;
}

export interface FamilyCount {
  /** Strands of this family currently drawn. */
  drawn: number;
  /** Strands of this family that exist at all. */
  available: number;
}

export interface StrandField {
  ready: boolean;
  join: LocusJoin | null;
  /** Everything that exists, after the field-level cut. */
  all: Strand[];
  /** Strands touching the focused āyah, for the inspector list. */
  atFocus: SelectedStrand[];
  /** What the renderer is handed. */
  selected: SelectedStrand[];
  ribat: SelectedRibat[];
  ribatAll: RibatVector[];
  counts: Record<StrandKind, FamilyCount>;
  /** How much of the muṣḥaf the drawn relations stand for. */
  coverage: FieldCoverage | null;
  /** Discovery strands removed by the field-level minScore. */
  cutAway: number;
  /** The live re-derivation for the focused sūrah, when there is a focus. */
  derivation: Derivation | null;
}

const EMPTY_COUNT: FamilyCount = { drawn: 0, available: 0 };
const emptyCounts = (): Record<StrandKind, FamilyCount> => ({
  sunbula: { ...EMPTY_COUNT },
  motif: { ...EMPTY_COUNT },
  root: { ...EMPTY_COUNT },
  discovery: { ...EMPTY_COUNT },
  resonance: { ...EMPTY_COUNT },
});

type Wire = PackedStrands & { ribat: RibatVector[]; coverage: FieldCoverage };

export function useStrandField(
  nodes: CosmosNode[],
  focus: number | null,
  admitted: Set<number> | null,
  opt: StrandOptions,
  cut: CutState,
): StrandField {
  const [wire, setWire] = React.useState<Wire | null>(null);
  const [resonance, setResonance] = React.useState<{ node: number; matches: Resonance[] } | null>(null);
  const [derived, setDerived] = React.useState<Omit<Derivation, 'atAyah' | 'pending'> | null>(null);
  const [deriving, setDeriving] = React.useState(false);

  React.useEffect(() => {
    let live = true;
    void fetch('/api/cosmos/strands')
      .then((r) => r.json())
      .then((d) => {
        if (live && !d.error) setWire(d);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const join = React.useMemo(() => (nodes.length ? buildLocusJoin(nodes) : null), [nodes]);

  // ── الرنين ────────────────────────────────────────────────────────────────
  // Anchored, so it is fetched per focus. The route ranks all 6,236 āyāt
  // against the new anchor on every call — a genuine computation, not a lookup.
  React.useEffect(() => {
    if (focus === null || !nodes[focus]) {
      setResonance(null);
      return;
    }
    const n = nodes[focus];
    let live = true;
    void fetch(`/api/resonance?surah=${n.s}&ayah=${n.a}&limit=40`)
      .then((r) => r.json())
      .then((d) => {
        if (live && !d.error) setResonance({ node: n.i, matches: d.matches as Resonance[] });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [focus, nodes]);

  // ── القَطْع ───────────────────────────────────────────────────────────────
  // Re-derive the focused sūrah at the reader's thresholds. Debounced, because
  // a slider fires far faster than an 80 ms analysis, and aborted on change so
  // a slow response cannot overwrite a newer one.
  const surah = focus !== null ? nodes[focus]?.s : undefined;
  React.useEffect(() => {
    if (surah === undefined) {
      setDerived(null);
      setDeriving(false);
      return;
    }
    const controller = new AbortController();
    setDeriving(true);
    const timer = window.setTimeout(() => {
      const q = new URLSearchParams({
        only: 'discoveries',
        minScore: String(cut.minScore),
        stitchWindow: String(cut.stitchWindow),
        echoWindow: String(cut.echoWindow),
      });
      void fetch(`/api/surah/${surah}?${q}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d) => {
          if (controller.signal.aborted || d.error) return;
          setDerived({
            surah: d.surah,
            name: d.name,
            discoveries: d.discoveries as Discovery[],
            options: {
              minScore: d.options.minScore,
              stitchWindow: d.options.stitchWindow,
              echoWindow: d.options.echoWindow,
            },
          });
        })
        .catch(() => undefined)
        .finally(() => {
          if (!controller.signal.aborted) setDeriving(false);
        });
    }, 260);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [surah, cut.minScore, cut.stitchWindow, cut.echoWindow]);

  // ── the resident field ────────────────────────────────────────────────────
  const resident = React.useMemo(() => {
    if (!nodes.length) return [] as Strand[];
    return [...sunbulaStrands(nodes), ...(wire ? unpackStrands(wire) : [])];
  }, [nodes, wire]);

  // The field-level cut. A discovery strand carries the score it was mined
  // with, so filtering by it is exact — but it can only ever remove. The index
  // was truncated at `coverage.discoveryFloor`, and nothing below that exists
  // to be recovered, which is why the control says so rather than pretending
  // the whole range is live.
  const base = React.useMemo(() => {
    if (cut.minScore <= 0) return resident;
    return resident.filter(
      (s) => s.evidence.kind !== 'discovery' || s.evidence.score >= cut.minScore,
    );
  }, [resident, cut.minScore]);

  const cutAway = resident.length - base.length;

  const adjacency = React.useMemo(() => buildAdjacency(base), [base]);

  const resonant = React.useMemo(() => {
    if (!join || !resonance || resonance.node !== focus) return [] as Strand[];
    return resonanceStrands(resonance.node, resonance.matches, join);
  }, [join, resonance, focus]);

  const all = React.useMemo(() => [...base, ...resonant], [base, resonant]);

  const selected = React.useMemo(() => {
    if (!adjacency.strands.length) return [] as SelectedStrand[];
    const chosen = selectStrands(adjacency, {
      focus,
      admitted,
      budget: opt.budget,
      depth: opt.depth,
      kinds: opt.kinds,
      balance: true,
    });
    if (!resonant.length || opt.kinds.resonance === false) return chosen;
    // Resonance strands are all incident to the focus by construction, so they
    // join the selection at hop 0 rather than going through the walk.
    const merged = [...chosen, ...resonant.map((s) => ({ ...s, hop: 0, prominence: s.weight }))];
    merged.sort((x, y) => y.prominence - x.prominence);
    return merged.slice(0, opt.budget);
  }, [adjacency, focus, admitted, opt.budget, opt.depth, opt.kinds, resonant]);

  const counts = React.useMemo(() => {
    const c = emptyCounts();
    for (const s of all) c[s.kind].available++;
    for (const s of selected) c[s.kind].drawn++;
    return c;
  }, [all, selected]);

  const atFocus = React.useMemo(() => {
    if (focus === null) return [] as SelectedStrand[];
    const out = selected.filter((s) => s.a === focus || s.b === focus);
    out.sort((x, y) => y.prominence - x.prominence);
    return out;
  }, [selected, focus]);

  const ribat = React.useMemo(() => {
    if (!wire || !opt.showRibat) return [] as SelectedRibat[];
    return selectRibat(wire.ribat, { focus, admitted, budget: 48 });
  }, [wire, focus, admitted, opt.showRibat]);

  const derivation = React.useMemo<Derivation | null>(() => {
    if (focus === null || !nodes[focus] || !derived) return null;
    const ayah = nodes[focus].a;
    return {
      ...derived,
      atAyah: derived.discoveries.filter((d) => d.ayahFrom <= ayah && d.ayahTo >= ayah),
      pending: deriving,
    };
  }, [focus, nodes, derived, deriving]);

  return {
    ready: !!wire && !!join,
    join,
    all,
    atFocus,
    selected,
    ribat,
    ribatAll: wire?.ribat ?? [],
    counts,
    coverage: wire?.coverage ?? null,
    cutAway,
    derivation,
  };
}
