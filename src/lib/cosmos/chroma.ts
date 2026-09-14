// ============================================================================
//  اللون — colour derived, not chosen.
//
//  Two systems meet here, and they do different jobs.
//
//  1. PHYSICS. A star's colour is not a preference. Its effective temperature
//     gives a Planck spectrum; the spectrum integrated against the CIE 1931
//     colour-matching functions gives a tristimulus value; that value in sRGB
//     is what the eye would see. Every star's colour in this universe comes
//     out of that chain, from a temperature measured by Gaia.
//
//  2. PERCEPTION. sRGB is not perceptually uniform — equal steps in it are not
//     equal steps to the eye, and its hue lines bend (blue shifts purple as it
//     lightens). OKLab is uniform, so every derived palette is built there and
//     converted out at the last moment.
//
//  The colour-matching functions are the Wyman–Sloan–Shirley multi-lobe
//  Gaussian fit, which is analytic and needs no table.
// ============================================================================

export type RGB = [number, number, number];

// ── Planck ──────────────────────────────────────────────────────────────────
const H = 6.62607015e-34; // J·s
const C = 2.99792458e8; // m/s
const KB = 1.380649e-23; // J/K

/** Spectral radiance at wavelength λ (nm) for a blackbody at T (K). */
export function planck(lambdaNm: number, T: number): number {
  const l = lambdaNm * 1e-9;
  const a = (2 * H * C * C) / Math.pow(l, 5);
  const b = Math.exp((H * C) / (l * KB * T)) - 1;
  return b > 0 ? a / b : 0;
}

// ── CIE 1931 colour-matching functions ──────────────────────────────────────
/** Piecewise Gaussian: the lobe is asymmetric about its peak. */
function lobe(x: number, mu: number, s1: number, s2: number): number {
  const t = (x - mu) * (x < mu ? 1 / s1 : 1 / s2);
  return Math.exp(-0.5 * t * t);
}

export function cieX(l: number): number {
  return 1.056 * lobe(l, 599.8, 37.9, 31.0) + 0.362 * lobe(l, 442.0, 16.0, 26.7)
    - 0.065 * lobe(l, 501.1, 20.4, 26.2);
}
export function cieY(l: number): number {
  return 0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1);
}
export function cieZ(l: number): number {
  return 1.217 * lobe(l, 437.0, 11.8, 36.0) + 0.681 * lobe(l, 459.0, 26.0, 13.8);
}

/**
 * Effective temperature → the colour the eye sees, normalised to equal
 * luminance so that a hot star and a cool one differ in hue rather than in
 * brightness. Brightness is the renderer's business; this is chromaticity.
 */
export function blackbodyRGB(T: number): RGB {
  let X = 0;
  let Y = 0;
  let Z = 0;
  for (let l = 380; l <= 780; l += 5) {
    const s = planck(l, T);
    X += s * cieX(l);
    Y += s * cieY(l);
    Z += s * cieZ(l);
  }
  const sum = Y || 1;
  return xyzToSrgb(X / sum, Y / sum, Z / sum);
}

/** CIE XYZ (D65) → gamma-encoded sRGB, clipped into gamut. */
export function xyzToSrgb(X: number, Y: number, Z: number): RGB {
  let r = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
  let g = -0.969266 * X + 1.8760108 * Y + 0.041556 * Z;
  let b = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
  // Desaturate toward the white point rather than clipping channels, which
  // would shift the hue of anything out of gamut.
  const min = Math.min(r, g, b);
  if (min < 0) {
    r -= min;
    g -= min;
    b -= min;
  }
  const max = Math.max(r, g, b, 1e-6);
  if (max > 1) {
    r /= max;
    g /= max;
    b /= max;
  }
  return [gamma(r), gamma(g), gamma(b)];
}

const gamma = (u: number) =>
  u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(Math.max(0, u), 1 / 2.4) - 0.055;
const degamma = (u: number) =>
  u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);

// ── OKLab / OKLCH (Ottosson) ────────────────────────────────────────────────
export interface OKLCH {
  /** Perceived lightness, 0…1. */
  L: number;
  /** Chroma. Unbounded in principle; ~0.37 is the sRGB maximum. */
  C: number;
  /** Hue angle, degrees. */
  H: number;
}

export function srgbToOklab(rgb: RGB): [number, number, number] {
  const r = degamma(rgb[0]);
  const g = degamma(rgb[1]);
  const b = degamma(rgb[2]);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToSrgb(L: number, a: number, bb: number): RGB {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * bb, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * bb, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * bb, 3);
  return [
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export function oklch(L: number, C: number, H: number): OKLCH {
  return { L, C, H };
}

const inGamut = (c: RGB) => c.every((v) => v >= -0.001 && v <= 1.001);

/**
 * OKLCH → sRGB, reducing chroma until the colour fits. Lightness and hue are
 * held: those carry the meaning, and chroma is the one axis that can be
 * surrendered without changing what a colour *says*.
 */
export function oklchToRgb({ L, C, H }: OKLCH): RGB {
  const rad = (H * Math.PI) / 180;
  const raw = oklabToSrgb(L, C * Math.cos(rad), C * Math.sin(rad));
  if (inGamut(raw)) return raw.map((v) => Math.min(1, Math.max(0, v))) as RGB;
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const c = oklabToSrgb(L, mid * Math.cos(rad), mid * Math.sin(rad));
    if (inGamut(c)) lo = mid;
    else hi = mid;
  }
  return oklabToSrgb(L, lo * Math.cos(rad), lo * Math.sin(rad)).map((v) =>
    Math.min(1, Math.max(0, v)),
  ) as RGB;
}

export const hex = (c: RGB) =>
  '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');

export function rgbToOklch(c: RGB): OKLCH {
  const [L, a, b] = srgbToOklab(c);
  return { L, C: Math.hypot(a, b), H: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

// ── generative harmony ──────────────────────────────────────────────────────
/**
 * The golden angle. Stepping hue by 137.5077…° is the arrangement that keeps
 * successive terms maximally separated for every prefix of the sequence — the
 * same reason a sunflower uses it — so an unbounded run of palettes never
 * repeats a near-collision early.
 */
export const GOLDEN_ANGLE = 180 * (3 - Math.sqrt(5));

export function goldenHue(index: number, offset = 0): number {
  return (offset + index * GOLDEN_ANGLE) % 360;
}

export type HarmonyKind = 'analogous' | 'triadic' | 'split' | 'tetradic' | 'monochrome';

/** Hue offsets, in degrees, for each relation. Computed in OKLCH, not HSL. */
const HARMONY: Record<HarmonyKind, number[]> = {
  analogous: [0, 28, -28],
  triadic: [0, 120, 240],
  split: [0, 150, 210],
  tetradic: [0, 90, 180, 270],
  monochrome: [0, 0, 0],
};

export interface Palette {
  kind: HarmonyKind;
  base: OKLCH;
  swatches: OKLCH[];
  hexes: string[];
}

export function harmony(base: OKLCH, kind: HarmonyKind): Palette {
  const offsets = HARMONY[kind];
  const swatches = offsets.map((d, i) =>
    oklch(
      // Monochrome varies lightness instead of hue, or it is one colour.
      kind === 'monochrome' ? Math.min(0.95, base.L + i * 0.17) : base.L,
      kind === 'monochrome' ? base.C * (1 - i * 0.22) : base.C,
      (base.H + d + 360) % 360,
    ),
  );
  return { kind, base, swatches, hexes: swatches.map((s) => hex(oklchToRgb(s))) };
}
