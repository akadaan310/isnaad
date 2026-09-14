// ============================================================================
//  التكوين — bodies that form, rather than shapes that are drawn.
//
//  The previous attempt drew star polygons: flat, closed-form, and the same
//  figure every time with a different tooth count. This is not that. Each body
//  here is a parametric *surface* in three dimensions, evaluated from two real
//  families of mathematics, and no two parameter sets give the same solid.
//
//    the superformula (Gielis 2003)
//        r(φ) = [ |cos(mφ/4)/a|^n₂ + |sin(mφ/4)/b|^n₃ ]^(−1/n₁)
//      One equation whose parameters carry it continuously between circles,
//      polygons, stars and lobed forms. Taken as a spherical product of two
//      such curves it sweeps a closed surface.
//
//    the harmonic sum (the spherical-harmonic parametrisation)
//        r(θ,φ) = Σ sinᵃ(mφ) + cosᵇ(nφ) + sinᶜ(pθ) + cosᵈ(qθ)
//      Eight integer exponents, and the lobes emerge from their interference
//      rather than from any instruction to make lobes.
//
//  Both are continuous in their parameters, so the immersion index does not
//  pick from a list of shapes — it lands somewhere in a space of them.
// ============================================================================

export type Family = 'superformula' | 'harmonic';

export interface Morphology {
  family: Family;
  /** Superformula: [m, n1, n2, n3] for each of the two angular curves. */
  sf: [number, number, number, number, number, number, number, number];
  /** Harmonic: eight exponents/frequencies. */
  h: [number, number, number, number, number, number, number, number];
  /** Surface resolution, latitude × longitude. */
  res: number;
}

/** Deterministic, and continuous in the index rather than a lookup. */
export function morphologyFor(seed: number, tier: 'low' | 'mid' | 'high'): Morphology {
  let s = (seed >>> 0) || 1;
  const rand = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  const family: Family = rand() < 0.5 ? 'superformula' : 'harmonic';
  const res = tier === 'low' ? 36 : tier === 'mid' ? 52 : 68;

  // n₁ near or above 1 gives a rounded solid; below 1 the surface pinches into
  // cusps and lobes. Sampling n₁ uniformly over a wide range made most bodies
  // near-spheres once normalised, so it is biased low — the interesting part of
  // the family — while n₂ and n₃ stay broad, which is what varies the profile.
  const n1 = () => 0.14 + Math.pow(rand(), 1.7) * 0.86;
  const n = () => 0.35 + rand() * 2.6;
  const m = () => Math.floor(3 + rand() * 13);

  return {
    family,
    sf: [m(), n1(), n(), n(), m(), n1(), n(), n()],
    h: Array.from({ length: 8 }, () => Math.floor(rand() * 7)) as Morphology['h'],
    res,
  };
}

const superRadius = (angle: number, m: number, n1: number, n2: number, n3: number) => {
  const t = (m * angle) / 4;
  const a = Math.pow(Math.abs(Math.cos(t)), n2);
  const b = Math.pow(Math.abs(Math.sin(t)), n3);
  const r = Math.pow(a + b, -1 / n1);
  return Number.isFinite(r) ? Math.min(r, 4) : 0;
};

/**
 * Evaluate the surface at (θ, φ) with θ ∈ [−π, π] and φ ∈ [−π/2, π/2],
 * writing a unit-ish position. The caller scales.
 */
export function evaluate(mo: Morphology, theta: number, phi: number): [number, number, number] {
  if (mo.family === 'superformula') {
    const [m1, a1, b1, c1, m2, a2, b2, c2] = mo.sf;
    const r1 = superRadius(theta, m1, a1, b1, c1);
    const r2 = superRadius(phi, m2, a2, b2, c2);
    return [
      r1 * Math.cos(theta) * r2 * Math.cos(phi),
      r1 * Math.sin(theta) * r2 * Math.cos(phi),
      r2 * Math.sin(phi),
    ];
  }
  const [a, b, c, d, e, f, g, hh] = mo.h;
  // φ here runs the full polar range, which is what makes the lobes close.
  const p = phi + Math.PI / 2;
  const r =
    Math.pow(Math.sin(a * theta), b) +
    Math.pow(Math.cos(c * theta), d) +
    Math.pow(Math.sin(e * p), f) +
    Math.pow(Math.cos(g * p), hh);
  const rr = Number.isFinite(r) ? r : 0;
  return [
    rr * Math.sin(p) * Math.cos(theta),
    rr * Math.cos(p),
    rr * Math.sin(p) * Math.sin(theta),
  ];
}

export interface SurfaceMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array | Uint32Array;
  /** The parametric grid as line pairs — the surface's own construction lines. */
  wire: Uint16Array | Uint32Array;
  /** Longest radius found, so the caller can normalise the body's size. */
  extent: number;
}

/**
 * Tessellate the surface. Normals come from the surface itself — cross
 * products of the parametric tangents, taken by finite difference, so a body
 * with cusps lights like a body with cusps.
 */
export function buildSurface(mo: Morphology): SurfaceMesh {
  const N = mo.res;
  const M = mo.res;
  const positions = new Float32Array(N * M * 3);
  const normals = new Float32Array(N * M * 3);
  let extent = 0;

  const at = (i: number, j: number): [number, number, number] => {
    const theta = -Math.PI + (i / (N - 1)) * Math.PI * 2;
    const phi = -Math.PI / 2 + (j / (M - 1)) * Math.PI;
    return evaluate(mo, theta, phi);
  };

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const p = at(i, j);
      const k = (i * M + j) * 3;
      positions[k] = p[0];
      positions[k + 1] = p[1];
      positions[k + 2] = p[2];
      extent = Math.max(extent, Math.hypot(p[0], p[1], p[2]));

      const du = at((i + 1) % N, j);
      const dv = at(i, Math.min(M - 1, j + 1));
      const ax = du[0] - p[0];
      const ay = du[1] - p[1];
      const az = du[2] - p[2];
      const bx = dv[0] - p[0];
      const by = dv[1] - p[1];
      const bz = dv[2] - p[2];
      let nx = ay * bz - az * by;
      let ny = az * bx - ax * bz;
      let nz = ax * by - ay * bx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l;
      ny /= l;
      nz /= l;
      normals[k] = nx;
      normals[k + 1] = ny;
      normals[k + 2] = nz;
    }
  }

  const quads = (N - 1) * (M - 1);
  const Index = N * M > 65535 ? Uint32Array : Uint16Array;
  const indices = new Index(quads * 6);
  let o = 0;
  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < M - 1; j++) {
      const a = i * M + j;
      const b = (i + 1) * M + j;
      const c = (i + 1) * M + j + 1;
      const d = i * M + j + 1;
      indices[o++] = a;
      indices[o++] = b;
      indices[o++] = c;
      indices[o++] = a;
      indices[o++] = c;
      indices[o++] = d;
    }
  }

  // The grid itself, every other line, as segments. A solid drawn additively
  // sums its front and back faces into a blob; its construction grid keeps the
  // form legible and is what makes the body read as *built*.
  const wireList: number[] = [];
  for (let i = 0; i < N; i += 2) {
    for (let j = 0; j < M - 1; j++) {
      wireList.push(i * M + j, i * M + j + 1);
    }
  }
  for (let j = 0; j < M; j += 2) {
    for (let i = 0; i < N - 1; i++) {
      wireList.push(i * M + j, (i + 1) * M + j);
    }
  }
  const WireIndex = N * M > 65535 ? Uint32Array : Uint16Array;
  const wire = new WireIndex(wireList);

  return { positions, normals, indices, wire, extent: extent || 1 };
}
