// ============================================================================
//  التغطية — how much of the muṣḥaf a drawn relation actually stands for.
//
//  The field holds 1,000 of 6,236 āyāt, so roughly seven occurrences in ten of
//  every relation lie outside it. Until now that absence was silent: a contour
//  drawn as 27 segments recurs 60 times, and nothing said so.
//
//  Nothing here derives anything. Every figure is a count over indices the
//  ingest already wrote, and every one names the unit it counts in — because
//  "occurrences", "loci", "findings" and "drawable pairs" are four different
//  things and averaging them would be the lie this module exists to prevent.
// ============================================================================
import type { Discovery, Motif } from '../types';
import type { RootIndex } from '../engine/graph';
import type { LocusJoin } from './locus';
import { DEFAULT_ROOT_OPTIONS, type RootStrandOptions } from './strands';

export interface FamilyCoverage {
  /** What one unit is, in Arabic, so a number is never read bare. */
  unit: string;
  /** Present anywhere in the muṣḥaf. */
  corpus: number;
  /**
   * Retained in the index the field is built from. Equal to `corpus` unless
   * the ingest truncated — which, for discoveries, it did.
   */
  indexed: number;
  /** Falling on one of the placed āyāt. */
  placed: number;
  /** Second unit, where the family has one: contours, roots, pairs. */
  groups?: { unit: string; corpus: number; placed: number };
  /**
   * Why `indexed` is below `corpus`, when it is — as numbers, not prose. Arabic
   * reading flow takes Arabic-Indic digits, and this module has no business
   * formatting: it counts, and the panel writes the sentence.
   */
  gate?: { min: number; max: number; passed: number };
}

export interface FieldCoverage {
  ayaat: { corpus: number; placed: number };
  motif: FamilyCoverage;
  root: FamilyCoverage;
  discovery: FamilyCoverage;
  /**
   * The score below which the discovery index holds nothing, measured from the
   * index itself rather than assumed from the detector options. A field-level
   * threshold cannot go below this and recover anything.
   */
  discoveryFloor: number;
  /** The thresholds the indices were mined at. */
  minedAt: Record<string, number>;
}

export function measureCoverage(
  join: LocusJoin,
  motifs: readonly Motif[],
  roots: RootIndex,
  discoveries: readonly Discovery[],
  manifest: { ayaat?: number; discoveries?: number; motifs?: number; roots?: number; detectorOptions?: Record<string, number> },
  rootOpt: RootStrandOptions = DEFAULT_ROOT_OPTIONS,
): FieldCoverage {
  let motifOccurrences = 0;
  let motifPlaced = 0;
  let motifGroupsPlaced = 0;
  for (const m of motifs) {
    motifOccurrences += m.occurrences.length;
    const placed = m.occurrences.filter((o) => join.has(o.surah, o.ayah)).length;
    motifPlaced += placed;
    if (join.chain(m.occurrences.map((o) => ({ surah: o.surah, ayah: o.ayah }))).length >= 2) {
      motifGroupsPlaced++;
    }
  }

  // Roots are counted twice over: every locus of every root, and then only the
  // loci of roots rare enough to bind (2–24). The strand layer draws the second
  // set, so quoting the first beside a drawn line would overstate reach.
  let rootLoci = 0;
  let rootGated = 0;
  let rootGatedPlaced = 0;
  let rootGroups = 0;
  let rootGroupsPlaced = 0;
  for (const places of Object.values(roots)) {
    rootLoci += places.length;
    if (places.length < rootOpt.minLoci || places.length > rootOpt.maxLoci) continue;
    rootGroups++;
    rootGated += places.length;
    const placed = places.filter(([s, a]) => join.has(s, a)).length;
    rootGatedPlaced += placed;
    if (join.chain(places.map(([surah, ayah]) => ({ surah, ayah }))).length >= 2) rootGroupsPlaced++;
  }

  let discoveryPairs = 0;
  let floor = Infinity;
  for (const d of discoveries) {
    floor = Math.min(floor, d.score);
    if (d.ayahFrom !== d.ayahTo && join.has(d.surah, d.ayahFrom) && join.has(d.surah, d.ayahTo)) {
      discoveryPairs++;
    }
  }

  return {
    ayaat: { corpus: manifest.ayaat ?? 6236, placed: join.size },
    motif: {
      unit: 'موضع',
      corpus: motifOccurrences,
      indexed: motifOccurrences,
      placed: motifPlaced,
      groups: { unit: 'كنتور', corpus: motifs.length, placed: motifGroupsPlaced },
    },
    root: {
      unit: 'موضع',
      corpus: rootLoci,
      indexed: rootGated,
      placed: rootGatedPlaced,
      groups: { unit: 'جذر', corpus: Object.keys(roots).length, placed: rootGroupsPlaced },
      gate: { min: rootOpt.minLoci, max: rootOpt.maxLoci, passed: rootGroups },
    },
    discovery: {
      unit: 'استنباط',
      corpus: manifest.discoveries ?? discoveries.length,
      indexed: discoveries.length,
      placed: discoveryPairs,
      groups: { unit: 'ضفّتان موضوعتان', corpus: discoveries.length, placed: discoveryPairs },
    },
    discoveryFloor: Number.isFinite(floor) ? floor : 0,
    minedAt: manifest.detectorOptions ?? {},
  };
}
