// ============================================================================
//  الأعلام — the high-level Qur'anic constructs a composition is built around.
//
//  Each marker is one declaration. A marker is not a keyword search: it can
//  require a lemma in a particular case, a run of consecutive stems, two roots
//  co-occurring inside one āyah, or a hand-named set of loci. That precision is
//  the point — قَآئِلٌ مِّنْهُمْ occurs exactly three times in the muṣḥaf, and a
//  loose search for قائل returns six, three of which are a different root.
//
//  To add a marker, add a spec. Nothing else needs to change.
// ============================================================================

export type AlamFamily =
  | 'كتاب' | 'أنباء' | 'أمثال' | 'فلك' | 'فرقان' | 'سبيل' | 'كيد' | 'كهف';

export interface AlamMatch {
  /** Any stem carrying one of these lemmas. */
  lemmas?: string[];
  /** Any stem carrying one of these roots. */
  roots?: string[];
  /**
   * A run of consecutive words. Each position lists the lemmas acceptable
   * there, so سَبِيلَ ٱلرُّشْدِ and سَبِيلَ ٱلرَّشَادِ are one marker rather than two.
   */
  phrase?: string[][];
  /** Restrict to a grammatical case. */
  gcase?: 'NOM' | 'ACC' | 'GEN';
  indef?: boolean;
  /** Every one of these roots must also occur somewhere in the same āyah. */
  coRoots?: string[];
  /** Hand-named loci, for constructs no morphological pattern can reach. */
  loci?: [number, number][];
  /** Roots that disqualify a hit even when the lemma matches. */
  excludeRoots?: string[];
  /** Restrict to a word class: N is what separates فَتًى from تَسْتَفْتِ. */
  cls?: 'N' | 'V' | 'P';
}

export interface AlamSpec {
  id: string;
  label: string;
  gloss: string;
  family: AlamFamily;
  hue: string;
  match: AlamMatch;
  /**
   * Loci the composer should reach from this marker without claiming they are
   * occurrences of it. Kept separate from `match.loci` so a curated association
   * is never mistaken for something the morphology found.
   */
  associated?: { locus: [number, number]; why: string }[];
}

export const AALAM: AlamSpec[] = [
  // ── الكتاب وما نزل به ────────────────────────────────────────────────────
  {
    id: 'arabi',
    label: 'عَرَبِيّ',
    gloss: 'قرآنًا عربيًّا، ولسانًا عربيًّا مبينًا، وحُكمًا عربيًّا — وصفُ اللسان الذي نزل به',
    family: 'كتاب',
    hue: '#D97706',
    match: { lemmas: ['عَرَبِيّ'] },
  },
  {
    id: 'kitab',
    label: 'الكِتاب',
    gloss: 'الكتاب في كل مواقعه — منزَّلًا ومكتوبًا ومحفوظًا ومسؤولًا عنه',
    family: 'كتاب',
    hue: '#E8D7A8',
    match: { lemmas: ['كِتاب'] },
  },
  {
    id: 'tawrat',
    label: 'التَّوْراة',
    gloss: 'التوراة حيث ذُكرت بلفظها',
    family: 'كتاب',
    hue: '#C8A45C',
    match: { lemmas: ['تَوْراة'] },
    associated: [
      { locus: [62, 5], why: 'مَثَلُ ٱلَّذِينَ حُمِّلُوا۟ ٱلتَّوْرَىٰةَ — التوراة محمولةً، ومَثَلٌ مضروبٌ لحامليها' },
      { locus: [20, 55], why: 'وَنُخْرِجُكُمْ مِنْهَا تَارَةً أُخْرَىٰ — «تارة» في مقابلة الحمل والإخراج' },
      { locus: [17, 69], why: 'أَوْ يُعِيدَكُمْ فِيهِ تَارَةً أُخْرَىٰ — التارة الأخرى في سياق الفُلك والريح' },
      { locus: [18, 62], why: 'لَقَدْ لَقِينَا مِن سَفَرِنَا هَٰذَا نَصَبًا — السفر والنَّصَب عند مجمع البحرين' },
    ],
  },
  {
    id: 'quran-form',
    label: 'قُرْءانًا',
    gloss: 'القرآن حين يرِد منكَّرًا منصوبًا — صيغةُ «قرآنًا» لا «القرآن»، كما وردت في: ولو أنَّ قرآنًا سُيِّرت به الجبال',
    family: 'كتاب',
    hue: '#FCD34D',
    match: { lemmas: ['قُرْءان'], indef: true },
  },

  // ── الأنباء ──────────────────────────────────────────────────────────────
  {
    id: 'anba-al-rusul',
    label: 'أنباء الرُّسل',
    gloss: 'النبأ حين يُضاف إلى الرسل أو يقترن بهم في الآية نفسها',
    family: 'أنباء',
    hue: '#2DD4BF',
    match: { lemmas: ['نَبَأ'], coRoots: ['رسل'] },
  },
  {
    id: 'anba-al-ghayb',
    label: 'أنباء الغيب',
    gloss: 'النبأ مقترنًا بالغيب — تِلْكَ مِنْ أَنۢبَآءِ ٱلْغَيْبِ نُوحِيهَآ إِلَيْكَ',
    family: 'أنباء',
    hue: '#0284C7',
    match: { lemmas: ['نَبَأ'], coRoots: ['غيب'] },
  },
  {
    id: 'ghayb',
    label: 'الغَيْب',
    gloss: 'الغيب حيث ورد — مفاتحه، والإيمان به، والاطّلاع عليه',
    family: 'أنباء',
    hue: '#7DD3FC',
    match: { lemmas: ['غَيْب'] },
  },

  // ── الأمثال ──────────────────────────────────────────────────────────────
  {
    id: 'kull-mathal',
    label: 'كُلّ مَثَل',
    gloss: 'مِن كُلِّ مَثَلٍ — حيث يُصرَّف المثلُ للناس في القرآن على كل وجه',
    family: 'أمثال',
    hue: '#E879F9',
    // A phrase, not a co-occurrence: 7:146 carries سَبِيل four times and رُشْد
    // once, and asking only that both appear in the āyah would report all four.
    match: { phrase: [['كُلّ'], ['مَثَل']] },
  },
  {
    id: 'mathal',
    label: 'المَثَل',
    gloss: 'المثل المضروب حيثما ورد',
    family: 'أمثال',
    hue: '#C084FC',
    match: { lemmas: ['مَثَل'] },
  },

  // ── الفُلك والفَلَك ──────────────────────────────────────────────────────
  {
    id: 'fulk-safina',
    label: 'الفُلْك',
    gloss: 'الفُلك الجارية في البحر — تحمِل، وتجري بأمرٍ، وتُنجي',
    family: 'فلك',
    hue: '#38BDF8',
    match: { lemmas: ['فُلْك'] },
  },
  {
    id: 'falak-madar',
    label: 'فَلَك',
    gloss: 'كُلٌّ فِى فَلَكٍ يَسْبَحُونَ — الفَلَك المدار، ولا يقع في المصحف إلا في موضعين',
    family: 'فلك',
    hue: '#818CF8',
    match: { lemmas: ['فَلَك'] },
  },
  {
    id: 'fulk-mashhun',
    label: 'الفُلْك المَشْحُون',
    gloss: 'الفُلك المشحون في مواقعه الثلاثة — ومنها موضعٌ يليه التقامُ الحوت',
    family: 'فلك',
    hue: '#0EA5E9',
    match: { lemmas: ['مَشْحُون'] },
  },
  {
    id: 'hut',
    label: 'الحُوت',
    gloss: 'الحوت — عند مجمع البحرين، وفي بطنه، وحين نُبِذ بالعراء',
    family: 'فلك',
    hue: '#22D3EE',
    match: { lemmas: ['حُوت'] },
  },

  // ── الفرقان ومواقعه ──────────────────────────────────────────────────────
  {
    id: 'furqan',
    label: 'الفُرْقان',
    gloss: 'الفرقان في مواضعه كلِّها — منزَّلًا، ويوم الفرقان، وما أُوتيه موسى وهارون',
    family: 'فرقان',
    hue: '#C8A45C',
    match: { lemmas: ['فُرْقان'] },
  },
  {
    id: 'buruj',
    label: 'البُرُوج',
    gloss: 'وَجَعَلَ فِى ٱلسَّمَآءِ بُرُوجًا — البروج في مواقعها الأربعة',
    family: 'فرقان',
    hue: '#FBBF24',
    match: { lemmas: ['بُرُوج'] },
  },
  {
    id: 'mawaqi-al-nujum',
    label: 'مواقع النجوم',
    gloss: 'فَلَآ أُقْسِمُ بِمَوَٰقِعِ ٱلنُّجُومِ — القسَم بالمواقع، وجوابه: إِنَّهُۥ لَقُرْءَانٌ كَرِيمٌ',
    family: 'فرقان',
    hue: '#FDE68A',
    match: { lemmas: ['مَواقِع'] },
  },
  {
    id: 'nujum',
    label: 'النُّجُوم',
    gloss: 'النجم والنجوم — هاديةً، ومسخَّرةً، وساجدة',
    family: 'فرقان',
    hue: '#A5B4FC',
    match: { lemmas: ['نَجْم'] },
  },

  // ── السبيل ───────────────────────────────────────────────────────────────
  {
    id: 'sabil-al-rushd',
    label: 'سبيل الرُّشد',
    gloss: 'سَبِيلَ ٱلرُّشْدِ وسَبِيلَ ٱلْغَىِّ — السبيل مقترنًا بالرشد',
    family: 'سبيل',
    hue: '#34D399',
    match: { phrase: [['سَبِيل'], ['رُشْد', 'رَشاد']] },
  },
  {
    id: 'rushd',
    label: 'الرُّشْد',
    gloss: 'الرشد والرشاد حيث وردا',
    family: 'سبيل',
    hue: '#6EE7B7',
    match: { roots: ['رشد'] },
  },

  // ── الكيد ومن قال ────────────────────────────────────────────────────────
  {
    id: 'qail-minhum',
    label: 'قائلٌ منهم',
    gloss: 'قَالَ قَآئِلٌ مِّنْهُمْ — صوتٌ لا يُسمَّى يخرج من داخل الجماعة فيُحوِّل الخبر. ثلاثة مواضع لا رابع لها',
    family: 'كيد',
    hue: '#F472B6',
    match: { phrase: [['قائِل'], ['مِن']], gcase: 'NOM', indef: true, excludeRoots: ['قيل'] },
  },
  {
    id: 'kayd',
    label: 'الكَيْد',
    gloss: 'الكيد — كيدُهم وكيدُنا، ومنه: إِنَّهُمْ يَكِيدُونَ كَيْدًا ۝ وَأَكِيدُ كَيْدًا',
    family: 'كيد',
    hue: '#FB7185',
    match: { roots: ['كيد'] },
  },
  // ── الكهف: the plates of the استعاذة ─────────────────────────────────────
  {
    id: 'fata',
    label: 'الفَتَى والفِتْيَة',
    gloss: 'الفتى والفتية اسمًا — ثمانيةُ مواضع، أربعةٌ منها في الكهف وحدها. ومنها فتًى يُقال له إبراهيم، وفتى موسى الذي لم يُسمَّ.',
    family: 'كهف',
    hue: '#FCD34D',
    match: { roots: ['فتي'], cls: 'N' },
  },
  {
    id: 'sakhra',
    label: 'الصَّخْرَة',
    gloss: 'ثلاثةُ مواضع لا رابعَ لها: الصخرةُ عند مجمع البحرين، وصخرةٌ في السماوات أو في الأرض، والذين جابوا الصخرَ بالوادِ.',
    family: 'كهف',
    hue: '#94A3B8',
    match: { roots: ['صخر'] },
  },
  {
    id: 'safar',
    label: 'السَّفَر والأسفار',
    gloss: 'سَفَرِنا هذا، وحمارٌ يحمل أسفارًا، وباعِدْ بين أسفارنا، وبأيدي سَفَرَةٍ كرامٍ بررة — مادّةٌ واحدة تحمل الرحلةَ والكتبَ والكَتَبة.',
    family: 'كهف',
    hue: '#C8A45C',
    match: { lemmas: ['سَفَر', 'أَسْفار', 'سَفَرَة'] },
  },
  {
    id: 'ghad',
    label: 'الغَد والغَداء',
    gloss: 'ولا تقولنّ لشيءٍ إنّي فاعلٌ ذلك غدًا، وآتِنا غداءنا، وبالغَداةِ والعشيّ — ثلاثةُ مواضع من المادّة في الكهف وحدها.',
    family: 'كهف',
    hue: '#FDE68A',
    match: { lemmas: ['غَد', 'غَداء', 'غَدَوٰة'] },
  },
  {
    id: 'athar',
    label: 'الأَثَر',
    gloss: 'وفي طه موضعان متقابلان: «هم أولاءِ على أثري» يقولها موسى، و«قبضتُ قبضةً من أثر الرسول» يقولها السامري.',
    family: 'كهف',
    hue: '#F472B6',
    match: { lemmas: ['أَثَر'] },
  },
  {
    id: 'mia-alf',
    label: 'مِائَةُ أَلْف',
    gloss: 'وأرسلناه إلى مائةِ ألفٍ أو يزيدون — والعددُ نفسه يُسائَل عنه الزمنُ في الكهف: ثلاثَ مائةٍ سنين، وفي البقرة: مائةَ عام.',
    family: 'كهف',
    hue: '#22D3EE',
    match: { phrase: [['مِائَة'], ['أَلْف']] },
  },
  {
    id: 'ratq',
    label: 'الرَّتْق والفَتْق',
    gloss: 'أنّ السماواتِ والأرضَ كانتا رتقًا ففتقناهما — موضعٌ واحد، وفيه اللفظان معًا.',
    family: 'كهف',
    hue: '#818CF8',
    match: { roots: ['رتق'] },
  },
  {
    id: 'najm-shajar',
    label: 'النَّجْم والشَّجَر',
    gloss: 'والنجمُ والشجرُ يسجدان — الإسنادُ فيه إلى مثنّى، والساجدُ نجمٌ وشجر.',
    family: 'كهف',
    hue: '#6EE7B7',
    match: { phrase: [['نَجْم'], ['شَجَر']] },
  },
  {
    id: 'hibal',
    label: 'الحِبَال',
    gloss: 'حبالُهم وعِصيُّهم يُخيَّل إليه من سحرهم أنّها تسعى — والحبلُ أيضًا: ونحن أقربُ إليه من حبل الوريد.',
    family: 'كهف',
    hue: '#E879F9',
    match: { lemmas: ['حَبْل'] },
  },
  {
    id: 'dar-al-qarar',
    label: 'دارُ القَرار',
    gloss: 'وإنّ الآخرةَ هي دارُ القرار — والقرارُ مادّةٌ تتردّد: قرارٍ مكين، ومستقَرٍّ، وذاتِ قرارٍ ومَعين.',
    family: 'كهف',
    hue: '#34D399',
    match: { phrase: [['دار'], ['قَرار']] },
  },
  {
    id: 'lisan-sidq',
    label: 'لِسانُ صِدْق',
    gloss: 'واجعل لي لسانَ صدقٍ في الآخِرين — يقولها إبراهيم، ووُهِبَت لإسحاق ويعقوب.',
    family: 'كهف',
    hue: '#D97706',
    match: { phrase: [['لِسان'], ['صِدْق']] },
  },
];

export const AALAM_BY_ID = new Map(AALAM.map((a) => [a.id, a]));

export const FAMILY_LABEL: Record<AlamFamily, string> = {
  كتاب: 'الكتاب واللسان',
  أنباء: 'الأنباء',
  أمثال: 'الأمثال',
  فلك: 'الفُلك والفَلَك',
  فرقان: 'الفرقان ومواقعه',
  سبيل: 'السبيل',
  كيد: 'الكيد والقائل',
  كهف: 'الكهف — مقام الزمن',
};

/** One occurrence of a marker. */
export interface AlamHit {
  surah: number;
  ayah: number;
  /** Word index within its sūrah. */
  word: number;
  /** The surface form that matched. */
  form: string;
}

export interface AlamIndexEntry {
  id: string;
  hits: AlamHit[];
  /** Distinct sūrahs touched. */
  spread: number;
}

export type AlamIndex = Record<string, AlamIndexEntry>;
