// ============================================================================
//  البذرة — deterministic randomness, so a voyage can be named and replayed.
//
//  `Math.random` is never used anywhere in the universe layer. Every choice
//  that looks random is drawn from a generator seeded by a string the user can
//  read, copy and send, and the same string always gives the same sequence on
//  every engine that implements IEEE-754 doubles and 32-bit integer multiply.
// ============================================================================

/** FNV-1a over UTF-16 code units → unsigned 32-bit. */
export function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, and fully specified by its 32-bit state. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFrom(seed: string): () => number {
  return mulberry32(hash32(seed));
}

/** Weighted choice; weights ≤ 0 are never chosen. Returns −1 when nothing can be. */
export function weightedIndex(weights: readonly number[], r: number): number {
  let total = 0;
  for (const w of weights) if (w > 0) total += w;
  if (total <= 0) return -1;
  let x = r * total;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] <= 0) continue;
    x -= weights[i];
    if (x < 0) return i;
  }
  for (let i = weights.length - 1; i >= 0; i--) if (weights[i] > 0) return i;
  return -1;
}

/** A stable short digest of any JSON-able value, for "same route?" checks. */
export function digestOf(value: unknown): string {
  return hash32(JSON.stringify(value)).toString(16).padStart(8, '0');
}
