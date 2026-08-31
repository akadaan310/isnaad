// ============================================================================
//  المعاجم — closed lexicons the detectors reason over.
//  Keyed on the corpus LEMMA (normalised in this fork), because many entities
//  share a root with unrelated words: نار and نور both sit under ROOT:نور.
// ============================================================================

export type KhalqCategory = 'سماوي' | 'أرضي' | 'حيّ' | 'جسدي' | 'ناري' | 'غير إنسي';

export interface KhalqEntry {
  label: string;
  category: KhalqCategory;
}

/** ألسنة الخلق — creation that the Qur'an seats in the isnād chair. */
export const KHALQ_LEMMAS: Record<string, KhalqEntry> = {
  // ── سماوي ──
  'سَماء': { label: 'السماء', category: 'سماوي' },
  'شَمْس': { label: 'الشمس', category: 'سماوي' },
  'قَمَر': { label: 'القمر', category: 'سماوي' },
  'نَجْم': { label: 'النجم', category: 'سماوي' },
  'كَوْكَب': { label: 'الكوكب', category: 'سماوي' },
  'بُرْج': { label: 'البروج', category: 'سماوي' },
  'فَلَك': { label: 'الفلك', category: 'سماوي' },
  'سَحاب': { label: 'السحاب', category: 'سماوي' },
  'رَعْد': { label: 'الرعد', category: 'سماوي' },
  'بَرْق': { label: 'البرق', category: 'سماوي' },
  'صاعِقَة': { label: 'الصاعقة', category: 'سماوي' },
  'رِيح': { label: 'الريح', category: 'سماوي' },
  'ظِلّ': { label: 'الظل', category: 'سماوي' },
  'لَيْل': { label: 'الليل', category: 'سماوي' },
  'نَهار': { label: 'النهار', category: 'سماوي' },
  'فَجْر': { label: 'الفجر', category: 'سماوي' },
  'ضُحَى': { label: 'الضحى', category: 'سماوي' },
  'دُخان': { label: 'الدخان', category: 'سماوي' },
  'مَطَر': { label: 'المطر', category: 'سماوي' },
  // ── أرضي ──
  'أَرْض': { label: 'الأرض', category: 'أرضي' },
  'جَبَل': { label: 'الجبال', category: 'أرضي' },
  'بَحْر': { label: 'البحر', category: 'أرضي' },
  'نَهَر': { label: 'النهر', category: 'أرضي' },
  'عَيْن': { label: 'العين', category: 'أرضي' },
  'ماء': { label: 'الماء', category: 'أرضي' },
  'حَجَر': { label: 'الحجارة', category: 'أرضي' },
  'صَخْرَة': { label: 'الصخرة', category: 'أرضي' },
  'طِين': { label: 'الطين', category: 'أرضي' },
  'شَجَرَة': { label: 'الشجرة', category: 'أرضي' },
  'نَخْل': { label: 'النخل', category: 'أرضي' },
  'وَرَقَة': { label: 'الورقة', category: 'أرضي' },
  'حَبّ': { label: 'الحبّ', category: 'أرضي' },
  'ثَمَرَة': { label: 'الثمرة', category: 'أرضي' },
  // ── حيّ ──
  'دابَّة': { label: 'الدابّة', category: 'حيّ' },
  'طَيْر': { label: 'الطير', category: 'حيّ' },
  'نَمْلَة': { label: 'النملة', category: 'حيّ' },
  'نَحْل': { label: 'النحل', category: 'حيّ' },
  'عَنكَبُوت': { label: 'العنكبوت', category: 'حيّ' },
  'بَقَرَة': { label: 'البقرة', category: 'حيّ' },
  'هُدْهُد': { label: 'الهدهد', category: 'حيّ' },
  'حُوت': { label: 'الحوت', category: 'حيّ' },
  'كَلْب': { label: 'الكلب', category: 'حيّ' },
  'غُراب': { label: 'الغراب', category: 'حيّ' },
  'أَنْعام': { label: 'الأنعام', category: 'حيّ' },
  'فِيل': { label: 'الفيل', category: 'حيّ' },
  // ── جسدي — the witnessing limbs ──
  'جِلْد': { label: 'الجلود', category: 'جسدي' },
  'يَد': { label: 'الأيدي', category: 'جسدي' },
  'رِجْل': { label: 'الأرجل', category: 'جسدي' },
  'لِسان': { label: 'الألسنة', category: 'جسدي' },
  'سَمْع': { label: 'السمع', category: 'جسدي' },
  'بَصَر': { label: 'البصر', category: 'جسدي' },
  'قَلْب': { label: 'القلب', category: 'جسدي' },
  // ── ناري ──
  'نار': { label: 'النار', category: 'ناري' },
  'جَهَنَّم': { label: 'جهنم', category: 'ناري' },
  // ── غير إنسي ──
  'مَلَك': { label: 'الملائكة', category: 'غير إنسي' },
  'جِنّ': { label: 'الجنّ', category: 'غير إنسي' },
  'شَيْطان': { label: 'الشيطان', category: 'غير إنسي' },
  'إِبْلِيس': { label: 'إبليس', category: 'غير إنسي' },
  'رُوح': { label: 'الروح', category: 'غير إنسي' },
};

/**
 * Roots that predicate an *act* to their subject — speech, praise, witness,
 * submission, refusal, motion. When one of these takes a خلق subject, that
 * creature is not being described; it is doing something.
 */
export const AGENCY_ROOTS = new Set([
  'قول', 'نطق', 'شهد', 'سبح', 'حمد', 'دعو', 'ندي', 'أبي', 'شفق', 'طوع', 'أتي',
  'حدث', 'لفظ', 'بكي', 'شقق', 'سجد', 'خشع', 'صدع', 'رجف', 'خرر', 'دكك', 'نسف',
  'سير', 'كور', 'فطر', 'نثر', 'فجر', 'بعثر', 'زلزل', 'خرج', 'همس', 'جري',
  'حمل', 'علم', 'عقل', 'ذكر', 'ملأ', 'فور', 'غيض', 'بلع', 'قلع', 'سخر',
]);

/** أنباء الرسل — messenger names as they lemmatise in the corpus. */
export const RUSUL_LEMMAS: Record<string, string> = {
  'آدَم': 'آدم', 'نُوح': 'نوح', 'هُود': 'هود', 'صالِح': 'صالح',
  'إِبْراهِيم': 'إبراهيم', 'لُوط': 'لوط', 'إِسْماعِيل': 'إسماعيل',
  'إِسْحاق': 'إسحاق', 'يَعْقُوب': 'يعقوب', 'يُوسُف': 'يوسف',
  'شُعَيْب': 'شعيب', 'مُوسَى': 'موسى', 'هارُون': 'هارون',
  'داوُد': 'داود', 'سُلَيْمان': 'سليمان', 'أَيُّوب': 'أيوب',
  'يُونُس': 'يونس', 'زَكَرِيّا': 'زكريا', 'يَحْيَى': 'يحيى',
  'عِيسَى': 'عيسى', 'إِلْياس': 'إلياس', 'اليَسَع': 'اليسع',
  'إِدْرِيس': 'إدريس', 'ذُو الكِفْل': 'ذو الكفل', 'مُحَمَّد': 'محمد',
  'أَحْمَد': 'أحمد',
};

/** Antagonists and nations — the other pole of the قصص. */
export const QASAS_ACTORS: Record<string, string> = {
  'فِرْعَوْن': 'فرعون', 'هامان': 'هامان', 'قارُون': 'قارون',
  'عاد': 'عاد', 'ثَمُود': 'ثمود', 'مَدْيَن': 'مدين',
  'إِسْرائِيل': 'بنو إسرائيل', 'مَرْيَم': 'مريم',
};

/**
 * Lemmas that name time itself. Density of these is what lets a قصة declare
 * its own clock — and what makes a shift into the imperfect land as *now*.
 */
export const ZAMAN_LEMMAS = new Set([
  'ساعَة', 'يَوْم', 'أَجَل', 'حِين', 'أَمَد', 'دَهْر', 'عَصْر', 'قَرْن',
  'أَبَد', 'غَد', 'الآن', 'سَنَة', 'شَهْر', 'مِيقات', 'وَقْت', 'لَيْلَة',
  'صَباح', 'مَساء', 'أَمْس', 'قَبْل', 'بَعْد',
]);

/** لبث — the verb Al-Kahf uses to suspend and then audit elapsed time. */
export const LABTH_ROOTS = new Set(['لبث', 'مكث', 'خلد', 'أبد', 'دوم']);

export function khalqOf(lemma?: string): KhalqEntry | undefined {
  return lemma ? KHALQ_LEMMAS[lemma] : undefined;
}
