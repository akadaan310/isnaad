// ============================================================================
//  الالتقاء — navigation as a computed relation rather than a list of places.
//
//  `structures.ts` asks a global question — which groupings in the whole field
//  several independent families of relation agree on — and answers it honestly
//  enough to record that none of them is *local*: median extent 154 in a field
//  whose widest grouping spans 233. Threads and sections through the whole
//  space, not places in it. That is a verdict against a surface to stand on,
//  and it reads *for* a trajectory to follow.
//
//  This is that trajectory, at the only scale where the same evidence is local:
//  one āyah at a time. Standing at A, which other āyāt does more than one
//  independent family of relation point to? The bar is the bar `structures.ts`
//  already set and for the same reason: one family saying so is a finding,
//  several saying so is a structure.
//
//  ── what a relation is, here ────────────────────────────────────────────────
//
//  Not a drawn line. `strands.ts` turns a contour recurring in twelve āyāt into
//  eleven *chained* segments in muṣḥaf order, and says plainly why: "the clique
//  would be sixty-six lines saying the same thing". That is a decision about
//  what a canvas can carry, not a finding that the first and the twelfth
//  occurrence are unrelated. Navigating on the chain would inherit a rendering
//  economy as though it were evidence — and it measurably does: over chain
//  adjacency only 68 of the 1,000 placed āyāt have any convergence at all,
//  because two families agreeing on the *same consecutive pair* is an accident
//  of muṣḥaf order.
//
//  So the unit here is the group, exactly as `structures.ts` builds it: the
//  placed occurrences of one contour, the placed loci of one root, the two
//  banks of one detector finding, one resonance match. Two āyāt are related by
//  a family when a group of that family holds them both.
//
//  ── the rules ───────────────────────────────────────────────────────────────
//
//  1. السنابل are not evidence. Seven neighbours per node, derived from isnād
//     and time similarity in the ingest — they agree with everything by
//     construction, and they already welded 996 of 1,000 āyāt into one label
//     when they were let into community detection. Excluded from support *and*
//     from traversal: a leg carried by a سنبلة would put a regular degree where
//     an agreement is claimed.
//
//  2. A class counts once, and four families are not four classes. Three roots
//     shared with the same destination are one reading of the lexicon agreeing,
//     not three; and المثاني and الرنين both read the isnād contour, so two of
//     them agreeing is one computation counted twice. Support counts
//     independence classes — see `CLASS_OF` — and each contributes only its
//     strongest group, so volume cannot read as agreement.
//
//  3. Evidence travels verbatim. A `FamilyWitness` carries the engine's own
//     `StrandEvidence` — the contour's pattern, the root, the detector's title
//     and score — because arriving somewhere asserts the reason for arriving
//     and the assertion must be the engine's.
//
//  4. A two-leg route is not a relation. A→M→B on two different classes says
//     nothing whatever about A and B; it is a way *through* the field, and it
//     is reported in its own tier, never folded into support.
//
//  Nothing here reads a position. Support survives a change of basis and this
//  layer inherits that: every quantity below is computed from the relation
//  groups alone, so where the āyāt were drawn cannot change where you can go.
// ============================================================================
import type { Strand, StrandEvidence, StrandKind } from './strands';

/** Every family but السنابل — the ones that count as independent evidence. */
export type EvidenceFamily = Exclude<StrandKind, 'sunbula'>;

export const EVIDENCE_FAMILIES: EvidenceFamily[] = ['motif', 'root', 'discovery', 'resonance'];

/**
 * What counts as *independent*.
 *
 * Four families is not four independent witnesses. المثاني mines repeated
 * substrings of the isnād contour; الرنين compares one āyah's whole contour
 * against every other's, and its `identical`, `inverted` and `mirrored` kinds
 * are that same string read three ways. Two of them agreeing about a pair is
 * one computation counted twice — the error the سنابل exclusion exists to
 * prevent, arriving by a different door. So support counts *classes*, and the
 * two contour readings share one.
 *
 * The three classes follow `structures.ts`, which already holds contours, roots
 * and detectors to be independent of each other. That is not a claim of
 * perfect independence and should not be read as one: four of the eight
 * detectors report the lexical material holding a seam together, so الاستنباط
 * and اللفظ do touch. The classes below are the coarsest grouping the
 * repository's own measurements already commit to, not a proof.
 */
export type IndependenceClass = 'contour' | 'lexical' | 'detector';

export const CLASS_OF: Record<EvidenceFamily, IndependenceClass> = {
  motif: 'contour',
  resonance: 'contour',
  root: 'lexical',
  discovery: 'detector',
};

export const isEvidence = (s: Strand): boolean => s.kind !== 'sunbula';

/**
 * One computation of one family, and every placed āyah it holds: the
 * occurrences of a contour, the loci of a root, the two banks of a finding, the
 * two ends of a resonance.
 */
export interface RelationGroup {
  id: string;
  family: EvidenceFamily;
  /** Placed āyāt, by node index. Always ≥ 2 — a group of one relates nothing. */
  members: number[];
  /** The engine's own account, carried from the strand that produced it. */
  evidence: StrandEvidence;
  weight: number;
}

export interface RelationIndex {
  groups: RelationGroup[];
  /** Group indices each āyah belongs to. */
  byNode: Map<number, number[]>;
}

/**
 * The key a strand's evidence groups under. Chained families collapse to the
 * computation they came from — every segment of one contour is that contour —
 * while the pairwise families are already one relation per strand.
 */
function groupKey(s: Strand): string | null {
  switch (s.evidence.kind) {
    case 'motif':
      return `mo:${s.evidence.pattern}`;
    case 'root':
      return `rt:${s.evidence.root}`;
    case 'discovery':
      return `dc:${s.evidence.discovery}`;
    case 'resonance':
      return `rs:${s.id}`;
    case 'sunbula':
      return null;
  }
}

/**
 * Rebuild the groups from the strands that were drawn from them. The evidence
 * record is taken from the strongest strand of the group, which for the chained
 * families is any of them: `motifStrands` and `rootStrands` give every segment
 * of one computation the same weight and the same evidence by construction.
 */
export function buildRelationIndex(strands: readonly Strand[]): RelationIndex {
  const collected = new Map<string, { family: EvidenceFamily; members: Set<number>; evidence: StrandEvidence; weight: number }>();
  for (const s of strands) {
    const key = groupKey(s);
    if (key === null) continue;
    const held = collected.get(key);
    if (held) {
      held.members.add(s.a).add(s.b);
      if (s.weight > held.weight) {
        held.weight = s.weight;
        held.evidence = s.evidence;
      }
    } else {
      collected.set(key, {
        family: s.kind as EvidenceFamily,
        members: new Set([s.a, s.b]),
        evidence: s.evidence,
        weight: s.weight,
      });
    }
  }

  const groups: RelationGroup[] = [];
  const byNode = new Map<number, number[]>();
  // Keys are walked in insertion order and members sorted, so the index — and
  // everything computed from it — is the same on every run.
  for (const [id, g] of collected) {
    if (g.members.size < 2) continue;
    const gi = groups.length;
    groups.push({ id, family: g.family, members: [...g.members].sort((a, b) => a - b), evidence: g.evidence, weight: g.weight });
    for (const m of groups[gi].members) {
      const list = byNode.get(m);
      if (list) list.push(gi);
      else byNode.set(m, [gi]);
    }
  }
  return { groups, byNode };
}

/** One family's account of a single leg, in the engine's own words. */
export interface FamilyWitness {
  family: EvidenceFamily;
  /** Strongest first. Verbatim — the group's own evidence, unparaphrased. */
  evidence: StrandEvidence[];
  /** The strongest group of this family on this leg. */
  weight: number;
  /** How many groups of this family hold both āyāt, including those not shown. */
  count: number;
}

/** A destination several independent families point to from the anchor. */
export interface Convergence {
  node: number;
  /** Distinct independent *classes* holding the anchor and this āyah together. */
  support: number;
  classes: IndependenceClass[];
  families: EvidenceFamily[];
  witnesses: FamilyWitness[];
  /** Σ over classes of that class's strongest group. Volume cannot inflate it. */
  strength: number;
}

/**
 * A way through the field: two legs, two different families, no claim about
 * the ends. A chain is worth its weakest link, which is what `strength` is.
 */
export interface Route {
  node: number;
  via: number;
  first: FamilyWitness;
  second: FamilyWitness;
  strength: number;
}

export interface ConvergenceReport {
  anchor: number;
  /** Relation groups the anchor belongs to, per family. */
  atAnchor: Record<EvidenceFamily, number>;
  /** Distinct āyāt sharing at least one group with the anchor. */
  neighbours: number;
  /** Of those, how many only one class holds — a finding, not a structure. */
  single: number;
  /** Of those, how many cleared `minSupport`. `convergences` may be truncated; this is not. */
  converging: number;
  convergences: Convergence[];
  /** Distinct āyāt two legs away sharing no group with the anchor. */
  reachable: number;
  routes: Route[];
}

export interface ConvergenceOptions {
  /** Independence classes that must agree before a destination is a convergence. */
  minSupport: number;
  /** Convergences returned. The count before truncation is reported separately. */
  limit: number;
  /** Routes returned. */
  routeLimit: number;
  /** Evidence records carried per family per leg. */
  evidencePerFamily: number;
}

export const DEFAULT_CONVERGENCE: ConvergenceOptions = {
  // The same bar structures.ts sets, and for the same reason.
  minSupport: 2,
  limit: 12,
  routeLimit: 8,
  evidencePerFamily: 3,
};

const emptyTally = (): Record<EvidenceFamily, number> => ({
  motif: 0,
  root: 0,
  discovery: 0,
  resonance: 0,
});

/** Groups gathered by family, strongest first within each. */
function witnessesOf(groups: RelationGroup[], evidencePerFamily: number): FamilyWitness[] {
  const byFamily = new Map<EvidenceFamily, RelationGroup[]>();
  for (const g of groups) {
    const list = byFamily.get(g.family);
    if (list) list.push(g);
    else byFamily.set(g.family, [g]);
  }
  const out: FamilyWitness[] = [];
  for (const [family, list] of byFamily) {
    // Ties break on the group id so a report is the same on every run.
    list.sort((a, b) => b.weight - a.weight || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    out.push({
      family,
      evidence: list.slice(0, evidencePerFamily).map((g) => g.evidence),
      weight: list[0].weight,
      count: list.length,
    });
  }
  out.sort(
    (a, b) =>
      b.weight - a.weight || EVIDENCE_FAMILIES.indexOf(a.family) - EVIDENCE_FAMILIES.indexOf(b.family),
  );
  return out;
}

/** The distinct independence classes a set of witnesses speaks for. */
export function classesOf(witnesses: readonly FamilyWitness[]): IndependenceClass[] {
  const seen = new Set<IndependenceClass>();
  for (const w of witnesses) seen.add(CLASS_OF[w.family]);
  return [...seen];
}

/** The strongest witness in each class, which is what a class contributes. */
function strengthOf(witnesses: readonly FamilyWitness[]): number {
  const best = new Map<IndependenceClass, number>();
  for (const w of witnesses) {
    const c = CLASS_OF[w.family];
    best.set(c, Math.max(best.get(c) ?? 0, w.weight));
  }
  let sum = 0;
  for (const w of best.values()) sum += w;
  return sum;
}

/** Every āyah sharing a group with `node`, and which groups those are. */
function legsFrom(node: number, index: RelationIndex): Map<number, RelationGroup[]> {
  const out = new Map<number, RelationGroup[]>();
  for (const gi of index.byNode.get(node) ?? []) {
    const g = index.groups[gi];
    for (const m of g.members) {
      if (m === node) continue;
      const list = out.get(m);
      if (list) list.push(g);
      else out.set(m, [g]);
    }
  }
  return out;
}

/**
 * Where you can go from here, and on whose authority.
 *
 * `index` must be built over the relations that are allowed to count —
 * including الرنين when it has been computed for this anchor, since resonance
 * is anchored by construction and only exists once an āyah is in focus.
 */
export function convergenceAt(
  anchor: number,
  index: RelationIndex,
  opt: ConvergenceOptions = DEFAULT_CONVERGENCE,
): ConvergenceReport {
  const first = legsFrom(anchor, index);

  const atAnchor = emptyTally();
  for (const gi of index.byNode.get(anchor) ?? []) atAnchor[index.groups[gi].family]++;

  const convergences: Convergence[] = [];
  let single = 0;
  for (const [node, groups] of first) {
    const witnesses = witnessesOf(groups, opt.evidencePerFamily);
    const classes = classesOf(witnesses);
    if (classes.length < 2) single++;
    if (classes.length < opt.minSupport) continue;
    convergences.push({
      node,
      support: classes.length,
      classes,
      families: witnesses.map((w) => w.family),
      witnesses,
      // A class contributes once: three shared roots are one reading of the
      // lexicon agreeing, not three, and a contour seen by both المثاني and
      // الرنين is one contour.
      strength: strengthOf(witnesses),
    });
  }
  convergences.sort((a, b) => b.support - a.support || b.strength - a.strength || a.node - b.node);

  // ── the second ring ───────────────────────────────────────────────────────
  // A route is a way through, not a claim: destinations that already share a
  // group with the anchor are excluded, because those are reported above at
  // their true support and a route would double-count them.
  const routes = new Map<number, Route>();
  for (const [via, firstGroups] of first) {
    const firstWitnesses = witnessesOf(firstGroups, opt.evidencePerFamily);
    for (const [node, secondGroups] of legsFrom(via, index)) {
      if (node === anchor || first.has(node)) continue;
      const secondWitnesses = witnessesOf(secondGroups, opt.evidencePerFamily);
      for (const a of firstWitnesses) {
        for (const b of secondWitnesses) {
          // Two legs of the same class are one reading stretched over two
          // steps — not the meeting of independent computations this tier is
          // for.
          if (CLASS_OF[a.family] === CLASS_OF[b.family]) continue;
          const strength = Math.min(a.weight, b.weight);
          const held = routes.get(node);
          if (held && held.strength >= strength) continue;
          routes.set(node, { node, via, first: a, second: b, strength });
        }
      }
    }
  }
  const ranked = [...routes.values()].sort((a, b) => b.strength - a.strength || a.node - b.node);

  return {
    anchor,
    atAnchor,
    neighbours: first.size,
    single,
    converging: convergences.length,
    convergences: convergences.slice(0, opt.limit),
    reachable: routes.size,
    routes: ranked.slice(0, opt.routeLimit),
  };
}

/**
 * Where the field starts.
 *
 * A first position has to come from somewhere, and a list to pick from is the
 * menu this whole layer exists to avoid. So it is computed on the same measure
 * as everything downstream: the āyah on which the most independent families
 * agree about the most destinations, ties broken by total strength and then by
 * muṣḥaf order so the answer never depends on the run.
 *
 * الرنين is deliberately not in this scan. It is computed against an anchor,
 * so including it would mean ranking every āyah on a quantity that only exists
 * once one of them has already been chosen.
 */
export function computedOrigin(
  nodeCount: number,
  index: RelationIndex,
  opt: ConvergenceOptions = DEFAULT_CONVERGENCE,
): { node: number; converging: number; strength: number } | null {
  let best: { node: number; converging: number; strength: number } | null = null;
  for (let i = 0; i < nodeCount; i++) {
    if (!index.byNode.has(i)) continue;
    let converging = 0;
    let strength = 0;
    for (const groups of legsFrom(i, index).values()) {
      // Strongest group per class, as everywhere else in this module.
      const perClass = new Map<IndependenceClass, number>();
      for (const g of groups) {
        const c = CLASS_OF[g.family];
        perClass.set(c, Math.max(perClass.get(c) ?? 0, g.weight));
      }
      if (perClass.size < opt.minSupport) continue;
      converging++;
      for (const w of perClass.values()) strength += w;
    }
    if (!converging) continue;
    if (
      !best ||
      converging > best.converging ||
      (converging === best.converging && strength > best.strength)
    ) {
      best = { node: i, converging, strength };
    }
  }
  return best;
}
