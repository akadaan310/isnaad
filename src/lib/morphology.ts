// ============================================================================
//  قارئ الصرف — parser for the Quranic Arabic Corpus morphology (v0.4 fork)
//  Line shape:  surah:ayah:word:seg \t form \t class \t FEAT|FEAT|KEY:VAL
// ============================================================================
import type { Gender, Num, Person, Segment, Tense } from './types';

/** Person tags carry a leading digit; noun number/gender tags never do. */
const PERSON_TAG = /^([123])(M|F)?(S|P|D)?$/;
/**
 * Number and gender on a noun: MS, MP, MD, FS, FP, FD, or a bare M / F / D.
 * Deliberately does NOT match a bare `S` or `P` - in this corpus a lone `P`
 * is the tag for a preposition, not a plural marker, and reading it as number
 * would silently mis-tag every حرف جر in the muṣḥaf.
 */
const NOUN_NG = /^(M|F)(S|P|D)?$/;

export interface ParsedFeatures {
  tag: string;
  feats: string[];
  root?: string;
  lemma?: string;
  person?: Person;
  num?: Num;
  gender?: Gender;
  tense?: Tense;
  vf?: number;
  mood?: string;
  passive?: boolean;
  clitic?: boolean;
  gcase?: 'NOM' | 'ACC' | 'GEN';
  indef?: boolean;
  adj?: boolean;
}

/**
 * The first non key:value token is the segment's primary tag. Where the corpus
 * gives none (a bare verb stem) we fall back to the tense, then the class.
 */
export function parseFeatures(cls: string, raw: string): ParsedFeatures {
  const feats = raw.split('|').filter(Boolean);
  const out: ParsedFeatures = { tag: '', feats };

  for (const f of feats) {
    if (f.startsWith('ROOT:')) out.root = f.slice(5);
    else if (f.startsWith('LEM:')) out.lemma = f.slice(4);
    else if (f.startsWith('VF:')) out.vf = Number(f.slice(3)) || undefined;
    else if (f.startsWith('MOOD:')) out.mood = f.slice(5);
    else if (f.startsWith('FAM:')) continue; // particle family, read separately
    else if (f === 'PERF' || f === 'IMPF' || f === 'IMPV') out.tense = f;
    else if (f === 'NOM' || f === 'ACC' || f === 'GEN') {
      // ACC is also the tag for the نواسخ family; a particle is not declined,
      // so the case reading only applies to nouns.
      if (cls === 'N') out.gcase = f;
      else if (!out.tag) out.tag = f;
    } else if (f === 'INDEF') out.indef = true;
    else if (f === 'ADJ') out.adj = true;
    else if (f === 'PASS') out.passive = true;
    else if (f === 'PREF' || f === 'SUFF') out.clitic = true;
    else {
      const m = PERSON_TAG.exec(f);
      if (m) {
        out.person = Number(m[1]) as Person;
        out.gender = (m[2] as Gender) ?? null;
        // A dual tag may drop gender entirely ("2D"); "D" still means dual.
        out.num = (m[3] as Num) ?? (m[2] === undefined ? null : 'S');
        if (f.endsWith('D')) out.num = 'D';
      } else if (f === 'D') {
        out.num = 'D';
      } else if (NOUN_NG.test(f)) {
        const ng = NOUN_NG.exec(f)!;
        out.gender = ng[1] as Gender;
        if (ng[2]) out.num = ng[2] as Num;
      } else if (!out.tag) {
        out.tag = f;
      }
    }
  }

  if (!out.tag) out.tag = out.tense ?? cls;
  return out;
}

/** The FAM: token — the نسخ family a particle belongs to (إنّ، كان، …). */
export function particleFamily(raw: string): string | undefined {
  const m = /(?:^|\|)FAM:([^|]+)/.exec(raw);
  return m?.[1];
}

// ── معجم المصطلحات — Arabic glosses for every tag we surface ────────────────
export const TAG_AR: Record<string, string> = {
  N: 'اسم', V: 'فعل', P: 'حرف',
  PERF: 'فعل ماضٍ', IMPF: 'فعل مضارع', IMPV: 'فعل أمر',
  PRON: 'ضمير', DEM: 'اسم إشارة', REL: 'اسم موصول', PN: 'اسم علم',
  ACT_PCPL: 'اسم فاعل', PASS_PCPL: 'اسم مفعول', VN: 'مصدر', NV: 'اسم فعل',
  ADJ: 'صفة', DET: 'أداة تعريف', ATT: 'هاء التنبيه',
  DIST: 'لام البُعد', ADDR: 'كاف الخطاب',
  CONJ: 'حرف عطف', REM: 'استئنافية', SUP: 'زائدة', RES: 'أداة حصر',
  NEG: 'حرف نفي', ACC: 'حرف نصب ونسخ', EMPH: 'لام التوكيد', CERT: 'حرف تحقيق',
  SUB: 'حرف مصدري', COND: 'أداة شرط', RSLT: 'واقعة في جواب الشرط',
  T: 'ظرف زمان', LOC: 'ظرف مكان', VOC: 'حرف نداء', INTG: 'همزة استفهام',
  PRO: 'حرف نهي', PRP: 'لام التعليل', CIRC: 'واو الحال', CAUS: 'فاء السببية',
  FUT: 'حرف استقبال', PREV: 'حرف كفّ', AMD: 'أداة استدراك', ANS: 'حرف جواب',
  INC: 'لام الابتداء', INT: 'حرف تفسير', EXH: 'حرف تحضيض', SUR: 'حرف فجاءة',
  AVR: 'حرف ردع', INL: 'حروف مقطّعة', EXL: 'حرف تفصيل', EXP: 'حرف تعليل',
  RET: 'حرف إضراب', EQ: 'همزة التسوية', COM: 'واو المعية', MD: 'مثنى',
  IND: 'مرفوع', SUBJ: 'منصوب', JUS: 'مجزوم',
  NOM: 'مرفوع', GEN: 'مجرور', INDEF: 'نكرة', PASS: 'مبني للمجهول',
};

export const PERSON_AR: Record<Person, string> = { 1: 'المتكلم', 2: 'المخاطب', 3: 'الغائب' };
export const PERSON_SHORT: Record<Person, string> = { 1: 'متكلم', 2: 'مخاطب', 3: 'غائب' };
export const NUM_AR: Record<string, string> = { S: 'مفرد', D: 'مثنى', P: 'جمع' };
export const GENDER_AR: Record<string, string> = { M: 'مذكر', F: 'مؤنث' };
export const TENSE_AR: Record<string, string> = { PERF: 'ماضٍ', IMPF: 'مضارع', IMPV: 'أمر' };

export const ROLE_AR: Record<string, string> = {
  'verb-subject': 'إسناد فعلي',
  'subject-enclitic': 'ضمير رفع متصل',
  detached: 'ضمير منفصل',
  'nasikh-subject': 'اسم الناسخ',
  object: 'ضمير نصب (مفعول)',
  possessive: 'مضاف إليه',
  prepositional: 'مجرور بحرف',
  vocative: 'منادى',
};

/** Verbal form I–X in the Arabic numeral convention scholars actually use. */
export const VERB_FORM_AR = ['', 'فَعَلَ', 'فَعَّلَ', 'فَاعَلَ', 'أَفْعَلَ', 'تَفَعَّلَ', 'تَفَاعَلَ', 'انْفَعَلَ', 'افْتَعَلَ', 'افْعَلَّ', 'اسْتَفْعَلَ', 'افْعَالَّ', 'افْعَوْعَلَ'];

export function describeSegment(s: Segment): string {
  const bits: string[] = [TAG_AR[s.tag] ?? s.tag];
  if (s.adj) bits.push('صفة');
  if (s.tense) bits.push(TENSE_AR[s.tense]);
  if (s.vf && VERB_FORM_AR[s.vf]) bits.push(`وزن ${VERB_FORM_AR[s.vf]}`);
  if (s.passive) bits.push('مبني للمجهول');
  if (s.person) {
    const parts = [PERSON_AR[s.person]];
    if (s.num) parts.push(NUM_AR[s.num]);
    if (s.gender) parts.push(GENDER_AR[s.gender]);
    bits.push(parts.join(' '));
  }
  if (s.gcase) bits.push(TAG_AR[s.gcase] ?? s.gcase);
  if (s.indef) bits.push('نكرة');
  return bits.join(' · ');
}
