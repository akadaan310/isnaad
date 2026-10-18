// ============================================================================
//  الإعداد الموروث — the original thousand, as a named, reconstructible preset.
//
//  scripts/ingest-cosmos.ts chose 1,000 āyāt by score, capped each sūrah at
//  ⌈1000/114 × 3.2⌉ = 29, and skipped every āyah under three words. That is a
//  curated highlight, not the muṣḥaf, and the full-universe mode does not use
//  it. It is kept, under this name, because the field it produced is a
//  historical artifact with its own screenshots and compositions.
//
//  This module restates the selection rule as a pure function so it can be
//  re-derived and compared against data/cosmos/nodes.json. ingest-cosmos.ts is
//  left as it was written; scripts/ingest-universe.ts proves the two agree.
// ============================================================================

export interface LegacyPresetRule {
  id: 'legacy-highlight-1000';
  target: number;
  /** perSurahCap = ⌈target/114 × capFactor⌉ */
  capFactor: number;
  /** Āyāt with fewer words are not candidates. */
  minWords: number;
}

export const LEGACY_PRESET: LegacyPresetRule = {
  id: 'legacy-highlight-1000',
  target: 1000,
  capFactor: 3.2,
  minWords: 3,
};

export interface LegacyScoreInput {
  /** Strongest discovery score at the āyah (first found, as the ingest did), or null. */
  discoveryScore: number | null;
  seams: number;
  markerHits: number;
  tension: number;
  bridge: number;
}

/** The legacy score, term for term. */
export function legacyScore(x: LegacyScoreInput): number {
  const score =
    (x.discoveryScore !== null ? x.discoveryScore * 1.5 : 0) +
    Math.min(x.seams, 6) * 0.16 +
    Math.min(x.markerHits, 4) * 0.32 +
    x.tension * 0.9 +
    x.bridge * 0.5;
  // The ingest stored +score.toFixed(4) and sorted on the rounded value, which
  // decides ties; reproducing the selection means reproducing the rounding.
  return +score.toFixed(4);
}

export function legacyCap(rule: LegacyPresetRule = LEGACY_PRESET): number {
  return Math.ceil((rule.target / 114) * rule.capFactor);
}

/**
 * Select from candidates already in muṣḥaf order (the order the ingest pushed
 * them). Array.prototype.sort is stable, so equal scores keep muṣḥaf order —
 * exactly as they did in the original run.
 */
export function selectLegacy<T extends { s: number; score: number; words: number }>(
  candidates: readonly T[],
  rule: LegacyPresetRule = LEGACY_PRESET,
): T[] {
  const cap = legacyCap(rule);
  const bySurah = new Map<number, number>();
  const chosen: T[] = [];
  const eligible = candidates.filter((c) => c.words >= rule.minWords);
  for (const c of [...eligible].sort((x, y) => y.score - x.score)) {
    if (chosen.length >= rule.target) break;
    const n = bySurah.get(c.s) ?? 0;
    if (n >= cap) continue;
    bySurah.set(c.s, n + 1);
    chosen.push(c);
  }
  return chosen;
}
