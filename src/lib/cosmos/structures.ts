// ============================================================================
//  البُنى — what is actually there, once a basis makes structure local.
//
//  The question this answers is narrow and is meant to be: which groupings in
//  the field are formidable enough to deserve more than a line? A plane, a
//  chamber, a surface you can enter is a strong claim, and it should be earned
//  by measurement rather than granted because a canvas has empty space in it.
//
//  A grouping is taken seriously here on two counts, both computed:
//
//    support    how many *independent* families of relation agree on it. One
//               detector kind saying so is a finding; contours, roots and
//               detectors all saying so is a structure.
//    shape      what the points actually form. PCA on the member positions
//               gives linearity, planarity and sphericity, so a filament is
//               told apart from a sheet from a ball by the geometry itself.
//
//  Nothing here decides what a structure *means*, and nothing here draws
//  anything. It reports.
// ============================================================================
import type { Strand, StrandKind } from './strands';
import type { Vec3 } from './placement';
import type { CosmosNode } from './types';

export interface Shape {
  /** (λ1−λ2)/λ1 — near 1 is a filament. */
  linearity: number;
  /** (λ2−λ3)/λ1 — near 1 is a sheet. */
  planarity: number;
  /** λ3/λ1 — near 1 is a ball. */
  sphericity: number;
  /** Largest pairwise spread, in field units. */
  extent: number;
  centroid: Vec3;
  /** The plane's own normal, when the shape is planar enough to have one. */
  normal: Vec3;
}

export interface Structure {
  id: string;
  origin: 'motif' | 'root' | 'community';
  label: string;
  nodes: number[];
  families: StrandKind[];
  internalStrands: number;
  /** Distinct families agreeing on this grouping. */
  support: number;
  shape: Shape;
  /**
   * size × support × coherence. Deliberately crude and deliberately visible:
   * it exists to rank candidates for inspection, not to certify anything.
   */
  score: number;
}

// ── shape ───────────────────────────────────────────────────────────────────
/** PCA over member positions. Three points or fewer have no shape to speak of. */
export function shapeOf(members: readonly number[], p: readonly Vec3[]): Shape {
  const n = members.length;
  const centroid: Vec3 = [0, 0, 0];
  for (const i of members) {
    centroid[0] += p[i][0] / n;
    centroid[1] += p[i][1] / n;
    centroid[2] += p[i][2] / n;
  }
  const cov = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let extent = 0;
  for (const i of members) {
    const d = [p[i][0] - centroid[0], p[i][1] - centroid[1], p[i][2] - centroid[2]];
    extent = Math.max(extent, Math.hypot(d[0], d[1], d[2]) * 2);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) cov[a * 3 + b] += (d[a] * d[b]) / n;
  }
  const { values, vectors } = symmetricEigen(cov);
  const [l1, l2, l3] = values;
  const denom = l1 || 1;
  return {
    linearity: (l1 - l2) / denom,
    planarity: (l2 - l3) / denom,
    sphericity: l3 / denom,
    extent,
    centroid,
    normal: vectors[2],
  };
}

/**
 * Eigenvalues and eigenvectors of a symmetric 3×3, descending. Jacobi rotation:
 * a handful of sweeps converges on a matrix this small, and it avoids pulling
 * in a linear-algebra dependency for nine numbers.
 */
function symmetricEigen(m: number[]): { values: [number, number, number]; vectors: Vec3[] } {
  const a = [...m];
  let v = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  for (let sweep = 0; sweep < 24; sweep++) {
    let off = 0;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) off += a[i * 3 + j] ** 2;
    if (off < 1e-18) break;
    for (let p = 0; p < 3; p++) {
      for (let q = p + 1; q < 3; q++) {
        if (Math.abs(a[p * 3 + q]) < 1e-18) continue;
        const theta = (a[q * 3 + q] - a[p * 3 + p]) / (2 * a[p * 3 + q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        const rot = (x: number[]) => {
          for (let k = 0; k < 3; k++) {
            const xkp = x[k * 3 + p];
            const xkq = x[k * 3 + q];
            x[k * 3 + p] = c * xkp - s * xkq;
            x[k * 3 + q] = s * xkp + c * xkq;
          }
        };
        rot(a);
        // Symmetric update: rotate rows to match the columns just rotated.
        for (let k = 0; k < 3; k++) {
          const apk = a[p * 3 + k];
          const aqk = a[q * 3 + k];
          a[p * 3 + k] = c * apk - s * aqk;
          a[q * 3 + k] = s * apk + c * aqk;
        }
        rot(v);
      }
    }
  }
  const order = [0, 1, 2].sort((x, y) => a[y * 3 + y] - a[x * 3 + x]);
  return {
    values: order.map((i) => Math.max(0, a[i * 3 + i])) as [number, number, number],
    vectors: order.map((i) => [v[i], v[3 + i], v[6 + i]] as Vec3),
  };
}

// ── communities ─────────────────────────────────────────────────────────────
/**
 * Label propagation over the weighted strand graph: each node repeatedly takes
 * the label with the greatest incident weight. Cheap, and it makes no
 * assumption about how many communities there are — which matters, because
 * nobody knows how many there should be.
 *
 * Ties break on the lower label and the sweep order is fixed, so the result is
 * the same on every run.
 */
export function communities(
  nodeCount: number,
  strands: readonly Strand[],
  rounds = 24,
): Map<number, number[]> {
  const adj = new Map<number, { to: number; w: number }[]>();
  const link = (a: number, b: number, w: number) => {
    const list = adj.get(a);
    if (list) list.push({ to: b, w });
    else adj.set(a, [{ to: b, w }]);
  };
  for (const s of strands) {
    link(s.a, s.b, s.weight);
    link(s.b, s.a, s.weight);
  }

  const label = new Int32Array(nodeCount);
  for (let i = 0; i < nodeCount; i++) label[i] = i;

  for (let r = 0; r < rounds; r++) {
    let moved = 0;
    for (let i = 0; i < nodeCount; i++) {
      const near = adj.get(i);
      if (!near) continue;
      const tally = new Map<number, number>();
      for (const { to, w } of near) tally.set(label[to], (tally.get(label[to]) ?? 0) + w);
      let best = label[i];
      let bestW = tally.get(best) ?? 0;
      for (const [l, w] of tally) {
        if (w > bestW || (w === bestW && l < best)) {
          best = l;
          bestW = w;
        }
      }
      if (best !== label[i]) {
        label[i] = best;
        moved++;
      }
    }
    if (!moved) break;
  }

  const out = new Map<number, number[]>();
  for (let i = 0; i < nodeCount; i++) {
    const list = out.get(label[i]);
    if (list) list.push(i);
    else out.set(label[i], [i]);
  }
  return out;
}

// ── the search ──────────────────────────────────────────────────────────────
export interface StructureOptions {
  /** Below this a grouping is too small to be anything. */
  minSize: number;
  /** Families that must agree before a grouping is reported at all. */
  minSupport: number;
}

export const DEFAULT_STRUCTURES: StructureOptions = { minSize: 5, minSupport: 2 };

export function findStructures(
  nodes: readonly CosmosNode[],
  strands: readonly Strand[],
  positions: readonly Vec3[],
  opt: StructureOptions = DEFAULT_STRUCTURES,
): Structure[] {
  const groups: { id: string; origin: Structure['origin']; label: string; nodes: number[] }[] = [];

  // A contour's own placed occurrences, and a rare root's.
  const byMotif = new Map<string, Set<number>>();
  const byRoot = new Map<string, Set<number>>();
  for (const s of strands) {
    if (s.evidence.kind === 'motif') {
      const set = byMotif.get(s.evidence.pattern) ?? new Set<number>();
      set.add(s.a).add(s.b);
      byMotif.set(s.evidence.pattern, set);
    } else if (s.evidence.kind === 'root') {
      const set = byRoot.get(s.evidence.root) ?? new Set<number>();
      set.add(s.a).add(s.b);
      byRoot.set(s.evidence.root, set);
    }
  }
  for (const [pattern, set] of byMotif) {
    groups.push({ id: `mo:${pattern}`, origin: 'motif', label: `مثاني ${pattern}`, nodes: [...set] });
  }
  for (const [root, set] of byRoot) {
    groups.push({ id: `rt:${root}`, origin: 'root', label: `جذر «${root}»`, nodes: [...set] });
  }
  // Not `strands`: السنابل give every node seven neighbours and weld the whole
  // field into one component — 996 of 1,000 in a single label, which is not a
  // community but the absence of one. They are excluded here for the same
  // reason they are excluded from support below: derived from isnād and time
  // similarity, they agree with everything and can only erase structure.
  const independent = strands.filter((s) => s.kind !== 'sunbula');
  for (const [seed, members] of communities(nodes.length, independent)) {
    groups.push({ id: `cm:${seed}`, origin: 'community', label: `تجمّع ${members.length}`, nodes: members });
  }

  const member = new Map<string, Set<number>>(groups.map((g) => [g.id, new Set(g.nodes)]));
  const out: Structure[] = [];

  for (const g of groups) {
    if (g.nodes.length < opt.minSize) continue;
    const inside = member.get(g.id)!;
    const families = new Set<StrandKind>();
    let internal = 0;
    for (const s of strands) {
      if (!inside.has(s.a) || !inside.has(s.b)) continue;
      families.add(s.kind);
      internal++;
    }
    // السنابل are not independent evidence: they were derived from isnād and
    // time similarity in the ingest, so they agree with everything by design.
    const support = [...families].filter((f) => f !== 'sunbula').length;
    if (support < opt.minSupport) continue;

    const shape = shapeOf(g.nodes, positions);
    const coherence = Math.max(shape.linearity, shape.planarity);
    out.push({
      ...g,
      families: [...families],
      internalStrands: internal,
      support,
      shape,
      score: Math.log2(g.nodes.length) * support * coherence,
    });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

/** What a shape is, in one word, for a report. */
export function shapeName(s: Shape): 'خيط' | 'صفيحة' | 'كتلة' {
  if (s.linearity >= 0.6) return 'خيط';
  if (s.planarity >= 0.45) return 'صفيحة';
  return 'كتلة';
}
