// ============================================================================
//  الكون الكامل — the full-universe payload.
//
//  Every one of the 6,236 āyāt is a row, in muṣḥaf order. The row index *is*
//  the āyah's global ordinal (الفاتحة ١ = 0, الناس ٦ = 6235), so locus →
//  index is arithmetic, not a lookup that can silently miss.
//
//  The payload is columnar: one array per field rather than one object per
//  āyah. At 6,236 rows that is the difference between ~0.5MB and ~1.6MB on the
//  wire, and the renderer wants flat arrays anyway.
//
//  Text is deliberately absent. The Arabic of an āyah is fetched from the
//  corpus by locus when it is shown, so there is exactly one copy of the
//  muṣḥaf in the repository and the field cannot drift from it.
// ============================================================================

export const UNIVERSE_VERSION = 1;

/** Bit flags per āyah. Each names a fact about the row, never a judgement. */
export const FLAG = {
  /** At least one isnād reference carries person mass. */
  ATTRIBUTED: 1,
  /** At least one engine discovery touches this āyah (full, untruncated sweep). */
  DISCOVERY: 2,
  /** At least one الالتفات seam falls inside it. */
  SEAM: 4,
  /** Member of the legacy 1,000-āyah highlight preset (data/cosmos/nodes.json). */
  LEGACY: 8,
  /** Fewer than three words — the legacy filter dropped these. */
  SHORT: 16,
  /** Named by at least one عَلَم marker. */
  MARKED: 32,
} as const;

export interface UniverseSurah {
  id: number;
  name: string;
  /** Global index of the surah's first āyah. */
  first: number;
  count: number;
}

export interface UniversePayload {
  version: number;
  count: number;
  /** How positions were made, in words and constants. See placement.ts. */
  transform: UniverseTransform;
  surahs: UniverseSurah[];
  /** Columns, all of length `count`. */
  s: number[];
  a: number[];
  /** Flattened positions, 3 per row, in universe units (u). */
  p: number[];
  /** Discourse distance 0…1, or −1 when the āyah carries no person mass. */
  d: number[];
  /** Person shares, 3 per row (p1, p2, p3), each 0…1. */
  v: number[];
  /** Compressed person contour, as in data/index/ayaat.json. */
  sig: string[];
  /** Word count. */
  w: number[];
  /** Discoveries touching the āyah, from the full sweep at default thresholds. */
  dc: number[];
  /** Index into `kinds` of the strongest discovery, or −1. */
  dk: number[];
  /** Seams inside the āyah. */
  sm: number[];
  /** FLAG bits. */
  f: number[];
  /** Index of this āyah in the legacy preset's node array, or −1. */
  legacy: number[];
  kinds: string[];
}

export interface UniverseTransform {
  id: 'mushaf-spiral/discourse-radius';
  /** Direction: a continuous spherical spiral walked in muṣḥaf order. */
  direction: string;
  /** Radius: discourse distance, the same affine map as the legacy field. */
  radius: string;
  radialBase: number;
  radialSpan: number;
  /** Radius of the shell holding āyāt with no person mass. */
  unattributedRadius: number;
  /** Spiral constant: azimuth = polar angle × this. */
  spiralTurns: number;
  /** What this is not. Rendered verbatim by the overlay. */
  disclaimer: string;
}

/** A relation between two āyāt, as the engine already computed it. */
export type UniverseLinkKind = 'tartib' | 'root' | 'motif' | 'discovery';

export interface UniverseRelations {
  version: number;
  kinds: UniverseLinkKind[];
  /** Interned evidence strings: a root, a motif pattern, a discovery title. */
  evidence: string[];
  /** `[a, b, kindIndex, weight×1000, evidenceIndex]`, a < b. */
  links: [number, number, number, number, number][];
}

export interface UniverseManifest {
  builtAt: string;
  version: number;
  counts: UniverseCoverage;
  sha256: Record<string, string>;
  legacy: { reconstructed: boolean; count: number; mismatches: number; note: string };
  sources: string[];
}

/**
 * Four counts that are easy to conflate and must never be averaged together.
 * See coverage.ts.
 */
export interface UniverseCoverage {
  /** Āyāt in the corpus. */
  corpus: number;
  /** Āyāt the engine analysed (built, spined, detector-swept). */
  analyzed: number;
  /** Āyāt in which at least one phenomenon was detected. */
  detected: number;
  /** Of those, āyāt touched by a detector discovery (seams alone excluded). */
  withDiscovery: number;
  /** Āyāt with a finite position in the field. */
  placed: number;
  /** Āyāt with no person mass: placed, but on their own shell. */
  unattributed: number;
  /** Āyāt the legacy filter would have dropped for length alone. */
  short: number;
  /** Members of the legacy highlight preset. */
  legacyPreset: number;
  surahs: number;
}
