// ============================================================================
//  Corpus assembly - shared by the ingest script and the request path.
//
//  Nothing derived is ever stored. The corpus on disk is the morphology rows
//  and the Uthmani text, and every spine, seam, frame and discovery is rebuilt
//  from them on demand (about 80ms for al-Baqarah, the longest surah, then
//  cached). That keeps one source of truth, keeps the repository small, and
//  lets the detector thresholds be tuned live rather than baked in.
// ============================================================================
import { parseFeatures } from './morphology';
import {
  assignRoles,
  collectRefs,
  findSeams,
  personVector,
  distanceOf,
  dominantPerson,
  signature,
  type Seam,
} from './isnad';
import { buildFrames, applyDepth, maxDepth, type Frame } from './engine/frames';
import {
  runAllDetectors,
  clockOf,
  DEFAULT_OPTIONS,
  type DetectorOptions,
} from './engine/detectors';
import type { Ayah, Discovery, Surah, Word } from './types';

/** One morphology row: `ayah:word:seg <tab> form <tab> class <tab> features`. */
export interface CorpusRow {
  a: number;
  w: number;
  i: number;
  form: string;
  cls: string;
  feat: string;
}

export interface SurahSource {
  id: number;
  name: string;
  transliteration: string;
  type: string;
  uthmani: string[];
}

/** Canonical juz' start points (surah, ayah). */
export const JUZ_STARTS: [number, number][] = [
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111],
  [7, 88], [8, 41], [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75],
  [21, 1], [23, 1], [25, 21], [27, 56], [29, 46], [33, 31], [36, 28], [39, 32],
  [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
];

export function juzOf(surah: number, ayah: number): number {
  let juz = 1;
  for (let i = 0; i < JUZ_STARTS.length; i++) {
    const [s, a] = JUZ_STARTS[i];
    if (surah > s || (surah === s && ayah >= a)) juz = i + 1;
    else break;
  }
  return juz;
}

/** Parse a per-surah corpus file. Malformed rows are skipped, not guessed at. */
export function parseCorpus(text: string): CorpusRow[] {
  const rows: CorpusRow[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const [loc, form, cls, feat] = line.split('\t');
    const parts = loc?.split(':');
    if (!parts || parts.length !== 3 || cls === undefined) continue;
    const [a, w, i] = parts.map(Number);
    if (!Number.isFinite(a) || !Number.isFinite(w) || !Number.isFinite(i)) continue;
    rows.push({ a, w, i, form: form ?? '', cls, feat: feat ?? '' });
  }
  return rows;
}

/**
 * Assemble a sūrah from its morphology rows. The reader's word tokens come
 * from the morphology itself rather than from aligning two files, so a word
 * and its analysis cannot drift apart.
 */
export function buildSurah(id: number, rows: CorpusRow[], src: SurahSource): Surah {
  const words: Word[] = [];
  /** Āyah boundaries only; the aggregates need resolved spines and come after. */
  const bounds: { n: number; from: number; to: number }[] = [];

  let curAyah = -1;
  let curWord = -1;
  let word: Word | null = null;
  let ayahStart = 0;

  const closeAyah = () => {
    if (curAyah < 0) return;
    bounds.push({ n: curAyah, from: ayahStart, to: words.length });
    ayahStart = words.length;
  };

  for (const r of rows) {
    if (r.a !== curAyah) {
      closeAyah();
      curAyah = r.a;
      curWord = -1;
    }
    if (r.w !== curWord) {
      curWord = r.w;
      word = {
        idx: words.length, n: r.w, ayah: r.a, text: '', segments: [],
        person: null, role: null, num: null, gender: null, tense: null,
        refs: [], depth: 0,
      };
      words.push(word);
    }
    const f = parseFeatures(r.cls, r.feat);
    word!.segments.push({
      i: r.i, form: r.form, cls: r.cls, tag: f.tag, feats: f.feats,
      root: f.root, lemma: f.lemma, person: f.person, num: f.num,
      gender: f.gender ?? undefined, tense: f.tense, vf: f.vf,
      passive: f.passive, mood: f.mood, clitic: f.clitic,
      gcase: f.gcase, indef: f.indef, adj: f.adj,
    });
    word!.text += r.form;
  }
  closeAyah();

  // Resolve every word's isnād spine before anything aggregates over it.
  // The āyah vector, its signature, its distance on the proximity axis and its
  // dominant person are all functions of the spine, so they cannot be computed
  // in the pass above - doing so reads `person: null` for every word and
  // silently yields empty signatures across the whole muṣḥaf.
  for (const w of words) {
    const spine = assignRoles(w.segments);
    w.person = spine.person;
    w.role = spine.role;
    w.refs = collectRefs(w.segments);
    const carrier = w.segments.find((s) => s.role === w.role && s.person === w.person);
    w.num = carrier?.num ?? null;
    w.gender = carrier?.gender ?? null;
    w.tense = w.segments.find((s) => s.cls === 'V')?.tense ?? null;
    const stem = w.segments.find((s) => !s.clitic && (s.root || s.lemma));
    w.root = stem?.root;
    w.lemma = stem?.lemma;
  }

  const ayaat: Ayah[] = bounds.map((b) => {
    const span = words.slice(b.from, b.to);
    const vec = personVector(span);
    return {
      n: b.n,
      text: span.map((w) => w.text).join(' '),
      uthmani: src.uthmani[b.n - 1],
      from: b.from,
      to: b.to,
      juz: juzOf(id, b.n),
      vec,
      distance: distanceOf(vec),
      sig: signature(span),
      dominant: dominantPerson(vec),
      clock: clockOf(span),
    };
  });

  const frames = buildFrames(words, ayaat);
  applyDepth(words, frames);
  const vec = personVector(words);

  return {
    id,
    name: src.name,
    transliteration: src.transliteration,
    type: src.type === 'meccan' || src.type === 'makkan' ? 'makkiyyah' : 'madaniyyah',
    ayahCount: ayaat.length,
    wordCount: words.length,
    juzRange: [ayaat[0]?.juz ?? 1, ayaat[ayaat.length - 1]?.juz ?? 1],
    vec,
    distance: distanceOf(vec),
    discoveryCounts: {},
    maxDepth: maxDepth(frames),
    ayaat,
    words,
  };
}

export interface AnalyzedSurah {
  surah: Surah;
  frames: Frame[];
  seams: Seam[];
  discoveries: Discovery[];
}

/**
 * Run the full detector sweep over an assembled sūrah. `detectKhalq` stamps
 * `word.khalq` as a side effect, so this must run before the words are
 * serialised to the client.
 */
export function analyze(
  surah: Surah,
  opt: DetectorOptions = DEFAULT_OPTIONS,
): AnalyzedSurah {
  const frames = buildFrames(surah.words, surah.ayaat);
  applyDepth(surah.words, frames);
  const seams = findSeams(surah.words);
  const discoveries = runAllDetectors(
    {
      surah: surah.id,
      surahName: surah.name,
      words: surah.words,
      ayaat: surah.ayaat,
      frames,
      seams,
    },
    opt,
  );

  const counts: Record<string, number> = {};
  for (const d of discoveries) counts[d.kind] = (counts[d.kind] ?? 0) + 1;
  surah.discoveryCounts = counts;

  return { surah, frames, seams, discoveries };
}
