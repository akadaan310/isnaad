// ============================================================================
//  الموقع — the join between locus space and cosmic space.
//
//  Everything the engine mines is addressed by موقع: a سورة، آية, and often a
//  span of word indices. Everything the field renders is addressed by node
//  index. Nothing in the repository connected the two, so motifs, roots,
//  resonances and discoveries — all of them already computed, all of them
//  already about pairs of āyāt — had no way to become anything spatial.
//
//  This is that join, and nothing more. It copies no corpus data: a node
//  record stays the single source of truth for its own āyah, and the join
//  holds only indices into the array it was built from.
// ============================================================================

export interface Locus {
  surah: number;
  ayah: number;
}

/**
 * The minimum a node must expose to be joinable — deliberately the field names
 * `CosmosNode` already uses, so a node array joins with no adaptation.
 */
export interface PlacedLocus {
  /** Index into the node array. */
  i: number;
  /** سورة */
  s: number;
  /** آية */
  a: number;
}

export type LocusKey = string;

export const locusKey = (surah: number, ayah: number): LocusKey => `${surah}:${ayah}`;

export interface Coverage {
  /** Loci offered, after de-duplication. */
  distinct: number;
  /** How many of those carry a placed node. */
  placed: number;
  /** placed / distinct, or 0 when nothing was offered. */
  ratio: number;
}

export interface LocusJoin {
  /** Number of placed loci. */
  readonly size: number;
  /** The node index at a locus, or undefined if the āyah was not placed. */
  at(surah: number, ayah: number): number | undefined;
  has(surah: number, ayah: number): boolean;
  /** The āyah a node stands at. */
  locusOf(node: number): Locus | undefined;
  /**
   * Loci → node indices: de-duplicated, and in the order the loci arrived.
   * Unplaced loci are dropped rather than reported, because a partial chain
   * through the placed subset is still a true chain — it just has gaps, and
   * `coverage` is how you find out how large they are.
   */
  resolve(loci: Iterable<Locus>): number[];
  /** The same, for the `[surah, ayah]` pairs that data/index/roots.json uses. */
  resolvePairs(pairs: Iterable<readonly [number, number]>): number[];
  /** `resolve`, then sorted into muṣḥaf order. */
  chain(loci: Iterable<Locus>): number[];
  coverage(loci: Iterable<Locus>): Coverage;
}

/**
 * Build the join. Node records are read once and never held: only the two
 * index maps survive, so the join costs ~1,000 entries regardless of how much
 * text the nodes carry.
 */
export function buildLocusJoin(nodes: readonly PlacedLocus[]): LocusJoin {
  const byLocus = new Map<LocusKey, number>();
  const byNode = new Map<number, Locus>();
  // Muṣḥaf order, for `chain`. Nodes arrive scored, not ordered.
  const order = new Map<number, number>();

  for (const n of nodes) {
    const k = locusKey(n.s, n.a);
    // First placement of an āyah wins. The ingest emits one node per āyah, and
    // a collision would mean a duplicate slipped through scoring, not a tie
    // that is ours to break here.
    if (!byLocus.has(k)) byLocus.set(k, n.i);
    byNode.set(n.i, { surah: n.s, ayah: n.a });
  }
  for (const [i, l] of byNode) order.set(i, l.surah * 1000 + l.ayah);

  const at = (surah: number, ayah: number) => byLocus.get(locusKey(surah, ayah));

  const resolve = (loci: Iterable<Locus>): number[] => {
    const seen = new Set<number>();
    const out: number[] = [];
    for (const l of loci) {
      const i = at(l.surah, l.ayah);
      if (i === undefined || seen.has(i)) continue;
      seen.add(i);
      out.push(i);
    }
    return out;
  };

  return {
    get size() {
      return byLocus.size;
    },
    at,
    has: (s, a) => byLocus.has(locusKey(s, a)),
    locusOf: (node) => byNode.get(node),
    resolve,
    resolvePairs: (pairs) => {
      const loci: Locus[] = [];
      for (const [surah, ayah] of pairs) loci.push({ surah, ayah });
      return resolve(loci);
    },
    chain: (loci) => resolve(loci).sort((x, y) => (order.get(x) ?? 0) - (order.get(y) ?? 0)),
    coverage: (loci) => {
      const seen = new Set<LocusKey>();
      let placed = 0;
      for (const l of loci) {
        const k = locusKey(l.surah, l.ayah);
        if (seen.has(k)) continue;
        seen.add(k);
        if (byLocus.has(k)) placed++;
      }
      return { distinct: seen.size, placed, ratio: seen.size ? placed / seen.size : 0 };
    },
  };
}
