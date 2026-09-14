'use client';
// ============================================================================
//  الخيوط — the client side of the strand layer.
//
//  Three sources, joined here and nowhere else:
//
//    السنابل     rebuilt locally from `node.sb`, so 7,000 edges cost nothing
//                on the wire. They stay a navigation layer: traversable
//                always, drawable only when asked for.
//    the wire    motifs, roots and detector findings, built server-side
//                because they need 2.3 MB of mined indices to produce.
//    الرنين      resonance, which is computed *against* an āyah and so is
//                fetched for whichever one is in focus.
//
//  Selection is the whole point of the hook. The field holds ~10,300
//  relationships; a frame is allowed a few hundred, and which few hundred
//  depends on where the reader is standing and what the flight board admits.
// ============================================================================
import * as React from 'react';
import type { CosmosNode } from '@/lib/cosmos';
import { buildLocusJoin, type LocusJoin } from '@/lib/cosmos/locus';
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

export interface StrandField {
  ready: boolean;
  join: LocusJoin | null;
  /** Everything that exists, before selection — for counts and inspection. */
  all: Strand[];
  /** Strands touching the focused āyah, all of them, for the inspector list. */
  atFocus: SelectedStrand[];
  /** What the renderer is handed. */
  selected: SelectedStrand[];
  ribat: SelectedRibat[];
  ribatAll: RibatVector[];
  counts: Record<StrandKind, number>;
}

const EMPTY_COUNTS: Record<StrandKind, number> = {
  sunbula: 0,
  motif: 0,
  root: 0,
  discovery: 0,
  resonance: 0,
};

export function useStrandField(
  nodes: CosmosNode[],
  focus: number | null,
  admitted: Set<number> | null,
  opt: StrandOptions,
): StrandField {
  const [wire, setWire] = React.useState<(PackedStrands & { ribat: RibatVector[] }) | null>(null);
  const [resonance, setResonance] = React.useState<{ node: number; matches: Resonance[] } | null>(null);

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

  // Resonance is anchored, so it is fetched per focus and cached nowhere: the
  // route is already memoised server-side over the whole āyah index.
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

  const base = React.useMemo(() => {
    if (!nodes.length) return [] as Strand[];
    return [...sunbulaStrands(nodes), ...(wire ? unpackStrands(wire) : [])];
  }, [nodes, wire]);

  const adjacency = React.useMemo(() => buildAdjacency(base), [base]);

  const resonant = React.useMemo(() => {
    if (!join || !resonance || resonance.node !== focus) return [] as Strand[];
    return resonanceStrands(resonance.node, resonance.matches, join);
  }, [join, resonance, focus]);

  const all = React.useMemo(() => [...base, ...resonant], [base, resonant]);

  const counts = React.useMemo(() => {
    const c = { ...EMPTY_COUNTS };
    for (const s of all) c[s.kind]++;
    return c;
  }, [all]);

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
    const merged = [
      ...chosen,
      ...resonant.map((s) => ({ ...s, hop: 0, prominence: s.weight })),
    ];
    merged.sort((x, y) => y.prominence - x.prominence);
    return merged.slice(0, opt.budget);
  }, [adjacency, focus, admitted, opt.budget, opt.depth, opt.kinds, resonant]);

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

  return {
    ready: !!wire && !!join,
    join,
    all,
    atFocus,
    selected,
    ribat,
    ribatAll: wire?.ribat ?? [],
    counts,
  };
}
