// ============================================================================
//  Client-side view model: the vocabulary the panes share.
//  Colour is meaning here, so it is defined once and read everywhere.
// ============================================================================
import type { DiscoveryKind, Person } from './types';

export interface PersonStyle {
  label: string;
  short: string;
  hex: string;
  soft: string;
  /** Applied to the word itself in the reader. */
  text: string;
  underline: string;
  bg: string;
  border: string;
  gloss: string;
}

export const PERSON_STYLE: Record<Person, PersonStyle> = {
  1: {
    label: 'المتكلم',
    short: 'متكلم',
    hex: '#D97706',
    soft: '#FCD34D',
    text: 'text-mutakallim-soft',
    underline: 'decoration-mutakallim',
    bg: 'bg-mutakallim/12',
    border: 'border-mutakallim/40',
    gloss: 'محور الحضور — المتكلم يشهد فعله بنفسه',
  },
  2: {
    label: 'المخاطب',
    short: 'مخاطب',
    hex: '#059669',
    soft: '#6EE7B7',
    text: 'text-mukhatab-soft',
    underline: 'decoration-mukhatab',
    bg: 'bg-mukhatab/12',
    border: 'border-mukhatab/40',
    gloss: 'مرآة المخاطبة — أقرب ما يقف عليه الكلام',
  },
  3: {
    label: 'الغائب',
    short: 'غائب',
    hex: '#0284C7',
    soft: '#7DD3FC',
    text: 'text-ghaib-soft',
    underline: 'decoration-ghaib',
    bg: 'bg-ghaib/12',
    border: 'border-ghaib/40',
    gloss: 'لوح الغيبة — الواقع مسرودًا بلا حاضرٍ في المجلس',
  },
};

export const KHALQ_HEX = '#C084FC';
export const GOLD_HEX = '#C8A45C';

export const DISCOVERY_STYLE: Record<
  DiscoveryKind,
  { label: string; short: string; hint: string; hex: string; tone: string }
> = {
  istihdar: {
    label: 'استحضار الغائب',
    short: 'استحضار',
    hint: 'يُذكر الغائبُ ثم ينعطف اللسان إلى الخطاب المباشر، فيُستحضَر إلى المجلس',
    hex: '#F59E0B',
    tone: 'mutakallim',
  },
  'raj-al-jidhr': {
    label: 'رجع الجذر',
    short: 'رجع الجذر',
    hint: 'جذرٌ يُنسب إليهم وهم غُيَّب، ثم يعود من إطار إسنادٍ آخر — كأنّه إقرارٌ على ألسنتهم',
    hex: '#34D399',
    tone: 'mukhatab',
  },
  'jisr-al-naba': {
    label: 'جسر النبأ',
    short: 'جسر النبأ',
    hint: 'سردٌ ماضٍ غائب ينتقل إلى المتكلم بالمضارع، فيقع الخبر في زمن القارئ',
    hex: '#C8A45C',
    tone: 'gold',
  },
  ribat: {
    label: 'رِباط الملتقى',
    short: 'الرباط',
    hint: 'اللفظ ثابتٌ والإسناد متحرّك — أكبر حركةٍ نحوية على أثبت مادّةٍ لفظية',
    hex: '#E879F9',
    tone: 'khalq',
  },
  'nasikh-mirror': {
    label: 'تقابل النواسخ',
    short: 'تقابل',
    hint: 'ناسخٌ واحد يحمل إسنادين مختلفين على ضفّتي الملتقى',
    hex: '#60A5FA',
    tone: 'ghaib',
  },
  'alsinat-al-khalq': {
    label: 'ألسنة الخلق',
    short: 'الخلق',
    hint: 'غيرُ الإنسيّ — سماءٌ وأرضٌ وجبالٌ وجلودٌ ونملة — في مقعد الإسناد إليه',
    hex: '#C084FC',
    tone: 'khalq',
  },
  'tabaqat-al-isnad': {
    label: 'تداخل الإسناد',
    short: 'التداخل',
    hint: 'قولٌ محكيٌّ في جوف قولٍ محكيّ، وطبقاتُ القائلين تتراكب',
    hex: '#94A3B8',
    tone: 'neutral',
  },
  'rusul-echo': {
    label: 'ألسنة الرسل',
    short: 'الرسل',
    hint: 'خطاب رسولٍ لقومه، وكنتور الإسناد الذي يجري عليه لسانه',
    hex: '#2DD4BF',
    tone: 'mukhatab',
  },
};

/** The three stations on the proximity axis, near to far. */
export const PROXIMITY_MODES = [
  {
    id: 'munajah' as const,
    label: 'المناجاة',
    sub: 'خطابٌ مباشر',
    range: [0, 0.34] as [number, number],
    hex: '#059669',
    gloss: 'حيث يقف الكلام على المخاطب وجهًا لوجه',
  },
  {
    id: 'muayanah' as const,
    label: 'المعاينة',
    sub: 'فعلُ المتكلم',
    range: [0.34, 0.67] as [number, number],
    hex: '#D97706',
    gloss: 'حيث يُسند الفعل إلى المتكلم فيَحضُر شاهدًا عليه',
  },
  {
    id: 'ghaybah' as const,
    label: 'الغيبة',
    sub: 'بناءُ الواقع',
    range: [0.67, 1] as [number, number],
    hex: '#0284C7',
    gloss: 'حيث يُسرد الواقعُ ولا أحدَ حاضرٌ في الخطاب',
  },
];

export const ROLE_TONE: Record<string, 'subject' | 'reference'> = {
  'verb-subject': 'subject',
  'subject-enclitic': 'subject',
  detached: 'subject',
  'nasikh-subject': 'subject',
  object: 'reference',
  possessive: 'reference',
  prepositional: 'reference',
  vocative: 'reference',
};

export function personHex(p: Person | null): string {
  return p ? PERSON_STYLE[p].hex : '#475569';
}
