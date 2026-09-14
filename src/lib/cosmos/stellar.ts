// ============================================================================
//  النُّجوم — a population generated from measured law.
//
//  No catalogue holds trillions of stars. Gaia DR3 — the largest ever built —
//  holds 1.81 billion; the Galaxy has of order 10^11. Depth cannot come from
//  downloading, so it comes the way astronomy itself gets it: measure a real
//  sample, fit the laws that govern the population, generate from the laws.
//
//  data/sky/astrophysics.json holds those laws, fitted by scripts/ingest-gaia.ts
//  from 900,000 real Gaia DR3 rows:
//
//    luminosityFunction   φ(M_G), volume-limited, peaking at M_G ≈ 11
//    colourDistribution   the real BP−RP histogram
//    mainSequence         median M_G per colour bin — the ridge
//    colourToTeff         binned median of teff_gspphot, 1.0% median error
//    disc                 n(z) ∝ exp(−|z|/h_z), h_z = 121 pc, r² = 0.977
//
//  Every star this module makes is drawn from those distributions and is
//  **generated, not observed**. The 5,044 stars in sky.json are the observed
//  ones. The renderer keeps them apart and so does this file: `observed` and
//  `generated` are different functions and nothing merges them silently.
// ============================================================================
import { blackbodyRGB, type RGB } from './chroma';

export interface Astrophysics {
  source: string;
  fittedAt: string;
  samples: Record<string, number>;
  cuts: string;
  mainSequence: { bin: number; ridge: { colour: number; absMag: number; n: number }[] };
  luminosityFunction: { absMag: number; n: number }[];
  colourDistribution: { colour: number; n: number }[];
  /** The colour distribution measured at each height above the plane. */
  colourByHeight: {
    note: string;
    bands: { id: string; maxZPc: number | null; n: number; meanColour: number; bins: { colour: number; n: number }[] }[];
  };
  colourToTeff: { table: { colour: number; teff: number; n: number }[]; medianRelativeError: number };
  disc: { scaleHeightPc: number; r2: number; fittedRangePc: number[] };
}

/** Interpolate the measured colour → temperature table. */
export function teffOf(law: Astrophysics, colour: number): number {
  const t = law.colourToTeff.table;
  if (!t.length) return 5000;
  if (colour <= t[0].colour) return t[0].teff;
  const last = t[t.length - 1];
  if (colour >= last.colour) return last.teff;
  for (let i = 1; i < t.length; i++) {
    if (t[i].colour >= colour) {
      const a = t[i - 1];
      const b = t[i];
      return a.teff + ((b.teff - a.teff) * (colour - a.colour)) / (b.colour - a.colour);
    }
  }
  return last.teff;
}

/** Absolute magnitude on the main-sequence ridge, for a given colour. */
export function absMagOf(law: Astrophysics, colour: number): number {
  const r = law.mainSequence.ridge;
  if (!r.length) return 5;
  if (colour <= r[0].colour) return r[0].absMag;
  const last = r[r.length - 1];
  if (colour >= last.colour) return last.absMag;
  for (let i = 1; i < r.length; i++) {
    if (r[i].colour >= colour) {
      const a = r[i - 1];
      const b = r[i];
      return a.absMag + ((b.absMag - a.absMag) * (colour - a.colour)) / (b.colour - a.colour);
    }
  }
  return last.absMag;
}

/** A deterministic generator: the same seed must give the same sky, always. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** Sample an index from a histogram, by its own weights. */
function sampleHist<T extends { n: number }>(bins: T[], u: number): T {
  const total = bins.reduce((s, b) => s + b.n, 0) || 1;
  let acc = 0;
  const x = u * total;
  for (const b of bins) {
    acc += b.n;
    if (x <= acc) return b;
  }
  return bins[bins.length - 1];
}

export interface GeneratedStar {
  /** Position in parsecs, galactic cartesian, Sun at the origin. */
  x: number;
  y: number;
  z: number;
  /** BP−RP, drawn from the measured colour distribution. */
  colour: number;
  /** Kelvin, from the measured colour → temperature table. */
  teff: number;
  /** Absolute G, from the measured main-sequence ridge. */
  absMag: number;
  /** Apparent G at this distance — the inverse-square law, done honestly. */
  appMag: number;
  /** Physically derived sRGB, Planck → CIE 1931 → sRGB. */
  rgb: RGB;
}

/**
 * The measured colour distribution for a given height above the plane. A zone
 * high above the disc is not the same population seen from further away — it is
 * an older, and observationally a bluer, one, and the bands measure that.
 */
export function colourBandFor(law: Astrophysics, typicalZPc: number) {
  const bands = law.colourByHeight?.bands?.filter((b) => b.n > 1000) ?? [];
  if (!bands.length) return { bins: law.colourDistribution, id: 'all', meanColour: NaN };
  for (const b of bands) if (b.maxZPc === null || typicalZPc <= b.maxZPc) return b;
  return bands[bands.length - 1];
}

export interface ZoneShape {
  /** Radial extent sampled, in parsecs. */
  radiusPc: number;
  /**
   * Multiplier on the fitted scale height. 1 is the thin disc as measured;
   * larger values sample the thick disc and halo, where the fitted law is an
   * extrapolation beyond its 50–600 pc fitting range and is labelled so.
   */
  scaleHeightFactor: number;
}

/**
 * Generate a population. Positions follow the fitted exponential disc in z and
 * are uniform in the plane; colours follow the measured BP−RP histogram;
 * temperature, absolute magnitude and colour all follow from the fits.
 *
 * This is a *model of* the Galaxy built from a measurement of it. It is not a
 * catalogue and must never be presented as one.
 */
export function generatePopulation(
  law: Astrophysics,
  count: number,
  shape: ZoneShape,
  seed: number,
): GeneratedStar[] {
  const rand = rng(seed);
  const hz = law.disc.scaleHeightPc * shape.scaleHeightFactor;
  // Colours come from the stratum this zone actually occupies, not from one
  // distribution reused everywhere — which made all six zones identical.
  const band = colourBandFor(law, hz);
  const out: GeneratedStar[] = [];

  for (let i = 0; i < count; i++) {
    // Inverse transform of the exponential: |z| = −h·ln(1−u), sign by coin.
    const z = -hz * Math.log(1 - rand() * 0.999) * (rand() < 0.5 ? -1 : 1);
    // Uniform in the disc plane: √u keeps the areal density flat.
    const r = shape.radiusPc * Math.sqrt(rand());
    const th = rand() * Math.PI * 2;
    const x = r * Math.cos(th);
    const y = r * Math.sin(th);

    const colour = sampleHist(band.bins, rand()).colour + (rand() - 0.5) * 0.2;
    const teff = teffOf(law, colour);
    const absMag = absMagOf(law, colour);
    const d = Math.max(1, Math.hypot(x, y, z));
    // m = M + 5·log10(d/10 pc). The distance modulus, nothing more.
    const appMag = absMag + 5 * Math.log10(d / 10);

    out.push({ x, y, z, colour, teff, absMag, appMag, rgb: blackbodyRGB(teff) });
  }
  return out;
}

/** Integrated flux of a set of magnitudes: F ∝ Σ 10^(−0.4·m). Real photometry. */
export function integratedFlux(mags: number[]): number {
  let f = 0;
  for (const m of mags) f += Math.pow(10, -0.4 * m);
  return f;
}

/** The inverse: a flux back to a magnitude. */
export const fluxToMag = (f: number) => (f > 0 ? -2.5 * Math.log10(f) : 99);
