// ============================================================================
//  التلاوة — recitation, verse by verse.
//
//  A recording is a different kind of object from everything else in this
//  field. Every strand, vector and finding here is استنباط آلي — mechanical
//  derivation from morphological tagging. A recitation is not: it is a human
//  act by a named reciter, with its own tradition and its own authority, and
//  the interface must attribute it rather than absorb it into the engine's
//  output.
//
//  Sources are verified, not guessed. everyayah.com serves ayah-level mp3 at
//  data/{folder}/{SSS}{AAA}.mp3; every folder below returned audio/mpeg for
//  2:255 and for 114:6 before being written down.
//
//  رعد الكردي was asked for and is not here. He has no verse-by-verse audio on
//  everyayah (whole directory listing checked) and none among the 190 audio
//  editions on alquran.cloud; what exists of his is whole-sūrah files, which
//  cannot drive verse-level pacing. Left declared and disabled rather than
//  silently dropped — if a source appears, it is one line.
// ============================================================================

export type TempoId = 'tarteel' | 'tadweer' | 'hadr';

export interface Reciter {
  id: string;
  /** Arabic name, as the reciter is known. */
  name: string;
  /** Transliteration, for the record. */
  latin: string;
  /** everyayah folder, or null when no verse-by-verse source exists. */
  folder: string | null;
  /** The style of the recording itself, which is not the playback tempo. */
  style: string;
  /** Roughly how this recording sits on the tempo range, before any rate. */
  pace: TempoId;
  note?: string;
}

export const RECITERS: Reciter[] = [
  {
    id: 'husary-murattal',
    name: 'محمود خليل الحُصري',
    latin: 'Maḥmūd Khalīl al-Ḥuṣarī',
    folder: 'Husary_128kbps',
    style: 'مُرتَّل',
    pace: 'tadweer',
  },
  {
    id: 'husary-mujawwad',
    name: 'محمود خليل الحُصري',
    latin: 'Maḥmūd Khalīl al-Ḥuṣarī',
    folder: 'Husary_128kbps_Mujawwad',
    style: 'مُجوَّد',
    pace: 'tarteel',
    note: 'التجويد المُرسَل — أبطأُ مكثًا وأطولُ مدًّا',
  },
  {
    id: 'husary-muallim',
    name: 'محمود خليل الحُصري',
    latin: 'Maḥmūd Khalīl al-Ḥuṣarī',
    folder: 'Husary_Muallim_128kbps',
    style: 'مُعلِّم',
    pace: 'tarteel',
    note: 'روايةُ التعليم — يُبطئ ويفصِل ليُتَّبع',
  },
  {
    id: 'qatami',
    name: 'ناصر القطامي',
    latin: 'Nāṣir al-Qaṭāmī',
    folder: 'Nasser_Alqatami_128kbps',
    style: 'مُرتَّل',
    pace: 'tadweer',
  },
  {
    id: 'raad-al-kurdi',
    name: 'رعد الكردي',
    latin: 'Raʿd al-Kurdī',
    folder: null,
    style: 'مُرتَّل',
    pace: 'tadweer',
    note: 'لا تتوفّر له تلاوةٌ آيةً آية في المصادر المفتوحة — الموجود سُوَرٌ كاملة، ولا تصلح لضبط المنازل.',
  },
];

export const AVAILABLE_RECITERS = RECITERS.filter((r) => r.folder !== null);

/**
 * The three classical tempos. They are a property of the recitation, not of
 * this application, and the ordering is theirs: تَرْتِيل is the measured pace,
 * تَدْوِير the middle, حَدْر the swift one.
 *
 * Each drives three things at once — the audio rate, the silence between
 * āyāt, and how the journey moves. That is the integration: the recitation
 * paces the travel, rather than a player being bolted to a canvas.
 */
export interface Tempo {
  id: TempoId;
  name: string;
  latin: string;
  gloss: string;
  /** Playback rate. Pitch is preserved, so this changes pace and not voice. */
  rate: number;
  /** Seconds of silence held after an āyah ends. */
  gap: number;
  /** Multiplier on travel speed between āyāt. */
  travel: number;
  /** Whether the journey continues on its own when an āyah finishes. */
  autoAdvance: boolean;
  hue: string;
}

export const TEMPOS: Tempo[] = [
  {
    id: 'tarteel',
    name: 'تَرْتِيل',
    latin: 'Tartīl',
    gloss: 'مُكْثٌ عند الآية — تَقِفُ الرحلةُ وتُصغي',
    rate: 0.94,
    gap: 3.2,
    travel: 0.45,
    autoAdvance: true,
    hue: '#C8A45C',
  },
  {
    id: 'tadweer',
    name: 'تَدْوِير',
    latin: 'Tadwīr',
    gloss: 'الوسَطُ — تمضي الرحلةُ ولا تتعجّل',
    rate: 1,
    gap: 1.1,
    travel: 1,
    autoAdvance: true,
    hue: '#E8C877',
  },
  {
    id: 'hadr',
    name: 'حَدْر',
    latin: 'Ḥadr',
    gloss: 'اتّصالٌ لا ينقطع — اتّكئ ودَعِ الكونَ يمضي',
    rate: 1.12,
    gap: 0.18,
    travel: 1.85,
    autoAdvance: true,
    hue: '#F0D9A0',
  },
];

export const TEMPO_BY_ID = new Map(TEMPOS.map((t) => [t.id, t]));

const EVERYAYAH = 'https://everyayah.com/data';
const pad3 = (n: number) => String(n).padStart(3, '0');

/** The verse-by-verse file for one āyah, or null if the reciter has none. */
export function ayahAudioUrl(reciter: Reciter, surah: number, ayah: number): string | null {
  if (!reciter.folder) return null;
  return `${EVERYAYAH}/${reciter.folder}/${pad3(surah)}${pad3(ayah)}.mp3`;
}
