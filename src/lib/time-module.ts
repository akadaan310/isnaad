// ============================================================================
//  وحدة الزمن — the time modalities, and how an āyah is read for them.
//
//  Not a taxonomy imposed on the text. Every modality below is anchored to
//  particles the corpus actually tags, with the counts they actually have, so
//  the flight board is programming real material rather than a metaphor:
//
//    إِذ 309 · إِذا 383 · لَمّا 154 · قَد 406 · لَن 106 · لَم 348
//    لَو 189 · إِن 578 · لَوْلا 34 · س 119 · سَوْف 42 · أَبَدًا 28 · كُلَّما 15
//
//  The point of the module is that these are not all "time" in one sense. لَن
//  forecloses a future, لَو opens one that never was, كُلَّما refuses to happen
//  once, and أَبَدًا removes the question. A board that treated them as a single
//  axis would flatten exactly what makes them worth flying through.
// ============================================================================

export type ModalityId =
  | 'madi'      // ماضٍ — closed behind
  | 'hadir'     // حاضر — running now
  | 'mustaqbal' // مستقبل — declared ahead
  | 'amr'       // أمر — required of you now
  | 'idh'       // إذ — the pointer back
  | 'idha'      // إذا — the pointer forward
  | 'law'       // لو — the branch that did not happen
  | 'in'        // إن — the branch still open
  | 'lan'       // لن — foreclosed
  | 'abad'      // أبدًا — no horizon at all
  | 'kullama'   // كلّما — refuses to happen once
  | 'saa';      // الساعة — the hour, whose knowledge is returned

export interface Modality {
  id: ModalityId;
  label: string;
  /** Two or three words on what this modality does to time. */
  gloss: string;
  /** The FMC line abbreviation. */
  code: string;
  hue: string;
  /** Where it sits on the before↔after axis, −1 … +1. Zero is now. */
  axis: number;
  /** Detection: corpus tags, lemmas, or verb tense. */
  match: { tense?: string[]; tags?: string[]; lemmas?: string[] };
}

export const MODALITIES: Modality[] = [
  {
    id: 'madi', label: 'المَاضِي', code: 'PST', hue: '#64748B', axis: -0.7,
    gloss: 'وقع وانغلق',
    match: { tense: ['PERF'] },
  },
  {
    id: 'idh', label: 'إِذ', code: 'IDH', hue: '#94A3B8', axis: -0.9,
    gloss: 'إشارةٌ إلى وقتٍ مضى، تُستحضَر به الحال',
    match: { lemmas: ['إِذ', 'لَمّا'] },
  },
  {
    id: 'hadir', label: 'الحَاضِر', code: 'NOW', hue: '#C8A45C', axis: 0,
    gloss: 'يجري الآن، غير منقضٍ',
    match: { tense: ['IMPF'] },
  },
  {
    id: 'amr', label: 'الأَمْر', code: 'IMP', hue: '#059669', axis: 0.05,
    gloss: 'مطلوبٌ منك في هذه اللحظة',
    match: { tense: ['IMPV'] },
  },
  {
    id: 'idha', label: 'إِذَا', code: 'IDA', hue: '#38BDF8', axis: 0.6,
    gloss: 'متى وقع — وقوعُه مفروغٌ منه، ووقتُه ليس كذلك',
    match: { lemmas: ['إِذا'] },
  },
  {
    id: 'mustaqbal', label: 'المُسْتَقْبَل', code: 'FUT', hue: '#0284C7', axis: 0.8,
    gloss: 'مصرَّحٌ به أمامك',
    match: { tags: ['FUT'], lemmas: ['سَوْف', 'س'] },
  },
  {
    id: 'in', label: 'إِنْ', code: 'CND', hue: '#34D399', axis: 0.4,
    gloss: 'فرعٌ لم يُغلَق بعد',
    match: { lemmas: ['إِن'] },
  },
  {
    id: 'law', label: 'لَوْ', code: 'CTF', hue: '#E879F9', axis: -0.4,
    gloss: 'فرعٌ لم يقع، ويُعرَض مع ذلك',
    match: { lemmas: ['لَو', 'لَوْلا'] },
  },
  {
    id: 'lan', label: 'لَنْ', code: 'NVR', hue: '#FB7185', axis: 1,
    gloss: 'مستقبلٌ مُغلَق — لا يقع أصلًا',
    match: { lemmas: ['لَن'] },
  },
  {
    id: 'kullama', label: 'كُلَّمَا', code: 'ITR', hue: '#A78BFA', axis: 0.2,
    gloss: 'لا يقع مرّةً واحدة، بل كلّما',
    // Written as escapes: the corpus orders the shadda before the fatha, and
    // the visually identical string with the other order matches nothing.
    // scripts/ingest-cosmos.ts fails the build if any lemma here matches zero.
    match: { lemmas: ['\u0643\u064f\u0644\u0651\u064e\u0645\u0627'] },
  },
  {
    id: 'abad', label: 'أَبَدًا', code: 'ETR', hue: '#FCD34D', axis: 1,
    gloss: 'لا أفقَ له — يخرج من المسألة كلِّها',
    match: { lemmas: ['أَبَدًا', 'خالِد'] },
  },
  {
    id: 'saa', label: 'السَّاعَة', code: 'HUR', hue: '#F59E0B', axis: 0.95,
    gloss: 'إليه يُردّ علمُها — الوقتُ الذي لا يُعلَم',
    match: { lemmas: ['ساعَة', 'أَجَل', 'أَمَد'] },
  },
];

export const MODALITY_BY_ID = new Map(MODALITIES.map((m) => [m.id, m]));

/** Counts per modality, in MODALITIES order. */
export type TimeVector = number[];

export interface TimeSegment {
  tense?: string | null;
  tag?: string;
  lemma?: string;
}

/** Read one āyah's segments for every modality at once. */
export function timeVectorOf(segments: TimeSegment[]): TimeVector {
  const v = MODALITIES.map(() => 0);
  for (const s of segments) {
    MODALITIES.forEach((m, i) => {
      if (m.match.tense && s.tense && m.match.tense.includes(s.tense)) v[i]++;
      else if (m.match.tags && s.tag && m.match.tags.includes(s.tag)) v[i]++;
      else if (m.match.lemmas && s.lemma && m.match.lemmas.includes(s.lemma)) v[i]++;
    });
  }
  return v;
}

/**
 * Where an āyah sits on before↔after: each modality pulls toward its own axis
 * position, weighted by how many times it fires. An āyah with no time marking
 * at all sits at zero rather than being forced onto the line.
 */
export function timeAxisOf(v: TimeVector): number {
  let num = 0;
  let den = 0;
  MODALITIES.forEach((m, i) => {
    // The bare tenses are common enough to swamp the particles, so they are
    // damped: a single لَن says more about time than nine imperfect verbs.
    const weight = m.match.tense ? 0.35 : 1.6;
    num += m.axis * v[i] * weight;
    den += v[i] * weight;
  });
  return den ? num / den : 0;
}

/**
 * How much an āyah *does* with time, as opposed to merely being in it. High
 * where distinct modalities co-occur — a past that carries a counterfactual
 * that carries a foreclosed future.
 */
export function timeTensionOf(v: TimeVector): number {
  const present = v.filter((n) => n > 0).length;
  const particles = MODALITIES.reduce((n, m, i) => n + (m.match.tense ? 0 : v[i]), 0);
  return Math.min(1, (present / MODALITIES.length) * 1.6 + Math.min(particles, 6) * 0.09);
}

/** A programmed route through modalities — the FMC's legs. */
export interface TimeRoute {
  legs: ModalityId[];
}

/** Does an āyah satisfy a leg? */
export function satisfies(v: TimeVector, leg: ModalityId): boolean {
  const i = MODALITIES.findIndex((m) => m.id === leg);
  return i >= 0 && v[i] > 0;
}
