// ============================================================================
//  الخيوط — relationships the engine already computed, as drawable edges.
//
//  A strand is not a new finding. Every one of them restates something the
//  corpus engine had already established and printed as prose: a repeated
//  contour, a returning root, a detector's two banks, a resonance. The only
//  thing added here is that both ends are now known to occupy positions, so
//  the relationship can be *shown* instead of described.
//
//  Two rules hold the layer honest:
//
//  1. A strand carries the engine's own evidence verbatim — the motif's
//     pattern, the root, the discovery's kind and title, the resonance's
//     reason. Nothing is paraphrased into a claim, because a line on a canvas
//     reads as an assertion and the assertion must be the engine's.
//
//  2. Building every possible strand is not the same as drawing them. The
//     builders below produce the full relation (~10,000 strands); `select`
//     decides what a frame is allowed to show, and the answer is a few
//     hundred at most. A dense field communicates nothing.
//
//  Multi-occurrence relations become *chains* in muṣḥaf order, not cliques.
//  A root in twelve āyāt is one path through the field, read as the muṣḥaf
//  reads it; the clique would be sixty-six lines saying the same thing.
// ============================================================================
import type { Discovery, DiscoveryKind, Motif, Person } from '../types';
import type { Resonance, ResonanceKind, RootIndex } from '../engine/graph';
import type { LocusJoin } from './locus';
import type { CosmosNode } from './types';
import { DISTANCE_OF } from '../isnad';
import { pointAtDistance, type Vec3 } from './placement';

export type StrandKind = 'sunbula' | 'motif' | 'root' | 'discovery' | 'resonance';

export type StrandEvidence =
  | { kind: 'sunbula'; branch: number }
  | {
      kind: 'motif';
      motif: string;
      pattern: string;
      gloss: string;
      length: number;
      /** Occurrences anywhere in the muṣḥaf. */
      occurrences: number;
      /** How many of those fall on a placed āyah. Always ≤ occurrences. */
      placed: number;
    }
  | {
      kind: 'root';
      root: string;
      /** Loci anywhere in the muṣḥaf. */
      loci: number;
      /** How many of those fall on a placed āyah. Always ≤ loci. */
      placed: number;
    }
  | {
      kind: 'discovery';
      discovery: string;
      discoveryKind: DiscoveryKind;
      title: string;
      score: number;
      sharedRoots: string[];
    }
  | { kind: 'resonance'; resonance: ResonanceKind; score: number; sig: string; reason: string };

export interface Strand {
  id: string;
  /** Node indices. `a` precedes `b` in muṣḥaf order for every builder but سنابل. */
  a: number;
  b: number;
  kind: StrandKind;
  /** Structural relevance, 0…1. Comparable across kinds by construction. */
  weight: number;
  evidence: StrandEvidence;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Consecutive pairs of a chain — the path, not the clique. */
function links(chain: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 1; i < chain.length; i++) out.push([chain[i - 1], chain[i]]);
  return out;
}

// ── السنابل ─────────────────────────────────────────────────────────────────
/**
 * The seven branches each node already carries. These stay a *navigation*
 * layer: 7,000 of them exist, they are how the walk works, and they are the
 * one strand family that must never be drawn wholesale.
 */
export function sunbulaStrands(nodes: readonly CosmosNode[]): Strand[] {
  const out: Strand[] = [];
  for (const n of nodes) {
    n.sb.forEach((j, branch) => {
      if (j === undefined || j === n.i) return;
      out.push({
        id: `sb:${n.i}:${branch}`,
        a: n.i,
        b: j,
        kind: 'sunbula',
        // Earlier branches scored higher in the ingest; keep that ordering.
        weight: clamp01(0.62 - branch * 0.06),
        evidence: { kind: 'sunbula', branch },
      });
    });
  }
  return out;
}

// ── المثاني ─────────────────────────────────────────────────────────────────
/**
 * A repeated isnād contour, chained through the āyāt that carry it. Longer
 * contours are rarer and weigh more; a contour that recurs everywhere weighs
 * less, since ubiquity is the opposite of structure.
 */
export function motifStrands(motifs: readonly Motif[], join: LocusJoin): Strand[] {
  const out: Strand[] = [];
  for (const m of motifs) {
    const chain = join.chain(m.occurrences.map((o) => ({ surah: o.surah, ayah: o.ayah })));
    if (chain.length < 2) continue;
    const rarity = 1 / Math.log2(2 + m.occurrences.length);
    const weight = clamp01(0.2 + Math.min(m.length, 12) * 0.045 + rarity * 0.4);
    // The chain length is the placed count. It was already computed to build
    // the links and was then thrown away, which is what made the field able to
    // show a contour's 27 drawn segments without ever saying it recurs 60 times.
    links(chain).forEach(([a, b], k) => {
      out.push({
        id: `mo:${m.id}:${k}`,
        a,
        b,
        kind: 'motif',
        weight,
        evidence: {
          kind: 'motif',
          motif: m.id,
          pattern: m.pattern,
          gloss: m.gloss,
          length: m.length,
          occurrences: m.occurrences.length,
          placed: chain.length,
        },
      });
    });
  }
  return out;
}

// ── رجع الجذر ───────────────────────────────────────────────────────────────
export interface RootStrandOptions {
  /** Below this the root is not repeated at all. */
  minLoci: number;
  /**
   * Above this the root is vocabulary rather than structure. The chamber walk
   * already draws the line at 24; the same line is drawn here so the two
   * agree about which roots carry a relationship.
   */
  maxLoci: number;
}
export const DEFAULT_ROOT_OPTIONS: RootStrandOptions = { minLoci: 2, maxLoci: 24 };

export function rootStrands(
  roots: RootIndex,
  join: LocusJoin,
  opt: RootStrandOptions = DEFAULT_ROOT_OPTIONS,
): Strand[] {
  const out: Strand[] = [];
  for (const [root, places] of Object.entries(roots)) {
    if (places.length < opt.minLoci || places.length > opt.maxLoci) continue;
    const chain = join.chain(places.map(([surah, ayah]) => ({ surah, ayah })));
    if (chain.length < 2) continue;
    // Rarity is the whole signal: a root in three places binds them; a root in
    // twenty-four barely binds anything.
    const weight = clamp01(0.18 + (1 / places.length) * 1.9);
    links(chain).forEach(([a, b], k) => {
      out.push({
        id: `rt:${root}:${k}`,
        a,
        b,
        kind: 'root',
        weight,
        evidence: { kind: 'root', root, loci: places.length, placed: chain.length },
      });
    });
  }
  return out;
}

// ── الاستنباطات ─────────────────────────────────────────────────────────────
/**
 * A detector's two banks, when both are placed. This is the strictest family:
 * the discovery already asserts that these two āyāt stand in a named relation,
 * so the strand is the finding itself rather than an inference from it.
 */
export function discoveryStrands(discoveries: readonly Discovery[], join: LocusJoin): Strand[] {
  const out: Strand[] = [];
  for (const d of discoveries) {
    if (d.ayahFrom === d.ayahTo) continue;
    const a = join.at(d.surah, d.ayahFrom);
    const b = join.at(d.surah, d.ayahTo);
    if (a === undefined || b === undefined || a === b) continue;
    out.push({
      id: `dc:${d.id}`,
      a,
      b,
      kind: 'discovery',
      weight: clamp01(0.4 + d.score * 0.55),
      evidence: {
        kind: 'discovery',
        discovery: d.id,
        discoveryKind: d.kind,
        title: d.title,
        score: d.score,
        sharedRoots: sharedRootsOf(d),
      },
    });
  }
  return out;
}

/**
 * Four of the eight detectors report the lexical material that holds a seam
 * together, each under its own Arabic key. They are the same quantity.
 */
export function sharedRootsOf(d: Discovery): string[] {
  for (const key of ['الجذور الرابطة', 'جذور رابطة', 'جذور عابرة']) {
    const v = d.evidence[key];
    if (Array.isArray(v)) return v as string[];
  }
  return [];
}

// ── الرنين ──────────────────────────────────────────────────────────────────
/**
 * Resonance is computed against one anchor, so these are built on demand for
 * whatever āyah is in focus rather than mined for the whole field. The four
 * kinds the engine distinguishes are passed through untouched; what a
 * reversal or an inversion *means* is not decided here.
 */
export function resonanceStrands(
  anchor: number,
  matches: readonly Resonance[],
  join: LocusJoin,
): Strand[] {
  const out: Strand[] = [];
  for (const r of matches) {
    const b = join.at(r.surah, r.ayah);
    if (b === undefined || b === anchor) continue;
    out.push({
      id: `rs:${anchor}:${r.surah}:${r.ayah}`,
      a: anchor,
      b,
      kind: 'resonance',
      weight: clamp01(r.score),
      evidence: { kind: 'resonance', resonance: r.kind, score: r.score, sig: r.sig, reason: r.reason },
    });
  }
  return out;
}

// ── رِباط: حركة المحور as an actual displacement ────────────────────────────
/**
 * رِباط الملتقى reports a signed movement along the proximity axis: the
 * attribution leaves one person and arrives at another, and the axis records
 * how far. Radius in this field *is* that axis, so the movement has an exact
 * spatial form, with nothing interpolated and nothing interpreted.
 *
 * The two ends are the two *person shells* — the radii at which المخاطب،
 * المتكلم and الغائب sit — taken along the āyah's own ray. That, and not the
 * node's own distance plus the delta, is what the detector actually measured:
 * `d` is the āyah's aggregate over every attribution in it, while the delta is
 * between two single positions, and the two are not on the same footing.
 *
 * When the landing āyah is itself placed, `to` names it and the displacement
 * becomes a real trajectory between two nodes instead.
 */
export interface RibatVector {
  id: string;
  /** Node the movement departs from. */
  node: number;
  /** Node it lands on, when that āyah is also in the field. */
  to: number | null;
  from: Person;
  toPerson: Person;
  /** Signed, on the proximity axis: negative اقترابًا, positive ابتعادًا. */
  axisDelta: number;
  /** Where the attribution left from and arrived at, on that axis. */
  fromDistance: number;
  toDistance: number;
  tenseShift: boolean;
  sharedRoots: string[];
  score: number;
  /** Word index of the seam, for entering the āyah at the right word. */
  seam: number | null;
}

const PERSON_OF: Record<string, Person> = { 'المتكلم': 1, 'المخاطب': 2, 'الغائب': 3 };

export function ribatVectors(discoveries: readonly Discovery[], join: LocusJoin): RibatVector[] {
  const out: RibatVector[] = [];
  for (const d of discoveries) {
    if (d.kind !== 'ribat') continue;
    const axisDelta = Number(d.evidence['حركة المحور']);
    if (!Number.isFinite(axisDelta) || axisDelta === 0) continue;
    const node = join.at(d.surah, d.ayahFrom);
    if (node === undefined) continue;
    const from = PERSON_OF[String(d.evidence['من'])];
    const toPerson = PERSON_OF[String(d.evidence['إلى'])];
    if (!from || !toPerson) continue;
    const landing = join.at(d.surah, d.ayahTo);
    out.push({
      id: `rb:${d.id}`,
      node,
      to: landing !== undefined && landing !== node ? landing : null,
      from,
      toPerson,
      axisDelta,
      fromDistance: DISTANCE_OF[from],
      toDistance: DISTANCE_OF[toPerson],
      tenseShift: d.evidence['تغيّر الزمن'] === 'نعم',
      sharedRoots: sharedRootsOf(d),
      score: d.score,
      seam: d.seam ?? null,
    });
  }
  return out;
}

/**
 * The two ends of a رِباط displacement, in world space, and the node it is
 * anchored to. Where the landing āyah is placed the segment runs between the
 * two āyāt, which is the more truthful reading; otherwise it runs between the
 * two person shells along the anchor's own ray, whose radial extent is exactly
 * |حركة المحور| by construction.
 */
export function ribatSegment(
  v: RibatVector,
  nodes: readonly CosmosNode[],
): { head: Vec3; tail: Vec3; anchor: Vec3 } {
  const anchor = nodes[v.node].p;
  if (v.to !== null) return { head: anchor, tail: nodes[v.to].p, anchor };
  return {
    head: pointAtDistance(anchor, v.fromDistance),
    tail: pointAtDistance(anchor, v.toDistance),
    anchor,
  };
}

// ── adjacency and selection ─────────────────────────────────────────────────

export interface StrandAdjacency {
  /** Strand indices incident to each node. */
  byNode: Map<number, number[]>;
  strands: Strand[];
}

export function buildAdjacency(strands: Strand[]): StrandAdjacency {
  const byNode = new Map<number, number[]>();
  const push = (node: number, i: number) => {
    const list = byNode.get(node);
    if (list) list.push(i);
    else byNode.set(node, [i]);
  };
  strands.forEach((s, i) => {
    push(s.a, i);
    push(s.b, i);
  });
  return { byNode, strands };
}

export interface SelectOptions {
  /** The āyah in focus, if any. */
  focus: number | null;
  /** Nodes the flight board admits, or null when the whole field is admitted. */
  admitted: Set<number> | null;
  /** Hard ceiling on drawn strands. The field must stay sparse. */
  budget: number;
  /** Hops out from focus. Beyond 2 the neighbourhood stops being legible. */
  depth: number;
  /** Which families may be drawn at all. */
  kinds: Partial<Record<StrandKind, boolean>>;
  /**
   * Give each family a share of the budget instead of letting the strongest
   * take everything. Without this the skeleton is 257 discovery strands and
   * three motifs: detector scores sit near 1 while a common contour sits near
   * 0.3, so one family drowns the rest and the field stops showing that it
   * computes more than one kind of thing.
   */
  balance: boolean;
}

export const DEFAULT_SELECT: SelectOptions = {
  focus: null,
  admitted: null,
  budget: 320,
  depth: 2,
  kinds: { motif: true, root: true, discovery: true, resonance: true, sunbula: true },
  balance: true,
};

export interface SelectedStrand extends Strand {
  /** Hops from focus: 0 when incident to it, −1 when focus-independent. */
  hop: number;
  /** Weight after decay and admission, which is what the renderer draws with. */
  prominence: number;
}

/**
 * What a frame may show.
 *
 * With no focus the field shows its skeleton: the strongest strands anywhere,
 * which is what makes a "formidable structure" visible as a structure before
 * anyone has clicked on anything. With a focus it shows that āyah's structural
 * neighbourhood, decaying with each hop.
 *
 * The flight board narrows rather than hides: a strand leaving the admitted
 * set is dimmed, not deleted, so a route reads as a passage through the field
 * rather than as a different field.
 */
export function selectStrands(adj: StrandAdjacency, opt: SelectOptions = DEFAULT_SELECT): SelectedStrand[] {
  const { strands } = adj;
  const allowed = (s: Strand) => opt.kinds[s.kind] !== false;
  const admits = (i: number) => !opt.admitted || opt.admitted.has(i);

  const hops = new Map<number, number>();
  if (opt.focus !== null) {
    // Breadth-first over the strand graph, recording the hop each strand was
    // first reached at. سنابل are traversable even when not drawable: they are
    // the navigation layer, so they must still connect the neighbourhood.
    let frontier = [opt.focus];
    const seen = new Set<number>([opt.focus]);
    for (let hop = 0; hop < Math.max(1, opt.depth) && frontier.length; hop++) {
      const next: number[] = [];
      for (const n of frontier) {
        for (const si of adj.byNode.get(n) ?? []) {
          if (!hops.has(si)) hops.set(si, hop);
          const other = strands[si].a === n ? strands[si].b : strands[si].a;
          if (!seen.has(other)) {
            seen.add(other);
            next.push(other);
          }
        }
      }
      frontier = next;
    }
  }

  const out: SelectedStrand[] = [];
  const consider = opt.focus !== null ? [...hops.keys()] : strands.map((_, i) => i);

  for (const si of consider) {
    const s = strands[si];
    if (!allowed(s)) continue;
    const hop = opt.focus !== null ? (hops.get(si) ?? 0) : -1;
    const incidentToFocus = opt.focus !== null && (s.a === opt.focus || s.b === opt.focus);

    const bothAdmitted = admits(s.a) && admits(s.b);
    const eitherAdmitted = admits(s.a) || admits(s.b);
    if (!eitherAdmitted && !incidentToFocus) continue;

    const decay = hop < 0 ? 1 : Math.pow(0.55, hop);
    const admission = bothAdmitted ? 1 : 0.32;
    out.push({ ...s, hop, prominence: s.weight * decay * admission });
  }

  out.sort((x, y) => y.prominence - x.prominence);
  return opt.balance ? balanceByFamily(out, opt.budget) : out.slice(0, opt.budget);
}

/**
 * Round-robin across the families present, best first within each. Smaller
 * families exhaust and drop out, so nothing is wasted, and the budget is never
 * spent entirely on whichever detector happens to score highest.
 */
function balanceByFamily(pool: SelectedStrand[], budget: number): SelectedStrand[] {
  const byKind = new Map<StrandKind, SelectedStrand[]>();
  for (const s of pool) {
    const list = byKind.get(s.kind);
    if (list) list.push(s);
    else byKind.set(s.kind, [s]);
  }
  const families = [...byKind.keys()];
  const cursor = new Map<StrandKind, number>(families.map((k) => [k, 0]));
  const out: SelectedStrand[] = [];
  while (out.length < budget) {
    let took = 0;
    for (const k of families) {
      if (out.length >= budget) break;
      const c = cursor.get(k)!;
      const list = byKind.get(k)!;
      if (c >= list.length) continue;
      out.push(list[c]);
      cursor.set(k, c + 1);
      took++;
    }
    if (!took) break;
  }
  out.sort((x, y) => y.prominence - x.prominence);
  return out;
}

// ── which displacements a frame may show ────────────────────────────────────
export interface RibatSelectOptions {
  focus: number | null;
  admitted: Set<number> | null;
  budget: number;
}

export interface SelectedRibat extends RibatVector {
  prominence: number;
}

/**
 * رِباط displacements follow the same rule as strands: with a focus, only the
 * ones departing or landing there; without one, the strongest in the field.
 * Two hundred and eighty-two exist, which is already few enough to be a
 * structure rather than a texture, but not few enough to draw at once.
 */
export function selectRibat(
  vectors: readonly RibatVector[],
  opt: RibatSelectOptions,
): SelectedRibat[] {
  const admits = (i: number) => !opt.admitted || opt.admitted.has(i);
  const out: SelectedRibat[] = [];
  for (const v of vectors) {
    const incident = opt.focus !== null && (v.node === opt.focus || v.to === opt.focus);
    if (opt.focus !== null && !incident) continue;
    const admitted = admits(v.node) && (v.to === null || admits(v.to));
    if (!admitted && !incident) continue;
    out.push({ ...v, prominence: v.score * (admitted ? 1 : 0.32) * (incident ? 1 : 0.72) });
  }
  out.sort((x, y) => y.prominence - x.prominence);
  return out.slice(0, opt.budget);
}
