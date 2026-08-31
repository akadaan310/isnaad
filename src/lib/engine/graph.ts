// ============================================================================
//  Resonance and the walk through حجرة اللاتزمّن.
//
//  Two structures live here:
//
//  1. المثاني - given one āyah, which others carry the same isnād contour, its
//     inversion, or its mirror. Signatures are compared, not words.
//
//  2. The chamber walk - a weighted graph over the whole muṣḥaf whose edges are
//     the ʿarabī operations themselves (a shared motif, an inverted contour, a
//     returning root, a bridge into the present, creation taking the chair).
//     The walk is forbidden from using the same operation twice in a row, so
//     the sequence it produces is a tartīl of *different* operations rather
//     than a list of similar āyāt - the point being to hold, in one passage,
//     how many distinct ways the tongue can move.
// ============================================================================
import type { DiscoveryKind, Motif, TarteelStation } from '../types';
import { invertContour } from '../isnad';

/** One row of data/index/ayaat.json - the whole muṣḥaf at ~6k entries. */
export interface AyahIndexRow {
  s: number;
  a: number;
  sig: string;
  d: number;
  v: [number, number, number];
  c: number;
  w: number;
  k: number;
}

export type RootIndex = Record<string, [number, number][]>;

// ── المثاني ─────────────────────────────────────────────────────────────────

export type ResonanceKind = 'identical' | 'inverted' | 'mirrored' | 'vector';

export interface Resonance {
  surah: number;
  ayah: number;
  kind: ResonanceKind;
  score: number;
  sig: string;
  reason: string;
}

const RESONANCE_AR: Record<ResonanceKind, string> = {
  identical: 'كنتور إسناد مطابق',
  inverted: 'كنتور معكوس — المتكلم والغائب يتبادلان المقعد',
  mirrored: 'كنتور مقلوب الترتيب',
  vector: 'تقارب في متجه الإسناد',
};

function cosine(a: [number, number, number], b: [number, number, number]): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const ma = Math.hypot(...a);
  const mb = Math.hypot(...b);
  return ma && mb ? dot / (ma * mb) : 0;
}

const reversed = (s: string) => [...s].reverse().join('');

/**
 * Rank the muṣḥaf against one āyah. Identical and inverted contours are exact
 * matches and rank above vector similarity, which is a fallback for āyāt whose
 * signature is too short to be distinctive on its own.
 */
export function findResonance(
  index: AyahIndexRow[],
  surah: number,
  ayah: number,
  limit = 24,
): { anchor: AyahIndexRow | undefined; matches: Resonance[] } {
  const anchor = index.find((r) => r.s === surah && r.a === ayah);
  if (!anchor) return { anchor: undefined, matches: [] };

  const inverted = invertContour(anchor.sig);
  const mirror = reversed(anchor.sig);
  const out: Resonance[] = [];

  for (const r of index) {
    if (r.s === surah && r.a === ayah) continue;
    if (r.sig.length < 2) continue;

    let kind: ResonanceKind | null = null;
    let score = 0;

    if (r.sig === anchor.sig) {
      kind = 'identical';
      // Longer signatures matching exactly are far less likely by chance.
      score = 0.62 + Math.min(anchor.sig.length, 8) * 0.045;
    } else if (anchor.sig.length >= 3 && r.sig === inverted) {
      kind = 'inverted';
      score = 0.68 + Math.min(anchor.sig.length, 8) * 0.04;
    } else if (anchor.sig.length >= 3 && r.sig === mirror) {
      kind = 'mirrored';
      score = 0.55 + Math.min(anchor.sig.length, 8) * 0.035;
    } else {
      const c = cosine(anchor.v, r.v);
      if (c > 0.985 && Math.abs(anchor.d - r.d) < 0.06) {
        kind = 'vector';
        score = 0.3 + (c - 0.985) * 12;
      }
    }
    if (!kind) continue;
    out.push({ surah: r.s, ayah: r.a, kind, score, sig: r.sig, reason: RESONANCE_AR[kind] });
  }

  out.sort((x, y) => y.score - x.score);
  return { anchor, matches: out.slice(0, limit) };
}

// ── حجرة اللاتزمّن ───────────────────────────────────────────────────────────

/**
 * Seeds where the text itself audits elapsed time - the sleepers of the cave
 * and their "how long did you stay", the hundred years of 2:259, the "we
 * stayed a day or part of a day" of the resurrection, and 41:47, to which the
 * knowledge of the Hour is returned.
 */
export const CHAMBER_SEEDS: { surah: number; ayah: number; label: string }[] = [
  { surah: 18, ayah: 11, label: 'فَضَرَبْنَا عَلَىٰٓ ءَاذَانِهِمْ' },
  { surah: 18, ayah: 19, label: 'كَمْ لَبِثْتُمْ' },
  { surah: 18, ayah: 25, label: 'وَلَبِثُوا۟ فِى كَهْفِهِمْ' },
  { surah: 41, ayah: 47, label: 'إِلَيْهِ يُرَدُّ عِلْمُ ٱلسَّاعَةِ' },
  { surah: 2, ayah: 259, label: 'فَأَمَاتَهُ ٱللَّهُ مِا۟ئَةَ عَامٍ' },
  { surah: 23, ayah: 112, label: 'كَمْ لَبِثْتُمْ فِى ٱلْأَرْضِ' },
  { surah: 30, ayah: 55, label: 'مَا لَبِثُوا۟ غَيْرَ سَاعَةٍ' },
  { surah: 20, ayah: 104, label: 'إِن لَّبِثْتُمْ إِلَّا يَوْمًا' },
  { surah: 79, ayah: 46, label: 'لَمْ يَلْبَثُوٓا۟ إِلَّا عَشِيَّةً' },
  { surah: 28, ayah: 5, label: 'وَنُرِيدُ أَن نَّمُنَّ' },
];

export type Operation =
  | 'motif'
  | 'inversion'
  | 'root-return'
  | 'bridge'
  | 'khalq'
  | 'distance-flip';

export const OPERATION_AR: Record<Operation, { label: string; verb: string }> = {
  motif: { label: 'مثاني الإسناد', verb: 'انتقل بكنتور إسنادٍ مشترك' },
  inversion: { label: 'انقلاب الكنتور', verb: 'انتقل إلى الكنتور المعكوس' },
  'root-return': { label: 'رجع الجذر', verb: 'انتقل بجذرٍ عائد' },
  bridge: { label: 'جسر النبأ', verb: 'انتقل إلى أعلى جسرٍ إلى الحاضر' },
  khalq: { label: 'ألسنة الخلق', verb: 'انتقل حيث الخلق في مقعد الإسناد' },
  'distance-flip': { label: 'انقلاب المسافة', verb: 'انتقل من القرب إلى البعد' },
};

export interface ChamberInput {
  index: AyahIndexRow[];
  motifs: Motif[];
  roots: RootIndex;
  /** Root of the anchor āyah, used to seed the root-return operation. */
  rootsOfAyah: (surah: number, ayah: number) => string[];
  nameOf: (surah: number) => string;
  textOf: (surah: number, ayah: number) => string;
}

interface Candidate {
  row: AyahIndexRow;
  op: Operation;
  score: number;
  bridge: string;
}

const key = (s: number, a: number) => `${s}:${a}`;

function motifNeighbours(motifs: Motif[], s: number, a: number): { row: [number, number]; motif: Motif }[] {
  const out: { row: [number, number]; motif: Motif }[] = [];
  for (const m of motifs) {
    if (!m.occurrences.some((o) => o.surah === s && o.ayah === a)) continue;
    for (const o of m.occurrences) {
      if (o.surah === s && o.ayah === a) continue;
      out.push({ row: [o.surah, o.ayah], motif: m });
    }
  }
  return out;
}

/**
 * Walk the chamber. Greedy rather than exhaustive: at each station the highest
 * scoring candidate is taken from an operation that has not been used in the
 * last two steps, so the sequence keeps changing what it is doing to the text.
 */
export function walkChamber(
  input: ChamberInput,
  seed: { surah: number; ayah: number },
  stations = 7,
): TarteelStation[] {
  const { index, motifs, roots, rootsOfAyah, nameOf, textOf } = input;
  const byKey = new Map(index.map((r) => [key(r.s, r.a), r]));

  const start = byKey.get(key(seed.surah, seed.ayah));
  if (!start) return [];

  const visited = new Set<string>([key(start.s, start.a)]);
  const recentOps: Operation[] = [];

  const walk: TarteelStation[] = [
    {
      surah: start.s,
      ayah: start.a,
      surahName: nameOf(start.s),
      text: textOf(start.s, start.a),
      operation: 'seed',
      operationLabel: 'مبتدأ الحجرة',
      bridge: 'موضع ابتداءٍ يُسائل فيه النصُّ مقدارَ ما مضى من الزمن.',
      distance: start.d,
      vec: { p1: start.v[0], p2: start.v[1], p3: start.v[2] },
    },
  ];

  let cur = start;

  for (let step = 1; step < stations; step++) {
    const candidates: Candidate[] = [];
    const allowed = (op: Operation) => !recentOps.slice(-2).includes(op);

    // 1. a shared isnād motif
    if (allowed('motif')) {
      for (const { row, motif } of motifNeighbours(motifs, cur.s, cur.a)) {
        const r = byKey.get(key(row[0], row[1]));
        if (!r || visited.has(key(r.s, r.a))) continue;
        candidates.push({
          row: r,
          op: 'motif',
          score: 0.5 + motif.length * 0.04 + (r.s !== cur.s ? 0.2 : 0),
          bridge: `يجمعهما كنتورٌ واحد من ${motif.length} مواضع إسناد: ${motif.pattern}`,
        });
      }
    }

    // 2. the inverted contour
    if (allowed('inversion') && cur.sig.length >= 3) {
      const target = invertContour(cur.sig);
      for (const r of index) {
        if (r.sig !== target || visited.has(key(r.s, r.a))) continue;
        candidates.push({
          row: r,
          op: 'inversion',
          score: 0.55 + Math.min(cur.sig.length, 8) * 0.04 + (r.s !== cur.s ? 0.15 : 0),
          bridge: `كنتور «${cur.sig}» انقلب إلى «${r.sig}» — تبادَل المتكلمُ والغائبُ المقعد`,
        });
        if (candidates.length > 80) break;
      }
    }

    // 3. a root that returns elsewhere - rarer roots make stronger edges
    if (allowed('root-return')) {
      for (const root of rootsOfAyah(cur.s, cur.a)) {
        const places = roots[root];
        if (!places || places.length < 2 || places.length > 24) continue;
        for (const [s, a] of places) {
          const r = byKey.get(key(s, a));
          if (!r || visited.has(key(s, a)) || (s === cur.s && a === cur.a)) continue;
          candidates.push({
            row: r,
            op: 'root-return',
            score: 0.42 + (1 / places.length) * 2.2 + (s !== cur.s ? 0.18 : 0),
            bridge: `الجذر «${root}» يعود هنا — ولا يقع في المصحف إلا في ${places.length} موضعًا`,
          });
        }
      }
    }

    // 4. the strongest bridge into the present tense
    if (allowed('bridge')) {
      const best = [...index]
        .filter((r) => !visited.has(key(r.s, r.a)) && r.c > 0.5)
        .sort((a, b) => b.c - a.c)
        .slice(0, 12);
      for (const r of best) {
        candidates.push({
          row: r,
          op: 'bridge',
          score: 0.4 + r.c * 0.4,
          bridge: `ماضٍ وحاضرٌ في نفَسٍ واحد — قوّة الجسر ${r.c.toFixed(2)}`,
        });
      }
    }

    // 5. creation holding the chair
    if (allowed('khalq')) {
      const best = [...index]
        .filter((r) => !visited.has(key(r.s, r.a)) && r.k > 0)
        .sort((a, b) => b.k / b.w - a.k / a.w)
        .slice(0, 12);
      for (const r of best) {
        candidates.push({
          row: r,
          op: 'khalq',
          score: 0.38 + Math.min(r.k, 4) * 0.09,
          bridge: `${r.k} من الكلم يقع فيها غيرُ الإنسي في مقعد الإسناد`,
        });
      }
    }

    // 6. the far side of the proximity axis
    if (allowed('distance-flip')) {
      const target = 1 - cur.d;
      const best = [...index]
        .filter((r) => !visited.has(key(r.s, r.a)) && r.w >= 4)
        .sort((a, b) => Math.abs(a.d - target) - Math.abs(b.d - target))
        .slice(0, 12);
      for (const r of best) {
        candidates.push({
          row: r,
          op: 'distance-flip',
          score: 0.36 + (1 - Math.abs(r.d - target)) * 0.3,
          bridge:
            cur.d < 0.5
              ? `من المناجاة (${cur.d.toFixed(2)}) إلى الغيبة (${r.d.toFixed(2)})`
              : `من الغيبة (${cur.d.toFixed(2)}) إلى المناجاة (${r.d.toFixed(2)})`,
        });
      }
    }

    if (!candidates.length) break;
    candidates.sort((a, b) => b.score - a.score);
    const next = candidates[0];

    visited.add(key(next.row.s, next.row.a));
    recentOps.push(next.op);
    cur = next.row;

    walk.push({
      surah: next.row.s,
      ayah: next.row.a,
      surahName: nameOf(next.row.s),
      text: textOf(next.row.s, next.row.a),
      operation: next.op as unknown as DiscoveryKind,
      operationLabel: OPERATION_AR[next.op].label,
      bridge: next.bridge,
      distance: next.row.d,
      vec: { p1: next.row.v[0], p2: next.row.v[1], p3: next.row.v[2] },
    });
  }

  return walk;
}
