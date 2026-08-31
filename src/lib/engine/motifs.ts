// ============================================================================
//  المثاني — mining repeated isnād contours with a suffix automaton.
//
//  Each spine word contributes one symbol (person × tense), so the whole
//  muṣḥaf becomes a single string over a twelve-letter alphabet. A suffix
//  automaton over that string yields every right-maximal repeated contour at
//  once, with no ceiling on length — which is the point: the interesting
//  مثاني are not the ones we thought to look for.
// ============================================================================
import type { Motif } from '../types';
import { glossContour, invertContour } from '../isnad';

// ── the alphabet ────────────────────────────────────────────────────────────
const SYMBOLS = ['1p', '1i', '1v', '1n', '2p', '2i', '2v', '2n', '3p', '3i', '3v', '3n'];
const SYM_TO_CHAR = new Map(SYMBOLS.map((s, i) => [s, String.fromCharCode(0x41 + i)]));
const CHAR_TO_SYM = new Map(SYMBOLS.map((s, i) => [String.fromCharCode(0x41 + i), s]));

export function encodeContour(symbols: string[]): string {
  return symbols.map((s) => SYM_TO_CHAR.get(s) ?? 'Z').join('');
}
export function decodeContour(encoded: string): string {
  return [...encoded].map((c) => CHAR_TO_SYM.get(c) ?? '?').join('.');
}
export function encodePattern(pattern: string): string {
  return encodeContour(pattern.split('.'));
}

// ── suffix automaton ────────────────────────────────────────────────────────
interface SAMState {
  len: number;
  link: number;
  next: Map<string, number>;
  /** End position (0-based, inclusive) of one occurrence of this class. */
  firstPos: number;
  clone: boolean;
}

class SuffixAutomaton {
  states: SAMState[] = [{ len: 0, link: -1, next: new Map(), firstPos: -1, clone: false }];
  private last = 0;

  extend(ch: string, pos: number): void {
    const cur = this.states.length;
    this.states.push({ len: this.states[this.last].len + 1, link: -1, next: new Map(), firstPos: pos, clone: false });
    let p = this.last;
    while (p !== -1 && !this.states[p].next.has(ch)) {
      this.states[p].next.set(ch, cur);
      p = this.states[p].link;
    }
    if (p === -1) {
      this.states[cur].link = 0;
    } else {
      const q = this.states[p].next.get(ch)!;
      if (this.states[p].len + 1 === this.states[q].len) {
        this.states[cur].link = q;
      } else {
        const clone = this.states.length;
        this.states.push({
          len: this.states[p].len + 1,
          link: this.states[q].link,
          next: new Map(this.states[q].next),
          firstPos: this.states[q].firstPos,
          clone: true,
        });
        while (p !== -1 && this.states[p].next.get(ch) === q) {
          this.states[p].next.set(ch, clone);
          p = this.states[p].link;
        }
        this.states[q].link = clone;
        this.states[cur].link = clone;
      }
    }
    this.last = cur;
  }

  /** Occurrence count per state, aggregated up the suffix-link tree. */
  counts(): Int32Array {
    const n = this.states.length;
    const cnt = new Int32Array(n);
    for (let i = 1; i < n; i++) if (!this.states[i].clone) cnt[i] = 1;
    // Counting sort by len gives a valid bottom-up order over the link tree.
    const maxLen = this.states.reduce((m, s) => Math.max(m, s.len), 0);
    const bucket = new Int32Array(maxLen + 1);
    for (const s of this.states) bucket[s.len]++;
    for (let i = 1; i <= maxLen; i++) bucket[i] += bucket[i - 1];
    const order = new Int32Array(n);
    for (let i = n - 1; i >= 0; i--) order[--bucket[this.states[i].len]] = i;
    for (let i = n - 1; i >= 1; i--) {
      const v = order[i];
      const link = this.states[v].link;
      if (link > 0) cnt[link] += cnt[v];
    }
    return cnt;
  }
}

export interface MotifMiningOptions {
  minLength: number;
  maxLength: number;
  minOccurrences: number;
  /** Motifs must appear in at least this many distinct sūrahs. */
  minSpread: number;
  limit: number;
}

export const DEFAULT_MINING: MotifMiningOptions = {
  minLength: 5,
  maxLength: 24,
  minOccurrences: 2,
  minSpread: 2,
  limit: 400,
};

/** Where each symbol of the global contour string came from. */
export interface ContourPosition {
  surah: number;
  ayah: number;
  wordIdx: number;
}

/**
 * Mine right-maximal repeated contours. A contour is right-maximal when no
 * single-symbol extension preserves its occurrence count — i.e. it is the
 * longest form of its own repetition, not an arbitrary window inside one.
 */
export function mineMotifs(
  encoded: string,
  positions: ContourPosition[],
  opt: MotifMiningOptions = DEFAULT_MINING,
): Motif[] {
  const sam = new SuffixAutomaton();
  for (let i = 0; i < encoded.length; i++) sam.extend(encoded[i], i);
  const cnt = sam.counts();

  // Candidate patterns: right-maximal, repeated, within the length band.
  const candidates: { pattern: string; count: number }[] = [];
  for (let v = 1; v < sam.states.length; v++) {
    const st = sam.states[v];
    if (cnt[v] < opt.minOccurrences) continue;
    if (st.len < opt.minLength || st.len > opt.maxLength) continue;
    let rightMaximal = true;
    for (const to of st.next.values()) {
      if (cnt[to] === cnt[v]) { rightMaximal = false; break; }
    }
    if (!rightMaximal) continue;
    candidates.push({ pattern: encoded.slice(st.firstPos - st.len + 1, st.firstPos + 1), count: cnt[v] });
  }

  // Locate every occurrence of the surviving patterns in one indexed pass.
  candidates.sort((a, b) => b.count * b.pattern.length - a.count * a.pattern.length);
  const chosen = candidates.slice(0, opt.limit * 3);
  const byLength = new Map<number, Map<string, number[]>>();
  for (const c of chosen) {
    if (!byLength.has(c.pattern.length)) byLength.set(c.pattern.length, new Map());
    byLength.get(c.pattern.length)!.set(c.pattern, []);
  }
  for (const [L, table] of byLength) {
    for (let i = 0; i + L <= encoded.length; i++) {
      const gram = encoded.slice(i, i + L);
      const slot = table.get(gram);
      if (slot) slot.push(i);
    }
  }

  const motifs: Motif[] = [];
  for (const c of chosen) {
    const starts = byLength.get(c.pattern.length)!.get(c.pattern)!;
    if (starts.length < opt.minOccurrences) continue;
    const occurrences = starts.map((i) => {
      const a = positions[i];
      const b = positions[i + c.pattern.length - 1];
      return { surah: a.surah, ayah: a.ayah, from: a.wordIdx, to: b.wordIdx };
    });
    const spread = new Set(occurrences.map((o) => o.surah)).size;
    if (spread < opt.minSpread) continue;
    const pattern = decodeContour(c.pattern);
    motifs.push({
      id: `m${motifs.length}`,
      pattern,
      gloss: glossContour(pattern),
      length: c.pattern.length,
      occurrences: occurrences.slice(0, 60),
      spread,
    });
  }

  // Flag mirror pairs: the same contour with المتكلم and الغائب trading seats.
  const index = new Map(motifs.map((m) => [m.pattern, m.id]));
  for (const m of motifs) {
    const mirror = index.get(invertContour(m.pattern));
    if (mirror && mirror !== m.id) m.mirrorOf = mirror;
  }

  motifs.sort((a, b) => b.spread * b.length - a.spread * a.length);
  return motifs.slice(0, opt.limit);
}
