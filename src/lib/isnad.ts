// ============================================================================
//  الإسناد — deriving the musnad ilayh from morphology
//
//  A person tag alone is not إسناد. `رَبِّهِمْ` references a 3rd person; it does
//  not predicate to one. This module separates the segments that seat a
//  referent in the attribution chair (SUBJECT_ROLES) from those that merely
//  point at one — and that distinction is what every downstream detector
//  stands on.
// ============================================================================
import type { Ayah, IsnadRole, Person, Segment, Word } from './types';
import { SUBJECT_ROLES } from './types';

/** The نواسخ that take an اسم: إنّ وأخواتها. Their suffix is a musnad ilayh. */
const NASIKH_TAGS = new Set(['ACC']);
/** Verbs of saying — these open a quotation frame. */
export const QAWL_ROOTS = new Set(['قول', 'نطق', 'ندي', 'نبأ', 'وحي']);
export const QAWL_STRICT = new Set(['قول']);

/**
 * Assign a grammatical office to every person-bearing segment of one word.
 * Mutates `segments` in place and returns the word's isnād spine.
 */
export function assignRoles(segments: Segment[]): {
  person: Person | null;
  role: IsnadRole | null;
} {
  let verbSeen: Segment | null = null;
  let subjectEncliticTaken = false;
  let prevStem: Segment | null = null;
  const hasVocative = segments.some((s) => s.tag === 'VOC');

  for (const s of segments) {
    if (s.cls === 'V') {
      verbSeen = s;
      subjectEncliticTaken = false;
      if (s.person) s.role = 'verb-subject';
      prevStem = s;
      continue;
    }

    if (s.person && s.tag === 'PRON') {
      if (!s.clitic) {
        s.role = 'detached';
      } else if (verbSeen) {
        // The first suffix agreeing with the verb is its ضمير رفع متصل;
        // anything after it is an object pronoun.
        if (!subjectEncliticTaken && verbSeen.person === s.person) {
          s.role = 'subject-enclitic';
          subjectEncliticTaken = true;
        } else {
          s.role = 'object';
        }
      } else if (prevStem && NASIKH_TAGS.has(prevStem.tag)) {
        s.role = 'nasikh-subject';
      } else if (prevStem && prevStem.cls === 'P') {
        s.role = 'prepositional';
      } else if (hasVocative) {
        s.role = 'vocative';
      } else {
        s.role = 'possessive';
      }
    }

    if (!s.clitic || s.cls !== 'N') prevStem = s;
    else if (s.tag !== 'PRON') prevStem = s;
  }

  // ── the spine: strongest subject office present in the word ──────────────
  const priority: IsnadRole[] = ['verb-subject', 'nasikh-subject', 'detached', 'subject-enclitic'];
  for (const role of priority) {
    const hit = segments.find((s) => s.role === role && s.person);
    if (hit) return { person: hit.person!, role };
  }
  return { person: null, role: null };
}

/** Every person a word touches, in any office. */
export function collectRefs(segments: Segment[]): Word['refs'] {
  return segments
    .filter((s): s is Segment & { person: Person; role: IsnadRole } => !!s.person && !!s.role)
    .map((s) => ({ person: s.person, role: s.role, num: s.num ?? null, gender: s.gender ?? null }));
}

// ── محور القرب والبُعد — the proximity axis ─────────────────────────────────
//
//  المخاطب sits at zero: direct address is the nearest a discourse can stand.
//  المتكلم sits mid: the speaker is present and witnessing but not addressed.
//  الغائب sits far: reality narrated as structure, with no one in the room.
export const DISTANCE_OF: Record<Person, number> = { 2: 0, 1: 0.5, 3: 1 };

/** Subject offices carry full weight; mere reference carries partial weight. */
export function roleWeight(role: IsnadRole): number {
  return SUBJECT_ROLES.includes(role) ? 1 : 0.6;
}

/**
 * Weighted person profile for a span of words. Uses every reference, not just
 * spines: `أَرَىٰكُمْ` is 1st person predicated but unmistakably proximate,
 * and a distance metric that ignored the كم would misread it.
 */
export function personVector(words: Word[]): { p1: number; p2: number; p3: number } {
  const acc = [0, 0, 0];
  let total = 0;
  for (const w of words) {
    for (const r of w.refs) {
      const wt = roleWeight(r.role);
      acc[r.person - 1] += wt;
      total += wt;
    }
  }
  if (!total) return { p1: 0, p2: 0, p3: 0 };
  return { p1: acc[0] / total, p2: acc[1] / total, p3: acc[2] / total };
}

export function distanceOf(vec: { p1: number; p2: number; p3: number }): number {
  const mass = vec.p1 + vec.p2 + vec.p3;
  if (!mass) return 0.5;
  return (vec.p1 * DISTANCE_OF[1] + vec.p2 * DISTANCE_OF[2] + vec.p3 * DISTANCE_OF[3]) / mass;
}

export function dominantPerson(vec: { p1: number; p2: number; p3: number }): Person | null {
  const m = Math.max(vec.p1, vec.p2, vec.p3);
  if (m <= 0) return null;
  return (m === vec.p1 ? 1 : m === vec.p2 ? 2 : 3) as Person;
}

// ── الالتفات — seams ────────────────────────────────────────────────────────

export interface Seam {
  /** Index into the surah word stream of the word that turns the attribution. */
  at: number;
  fromWord: number;
  from: Person;
  to: Person;
  /** Signed motion along the proximity axis; negative = drawing nearer. */
  axisDelta: number;
  /** Person changed. */
  person: boolean;
  /** Number changed (2MS → 2MP) — an الالتفات in its own right. */
  number: boolean;
  gender: boolean;
  /** Tense changed across the seam (ماضٍ → مضارع). */
  tense: boolean;
  ayah: number;
}

/**
 * Walk the spine-bearing words and record every turn. Words with no spine are
 * transparent — الالتفات is measured between attributions, not between tokens.
 */
export function findSeams(words: Word[]): Seam[] {
  const spine = words.filter((w) => w.person !== null);
  const seams: Seam[] = [];
  for (let i = 1; i < spine.length; i++) {
    const a = spine[i - 1];
    const b = spine[i];
    const personChanged = a.person !== b.person;
    const numberChanged = !!a.num && !!b.num && a.num !== b.num;
    const genderChanged = !!a.gender && !!b.gender && a.gender !== b.gender;
    const tenseChanged = !!a.tense && !!b.tense && a.tense !== b.tense;
    if (!personChanged && !numberChanged && !genderChanged && !tenseChanged) continue;
    seams.push({
      at: b.idx,
      fromWord: a.idx,
      from: a.person!,
      to: b.person!,
      axisDelta: DISTANCE_OF[b.person!] - DISTANCE_OF[a.person!],
      person: personChanged,
      number: numberChanged,
      gender: genderChanged,
      tense: tenseChanged,
      ayah: b.ayah,
    });
  }
  return seams;
}

// ── contour encoding for motif mining ───────────────────────────────────────
//
//  One symbol per spine word: person digit + tense letter.
//  3p = غائب/ماضٍ, 1i = متكلم/مضارع, 2v = مخاطب/أمر, 3n = غائب/اسمي.
const TENSE_SYM: Record<string, string> = { PERF: 'p', IMPF: 'i', IMPV: 'v' };

export function contourSymbol(w: Word): string {
  return `${w.person}${w.tense ? TENSE_SYM[w.tense] : 'n'}`;
}

export function contourOf(words: Word[]): string[] {
  return words.filter((w) => w.person !== null).map(contourSymbol);
}

const SYM_AR: Record<string, string> = {
  p: 'ماضٍ', i: 'مضارع', v: 'أمر', n: 'اسمي',
};
const P_AR: Record<string, string> = { '1': 'متكلم', '2': 'مخاطب', '3': 'غائب' };

export function glossContour(pattern: string): string {
  return pattern
    .split('.')
    .map((s) => `${P_AR[s[0]] ?? s[0]}/${SYM_AR[s[1]] ?? s[1]}`)
    .join(' ← ');
}

/** The 1↔3 inversion of a contour: المتكلم and الغائب trade seats. */
export function invertContour(pattern: string): string {
  return pattern.replace(/[13]/g, (d) => (d === '1' ? '3' : '1'));
}

/** Compressed per-ayah person signature, e.g. "3312". */
export function signature(words: Word[]): string {
  const out: string[] = [];
  for (const w of words) {
    if (w.person === null) continue;
    const d = String(w.person);
    if (out[out.length - 1] !== d) out.push(d);
  }
  return out.join('');
}

export function ayahWords(words: Word[], a: Ayah): Word[] {
  return words.slice(a.from, a.to);
}
