// ============================================================================
//  الاستعاذة — the entry sequence into the Immersive Qur'an.
//
//  Structure, not prose. Each plate names a عَلَم and the engine resolves its
//  closed set live, so no count in this file can ever drift from the corpus:
//  the plate says "ثلاثة مواضع" only because the index returned three.
//
//  Two registers are kept strictly apart and are styled differently wherever
//  they are rendered:
//
//    evidence  what the morphology shows. Checkable. Not an opinion.
//    reading   the composer's reading of it. Marked as his, never as a finding.
//
//  That separation is the price of showing this to strangers.
// ============================================================================

export type Phase = 'tahyia' | 'khal3' | 'alwah' | 'fata-hut' | 'nujum' | 'dukhul';

export interface Plate {
  id: string;
  title: string;
  /** The عَلَم whose mined occurrences are this plate's evidence. */
  alam?: string;
  /** Extra loci to show beside the marker's own set. */
  extra?: [number, number][];
  /** Loci to feature large. */
  feature?: [number, number][];
  /** What the corpus shows. Factual, checkable. */
  evidence: string;
  /** The composer's reading. Always labelled as such in the UI. */
  reading?: string;
  /** Sort weight; lower is placed earlier in the field. */
  weight: number;
}

/**
 * The خلع check. Written to what the sources actually say: neither text names
 * him. The ḥadīth (al-Bukhārī 3124, Muslim 1747) says `نَبِيٌّ مِنَ الأَنْبِيَاءِ`,
 * and 18:60 says `فَتَاهُ`. The identification as Yūshaʿ b. Nūn is commentary.
 * Withholding the name is the point being made here, so overstating the
 * attribution would work against the plate rather than for it.
 */
export const KHAL3 = {
  question: 'مَن هو فتى موسى؟',
  hadith:
    'في الصحيحين: «غَزَا نَبِيٌّ مِنَ الأَنْبِيَاءِ… فَقَالَ لِلشَّمْسِ: إِنَّكِ مَأْمُورَةٌ وَأَنَا مَأْمُورٌ، اللَّهُمَّ احْبِسْهَا عَلَيْنَا». والحديثُ لا يُسمِّيه.',
  quran: 'وفي الكهف: ﴿وَإِذْ قَالَ مُوسَىٰ لِفَتَىٰهُ﴾. والقرآنُ لا يُسمِّيه أيضًا.',
  point:
    'النصَّان معًا يُمسِكان الاسم. الذي حُبِست له الشمس لم يُسمَّ، وفتى موسى لم يُسمَّ. وإنّما بقي الوصف: فتًى.',
  note:
    'تسميتُه يوشعَ بن نون إنّما جاءت في كلام أهل العلم لا في متن الحديث، وهو كان قائدَ بني إسرائيل لا محاربًا لهم.',
  action: 'اخلَعْ نعليك',
};

export const PLATES: Plate[] = [
  {
    id: 'rushd',
    title: 'سبيل الرُّشد',
    alam: 'rushd',
    feature: [[18, 10], [18, 24], [18, 66]],
    evidence:
      'مادّةُ «رشد» تتكرّر في الكهف وحدَها ثلاثَ مرّات: فتيةٌ يسألون رَشَدًا، ثم «وَقُلْ عَسَىٰٓ أَن يَهْدِيَنِ رَبِّى لِأَقْرَبَ مِنْ هَٰذَا رَشَدًا»، ثم موسى يسأل أن يُعلَّم «رُشْدًا».',
    reading:
      'السورةُ تُفتَح بطلب الرُّشد وتُغلَق بطلبه — والطالبُ في أوّلها فتية، وفي آخرها نبيٌّ ومعه فتاه.',
    weight: 1,
  },
  {
    id: 'fata',
    title: 'الفَتَى — ولم يُسمَّ',
    alam: 'fata',
    feature: [[18, 60], [18, 62], [21, 60], [18, 10]],
    evidence:
      'الفتى والفتيةُ اسمًا لا يقعان في المصحف إلا في مواضعَ معدودة، وأربعةٌ منها في الكهف وحدها. ومنها: «سَمِعْنَا فَتًى يَذْكُرُهُمْ يُقَالُ لَهُۥٓ إِبْرَٰهِيمُ».',
    reading:
      'الفتى ليس صفةَ سنٍّ فحسب. حيثما وقع وقع عند مفصلٍ: فتيةٌ يُضرَب على آذانهم سنينَ عددًا، وفتًى يُحاجُّ قومَه بعد أن نظر في النجوم، وفتًى يرافق موسى إلى مجمع البحرين.',
    weight: 2,
  },
  {
    id: 'ghad',
    title: 'الغَد والغَداء',
    alam: 'ghad',
    feature: [[18, 23], [18, 62]],
    evidence:
      'في الكهف نفسِها: «وَلَا تَقُولَنَّ لِشَا۟ىْءٍ إِنِّى فَاعِلٌ ذَٰلِكَ غَدًا»، ثم بعدها: «ءَاتِنَا غَدَآءَنَا». المادّةُ واحدة، والموضعان في سورةٍ واحدة.',
    reading:
      'نُهِيَ عن الجزم بالغد، ثم طُلِب الغداء في الغد نفسِه. والسورةُ كلُّها تُسائل مقدارَ ما مضى.',
    weight: 3,
  },
  {
    id: 'sakhra',
    title: 'الصَّخْرَة',
    alam: 'sakhra',
    feature: [[18, 63], [89, 9], [31, 16]],
    evidence:
      'المادّةُ لا تقع في المصحف إلا في ثلاثة مواضع: الصخرةُ التي أوَيَا إليها، وصخرةٌ في السماوات أو في الأرض يأتي اللهُ بها، و«ٱلَّذِينَ جَابُوا۟ ٱلصَّخْرَ بِٱلْوَادِ».',
    reading:
      'ثلاثةُ مواضعَ لا رابعَ لها، وليس فيها موضعٌ واحد يستقيم فيه أن يكون المرادُ حجرًا عاديًّا مُلقًى.',
    weight: 4,
  },
  {
    id: 'safar',
    title: 'السَّفَر والأسفار والسَّفَرة',
    alam: 'safar',
    feature: [[18, 62], [62, 5], [80, 15], [34, 19]],
    evidence:
      'مادّةٌ واحدة تحمل: «سَفَرِنَا هَٰذَا»، و«كَمَثَلِ ٱلْحِمَارِ يَحْمِلُ أَسْفَارًۢا» في آيةِ التوراة، و«رَبَّنَا بَٰعِدْ بَيْنَ أَسْفَارِنَا» في سبأ، و«بِأَيْدِى سَفَرَةٍ كِرَامٍۭ بَرَرَةٍ» في وصف القرآن.',
    reading:
      'إذا كانت المادّةُ نفسُها تحمل الكتبَ والكَتَبة، فقولُ فتى موسى «لَقَدْ لَقِينَا مِن سَفَرِنَا هَٰذَا نَصَبًا» ليس شكوى من مشقّة طريق.',
    weight: 5,
  },
  {
    id: 'hut',
    title: 'الحُوت',
    alam: 'hut',
    feature: [[18, 61], [18, 63], [37, 142], [68, 48]],
    evidence:
      'الحوتُ في مواضعه المعدودة: نسِيَاه فاتّخذ سبيلَه في البحر سَرَبًا، والتقمه وهو مُلِيم، وصاحبُ الحوت إذ نادى وهو مكظوم. وفي الصافّات يسبقه بآيتين «ٱلْفُلْكِ ٱلْمَشْحُونِ».',
    reading:
      'الحوتُ يتّخذ سبيلًا، ويُنسى، ويلتقم، ويُنبَذ. وهو في كل موضعٍ بابُ انتقال، لا طعامًا فات.',
    weight: 6,
  },
  {
    id: 'mia-alf',
    title: 'العددُ الذي يُسائَل عنه الزمن',
    alam: 'mia-alf',
    extra: [[18, 25], [2, 259], [18, 19]],
    feature: [[37, 147], [18, 25], [2, 259]],
    evidence:
      '«وَأَرْسَلْنَٰهُ إِلَىٰ مِا۟ئَةِ أَلْفٍ أَوْ يَزِيدُونَ». والعددُ نفسه يقع حيث يُحاسَب الزمن: «ثَلَٰثَ مِا۟ئَةٍ سِنِينَ وَٱزْدَادُوا۟ تِسْعًا»، و«فَأَمَاتَهُ ٱللَّهُ مِا۟ئَةَ عَامٍ».',
    reading: 'حيث ورد هذا العدد ورد معه سؤالٌ عن مقدارٍ لا يعلمه الذين فيه.',
    weight: 7,
  },
  {
    id: 'athar',
    title: 'الأَثَر — موضعان متقابلان',
    alam: 'athar',
    feature: [[20, 84], [20, 96]],
    evidence:
      'في طه: يقول موسى «وَهُمْ أُو۟لَآءِ عَلَىٰٓ أَثَرِى»، ويقول السامريُّ «فَقَبَضْتُ قَبْضَةً مِّنْ أَثَرِ ٱلرَّسُولِ فَنَبَذْتُهَا». اللفظُ واحد، والقائلان متقابلان.',
    reading:
      'الأثرُ يُقتفى ويُقبَض. وما بينهما مسافةُ الفتنة: «فَإِنَّا قَدْ فَتَنَّا قَوْمَكَ مِنۢ بَعْدِكَ».',
    weight: 8,
  },
  {
    id: 'qarar',
    title: 'دارُ القرار ونصيبُ الدنيا',
    alam: 'dar-al-qarar',
    extra: [[26, 84], [28, 77], [19, 50]],
    feature: [[40, 39], [26, 84], [28, 77]],
    evidence:
      '«وَإِنَّ ٱلْءَاخِرَةَ هِىَ دَارُ ٱلْقَرَارِ»، و«وَٱجْعَل لِّى لِسَانَ صِدْقٍ فِى ٱلْءَاخِرِينَ» دعوةُ إبراهيم، و«وَلَا تَنسَ نَصِيبَكَ مِنَ ٱلدُّنْيَا».',
    reading:
      'القرارُ في الآخرة، واللسانُ في الآخِرين، والنصيبُ في الدنيا لا يُنسى. ثلاثتُها في اتّجاهٍ واحد لا تتزاحم.',
    weight: 9,
  },
];

/** The final reveal, after the plates. */
export const NUJUM = {
  ayah: [55, 6] as [number, number],
  title: 'وَٱلنَّجْمُ وَٱلشَّجَرُ يَسْجُدَانِ',
  evidence:
    'الفعلُ «يَسْجُدَانِ» مسنَدٌ إلى مثنّى: نجمٌ وشجر. والإسنادُ إلى غير الإنسيّ ههنا صريحٌ لا تأويلَ فيه.',
  reading:
    'السجودُ فِعل، والفعلُ حركة. وبين النجم والشجر ما يُمسِك أحدَهما بالآخر حتى يقعا في فعلٍ واحد مثنّى.',
  hibalAlam: 'hibal',
  hibalNote:
    'ومن المادّة نفسِها في المصحف: «حِبَالُهُمْ وَعِصِيُّهُمْ يُخَيَّلُ إِلَيْهِ مِن سِحْرِهِمْ أَنَّهَا تَسْعَىٰ»، و«نَحْنُ أَقْرَبُ إِلَيْهِ مِنْ حَبْلِ ٱلْوَرِيدِ».',
};

export const PHASE_LABEL: Record<Phase, string> = {
  tahyia: 'التهيئة',
  khal3: 'الخَلْع',
  alwah: 'الألواح',
  'fata-hut': 'الفتى والحوت',
  nujum: 'مواقع النجوم',
  dukhul: 'الدخول',
};

export const PHASES: Phase[] = ['tahyia', 'khal3', 'alwah', 'fata-hut', 'nujum', 'dukhul'];

/** localStorage key. The sequence is required once, then offered. */
export const ISTIADHA_KEY = 'isnaad.istiadha.v1';
