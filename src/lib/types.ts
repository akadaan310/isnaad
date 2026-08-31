// ============================================================================
//  الأنماط الأساسية — Core corpus + engine types
//  Everything downstream (engine, API, UI) speaks these shapes.
// ============================================================================

/** الإسناد axis. 1 = المتكلم, 2 = المخاطب, 3 = الغائب. */
export type Person = 1 | 2 | 3;

/** Number on the isnād carrier. */
export type Num = 'S' | 'D' | 'P';
export type Gender = 'M' | 'F' | null;

/** الزمن الصرفي */
export type Tense = 'PERF' | 'IMPF' | 'IMPV' | null;

/**
 * The grammatical office a person-bearing segment holds.
 * Only `subject` roles constitute إسناد proper (the musnad ilayh);
 * the rest are references to a person without predicating to it.
 */
export type IsnadRole =
  | 'verb-subject' // إسناد فعلي — the verb's own person
  | 'subject-enclitic' // ضمير رفع متصل (نا في خلقنا)
  | 'detached' // ضمير منفصل (نحن، أنتم، هو)
  | 'nasikh-subject' // اسم إنّ/أنّ/لكنّ
  | 'object' // ضمير نصب (مفعول به)
  | 'possessive' // مضاف إليه (ربّهم)
  | 'prepositional' // مجرور بحرف (عليهم)
  | 'vocative'; // منادى (يا قومِ)

/** Roles that actually seat a referent in the isnād chair. */
export const SUBJECT_ROLES: IsnadRole[] = [
  'verb-subject',
  'subject-enclitic',
  'detached',
  'nasikh-subject',
];

export interface Segment {
  /** 1-based index of this segment inside its word. */
  i: number;
  /** Uthmani surface form of the segment. */
  form: string;
  /** Top-level class from the corpus: N | V | P. */
  cls: string;
  /** Primary tag (PRON, DET, CONJ, ACT_PCPL, …). */
  tag: string;
  /** All raw feature tokens, kept for the morphology drawer. */
  feats: string[];
  root?: string;
  lemma?: string;
  /** الإعراب — NOM (مرفوع), ACC (منصوب), GEN (مجرور). */
  gcase?: 'NOM' | 'ACC' | 'GEN';
  indef?: boolean;
  adj?: boolean;
  person?: Person;
  num?: Num;
  gender?: Gender;
  tense?: Tense;
  /** Verb form I–X as an integer. */
  vf?: number;
  passive?: boolean;
  mood?: string;
  role?: IsnadRole;
  /** true for a prefix/suffix clitic rather than a stem. */
  clitic?: boolean;
}

export interface Word {
  /** 0-based index within the surah's flat word stream. */
  idx: number;
  /** 1-based index within its ayah. */
  n: number;
  ayah: number;
  /** Joined Uthmani surface form. */
  text: string;
  segments: Segment[];
  /** The word's isnād spine: person of its musnad ilayh, if any. */
  person: Person | null;
  role: IsnadRole | null;
  num: Num | null;
  gender: Gender | null;
  tense: Tense;
  root?: string;
  lemma?: string;
  /** Every person-bearing segment, including non-subject references. */
  refs: { person: Person; role: IsnadRole; num: Num | null; gender: Gender | null }[];
  /** Quotation nesting depth (0 = narration frame). */
  depth: number;
  /** ألسنة الخلق — this word seats a non-human creature in the isnād chair. */
  khalq?: { root: string; label: string; category: string; speech: boolean };
}

export interface Ayah {
  n: number;
  /** Uthmani text reconstructed from the aligned morphological segments. */
  text: string;
  /** Independent Uthmani rendering (Tanzil-lineage) for the mushaf view. */
  uthmani?: string;
  /** Word indices [start, end) into Surah.words. */
  from: number;
  to: number;
  juz: number;
  /** Fraction of isnād-bearing words at each person. */
  vec: { p1: number; p2: number; p3: number };
  /** 0 = المناجاة (قرب) … 1 = الغيبة (بُعد). */
  distance: number;
  /** Compressed person contour, e.g. "3312". */
  sig: string;
  dominant: Person | null;
  /** ساعة الآية — where the āyah's own verbs place it relative to the reader. */
  clock: ClockVector;
}

/**
 * The tense-and-time profile of a span. `bridge` is high where a past
 * narrative and a live imperfect stand in the same breath — the configuration
 * that detaches a قصة from its own century and lands it on the reader's clock.
 */
export interface ClockVector {
  past: number;
  present: number;
  imperative: number;
  /** Density of lemmas that name time itself (ساعة، أجل، حين). */
  timeNouns: number;
  /** Presence of the future particles س / سوف. */
  future: number;
  /** 0–1. Past mass × present mass, normalised. */
  bridge: number;
}

export interface SurahMeta {
  id: number;
  name: string;
  transliteration: string;
  type: 'makkiyyah' | 'madaniyyah';
  ayahCount: number;
  wordCount: number;
  juzRange: [number, number];
  vec: { p1: number; p2: number; p3: number };
  distance: number;
  /**
     * How many of each discovery kind were mined here. Named apart from the
     * `discoveries` array on the wire payload so the two can never collide -
     * spreading a Surah into that payload used to silently drop these counts.
     */
  discoveryCounts: Record<string, number>;
  /** Deepest quotation nesting found. */
  maxDepth: number;
}

export interface Surah extends SurahMeta {
  ayaat: Ayah[];
  words: Word[];
}

// ── محرك الاستنباط — discovery layer ────────────────────────────────────────

export type DiscoveryKind =
  | 'istihdar' // استحضار الغائب — a referent summoned from absence into address
  | 'raj-al-jidhr' // رجع الجذر — a root returns across a voice seam
  | 'jisr-al-naba' // جسر النبأ — past narrative bridged into the living present
  | 'ribat' // رباط الملتقى — lexical stitching across a maximal isnād swing
  | 'nasikh-mirror' // تقابل النواسخ — the same particle family hosting two persons
  | 'alsinat-al-khalq' // ألسنة الخلق — creation seated in the isnād chair
  | 'tabaqat-al-isnad' // تداخل الإسناد — deep nested attribution
  | 'rusul-echo'; // تشابه ألسنة الرسل — messenger tongues in identical contour

export interface Discovery {
  id: string;
  kind: DiscoveryKind;
  surah: number;
  /** Ayah range touched, inclusive. */
  ayahFrom: number;
  ayahTo: number;
  /** Word indices [from, to] into Surah.words. */
  from: number;
  to: number;
  /** The seam word index, where the attribution actually turns. */
  seam?: number;
  /** 0–1. Comparable within a kind, roughly comparable across kinds. */
  score: number;
  /** Arabic label for the specific instance. */
  title: string;
  /** Arabic prose stating what the algorithm found — structural, not exegetical. */
  note: string;
  /** Machine-readable evidence the UI renders as chips. */
  evidence: Record<string, string | number | string[]>;
}

/** A repeated isnād contour occurring in ≥2 places (مثاني). */
export interface Motif {
  id: string;
  /** Contour symbols, e.g. "3p.3p.1i.1i". */
  pattern: string;
  /** Human-facing Arabic gloss of the contour. */
  gloss: string;
  length: number;
  occurrences: { surah: number; ayah: number; from: number; to: number }[];
  /** Distinct surahs touched. */
  spread: number;
  /** true when this pattern is the 1↔3 inversion of another mined motif. */
  mirrorOf?: string;
}

export interface TadabburNote {
  id: string;
  surah: number;
  ayah: number;
  wordIdx?: number;
  body: string;
  tags: string[];
  createdAt: string;
  /** Discovery this note was struck from, when any. */
  discoveryId?: string;
}

/** One station in the حجرة اللاتزمّن walk. */
export interface TarteelStation {
  surah: number;
  ayah: number;
  surahName: string;
  text: string;
  /** The عربي operation this station contributes. */
  operation: DiscoveryKind | 'seed';
  operationLabel: string;
  /** Why the walk stepped here from the previous station. */
  bridge: string;
  distance: number;
  vec: { p1: number; p2: number; p3: number };
}
