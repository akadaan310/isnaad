// ============================================================================
//  الأساس — candidate spatial bases, and the measurement that judges them.
//
//  Radius already means something: it is discourse distance, so flying inward
//  is moving toward المخاطب. Direction does not. It is the برج realm's real
//  RA/Dec plus a deterministic scatter, which is a *label* dressed as a cause —
//  and drawing the strand layer showed what that costs. Related āyāt land as
//  far apart as unrelated ones, so no relation is ever short and no cluster
//  can form.
//
//  This module does not replace anything. It builds candidate directions from
//  quantities the engine actually computed, and measures all of them against
//  the placement in use, on one question: does a basis put structurally
//  related āyāt near each other?
//
//  The constellation stays either way. It is a celestial reference and a name
//  for a region of sky — what it must stop being is the hidden cause of a
//  position that the reader is invited to read as meaningful.
// ============================================================================
import type { CosmosNode } from './types';
import type { Strand, StrandKind } from './strands';
import { radiusOf, type Vec3 } from './placement';

export type BasisId = 'constellation' | 'isnad' | 'contour' | 'spectral';

export interface Basis {
  id: BasisId;
  label: string;
  /** What the two angular degrees of freedom are made of. */
  note: string;
  /** Unit vectors, one per node, index-aligned. */
  directions: Vec3[];
}

const TAU = Math.PI * 2;

const unit = (x: number, y: number, z: number): Vec3 => {
  const r = Math.hypot(x, y, z) || 1;
  return [x / r, y / r, z / r];
};

/** Longitude and latitude → a unit vector, in the scene's own convention. */
function fromAngles(azimuth: number, latitude: number): Vec3 {
  const c = Math.cos(latitude);
  return [c * Math.cos(azimuth), Math.sin(latitude), c * Math.sin(azimuth)];
}

// ── the placement in use, recovered from the positions themselves ───────────
export function constellationBasis(nodes: readonly CosmosNode[]): Basis {
  return {
    id: 'constellation',
    label: 'البروج',
    note: 'الاتجاه من مركز البرج الحقيقي، مع تشتيتٍ ثابت — لا يُشتقّ من حسابٍ',
    directions: nodes.map((n) => unit(n.p[0], n.p[1], n.p[2])),
  };
}

// ── the isnād mix ───────────────────────────────────────────────────────────
/**
 * Longitude from the shape of the attribution itself. `d` is the mean of the
 * mix and is already the radius; the *mix* is not recoverable from that mean,
 * so the simplex still carries information the radius has thrown away. The
 * three persons are placed 120° apart and the vector is their weighted sum.
 */
export function isnadBasis(nodes: readonly CosmosNode[]): Basis {
  const AXES: Vec3[] = [0, 1, 2].map((k) => {
    const a = (k / 3) * TAU + Math.PI / 6;
    return [Math.cos(a), 0, Math.sin(a)];
  });
  return {
    id: 'isnad',
    label: 'متجه الإسناد',
    note: 'الطول من مزيج المتكلم والمخاطب والغائب، والعرض من محور الزمن',
    directions: nodes.map((n) => {
      const m = n.v[0] + n.v[1] + n.v[2] || 1;
      let x = 0;
      let z = 0;
      for (let k = 0; k < 3; k++) {
        x += (n.v[k] / m) * AXES[k][0];
        z += (n.v[k] / m) * AXES[k][2];
      }
      const azimuth = Math.atan2(z, x);
      return fromAngles(azimuth, Math.asin(Math.max(-1, Math.min(1, n.ax))) * 0.62);
    }),
  };
}

// ── the contour ─────────────────────────────────────────────────────────────
/**
 * Longitude from the isnād signature read as a base-three fraction, so that
 * equal contours point the same way and contours sharing a prefix point
 * nearby. This is the one basis under which المثاني is spatially true by
 * construction rather than by coincidence.
 */
export function contourBasis(nodes: readonly CosmosNode[]): Basis {
  const fraction = (sig: string): number => {
    let f = 0;
    let scale = 1 / 3;
    for (const ch of sig.slice(0, 14)) {
      const d = ch.charCodeAt(0) - 49; // '1' → 0
      if (d < 0 || d > 2) continue;
      f += d * scale;
      scale /= 3;
    }
    return f;
  };
  return {
    id: 'contour',
    label: 'الكنتور',
    note: 'الطول من كنتور الإسناد كسرًا ثلاثيًا، والعرض من محور الزمن',
    directions: nodes.map((n) =>
      fromAngles(
        fraction(n.sig) * TAU,
        Math.asin(Math.max(-1, Math.min(1, n.ax))) * 0.62,
      ),
    ),
  };
}

// ── the relation graph itself ───────────────────────────────────────────────
/**
 * A spectral embedding of the strand graph: the three leading non-trivial
 * eigenvectors of the normalised adjacency, taken as a direction. Under this
 * basis an āyah points where its relationships point, and nothing else is
 * consulted — which is the strongest reading of "geometry as the visible
 * consequence of computation" available without inventing a new quantity.
 *
 * Each component is rank-normalised before being used. Spectral embeddings
 * concentrate mass near zero with a few extreme outliers; ranking is monotone,
 * so it keeps the ordering the eigenvector found while spreading the sphere
 * evenly enough to look at.
 */
export function spectralBasis(
  nodes: readonly CosmosNode[],
  strands: readonly Strand[],
  opt: { iterations?: number; weights?: Partial<Record<StrandKind, number>> } = {},
): Basis {
  const n = nodes.length;
  const iterations = opt.iterations ?? 160;
  const W = new Float64Array(n * n);

  for (const s of strands) {
    const w = (opt.weights?.[s.kind] ?? 1) * s.weight;
    if (!w || s.a === s.b) continue;
    W[s.a * n + s.b] += w;
    W[s.b * n + s.a] += w;
  }

  // Normalised adjacency M = D^-1/2 W D^-1/2, whose leading eigenvector is the
  // trivial D^1/2·1. Everything below it is the structure.
  const deg = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let j = 0; j < n; j++) d += W[i * n + j];
    deg[i] = d;
  }
  const inv = new Float64Array(n);
  for (let i = 0; i < n; i++) inv[i] = deg[i] > 0 ? 1 / Math.sqrt(deg[i]) : 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) W[i * n + j] *= inv[i] * inv[j];

  const trivial = new Float64Array(n);
  for (let i = 0; i < n; i++) trivial[i] = Math.sqrt(deg[i]);
  normalise(trivial);

  const found: Float64Array[] = [trivial];
  const vectors: Float64Array[] = [];
  // A fixed seed: the basis must be reproducible across runs and machines.
  let seed = 0x2f6f2b79;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff - 0.5;
  };

  for (let k = 0; k < 3; k++) {
    let v = new Float64Array(n);
    for (let i = 0; i < n; i++) v[i] = rand();
    deflate(v, found);
    normalise(v);
    for (let it = 0; it < iterations; it++) {
      const next = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        let acc = 0;
        const row = i * n;
        for (let j = 0; j < n; j++) acc += W[row + j] * v[j];
        next[i] = acc;
      }
      deflate(next, found);
      if (!normalise(next)) break;
      v = next;
    }
    found.push(v);
    vectors.push(v);
  }

  const ranked = vectors.map(rankNormalise);
  return {
    id: 'spectral',
    label: 'طيف الخيوط',
    note: 'الاتجاه من موضع الآية في شبكة الخيوط نفسها — ثلاثة متجهات ذاتية',
    directions: nodes.map((_, i) => unit(ranked[0][i], ranked[1][i], ranked[2][i])),
  };
}

function normalise(v: Float64Array): boolean {
  let m = 0;
  for (const x of v) m += x * x;
  m = Math.sqrt(m);
  if (m < 1e-12) return false;
  for (let i = 0; i < v.length; i++) v[i] /= m;
  return true;
}

function deflate(v: Float64Array, against: readonly Float64Array[]): void {
  for (const u of against) {
    let dot = 0;
    for (let i = 0; i < v.length; i++) dot += v[i] * u[i];
    for (let i = 0; i < v.length; i++) v[i] -= dot * u[i];
  }
}

/** Monotone rescale to an even spread over [-1, 1]. */
function rankNormalise(v: Float64Array): Float64Array {
  const order = Array.from(v.keys()).sort((a, b) => v[a] - v[b]);
  const out = new Float64Array(v.length);
  order.forEach((idx, rank) => {
    out[idx] = v.length > 1 ? (rank / (v.length - 1)) * 2 - 1 : 0;
  });
  return out;
}

// ── positions, and how a basis is judged ────────────────────────────────────

/** Direction from the basis, radius from discourse distance. Unchanged. */
export function positionsFor(nodes: readonly CosmosNode[], basis: Basis): Vec3[] {
  return nodes.map((n, i) => {
    const r = radiusOf(n.d);
    const d = basis.directions[i];
    return [d[0] * r, d[1] * r, d[2] * r];
  });
}

export interface BasisReport {
  id: BasisId;
  label: string;
  note: string;
  /** Median distance between the ends of a strand, per family and overall. */
  medianByKind: Partial<Record<StrandKind, number>>;
  medianRelated: number;
  /** Median distance between two nodes picked at random. */
  medianRandom: number;
  /**
   * medianRelated / medianRandom. At 1 the basis is blind to structure: a
   * relation is no shorter than a coincidence. Below 1 the basis has made
   * structure local, which is what "spatial" has to mean.
   */
  locality: number;
  /** Nodes where three or more families converge inside the local radius. */
  convergences: number;
}

export function measureBasis(
  nodes: readonly CosmosNode[],
  strands: readonly Strand[],
  basis: Basis,
): BasisReport {
  const p = positionsFor(nodes, basis);
  const dist = (a: number, b: number) =>
    Math.hypot(p[a][0] - p[b][0], p[a][1] - p[b][1], p[a][2] - p[b][2]);

  const byKind = new Map<StrandKind, number[]>();
  const allLengths: number[] = [];
  for (const s of strands) {
    const d = dist(s.a, s.b);
    allLengths.push(d);
    const list = byKind.get(s.kind);
    if (list) list.push(d);
    else byKind.set(s.kind, [d]);
  }

  // A deterministic sample of unrelated pairs, as the null the basis is held
  // against. Without it a small field would flatter every basis equally.
  const random: number[] = [];
  let seed = 12345;
  for (let k = 0; k < 20000; k++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const a = seed % nodes.length;
    seed = (seed * 1103515245 + 12345) >>> 0;
    const b = seed % nodes.length;
    if (a !== b) random.push(dist(a, b));
  }

  const medianRelated = median(allLengths);
  const medianRandom = median(random);
  const local = medianRandom * 0.18;

  // Convergence: distinct families reaching a node from inside the local
  // radius. Where several different computations agree about a neighbourhood,
  // there is a structure worth being able to enter.
  const families = new Map<number, Set<StrandKind>>();
  for (const s of strands) {
    if (dist(s.a, s.b) > local) continue;
    for (const end of [s.a, s.b]) {
      const set = families.get(end) ?? new Set<StrandKind>();
      set.add(s.kind);
      families.set(end, set);
    }
  }

  const medianByKind: Partial<Record<StrandKind, number>> = {};
  for (const [k, xs] of byKind) medianByKind[k] = median(xs);

  return {
    id: basis.id,
    label: basis.label,
    note: basis.note,
    medianByKind,
    medianRelated,
    medianRandom,
    locality: medianRandom ? medianRelated / medianRandom : 1,
    convergences: [...families.values()].filter((s) => s.size >= 3).length,
  };
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
