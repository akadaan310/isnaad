// ============================================================================
//  محرك الاستنباط — the detector suite.
//
//  Every detector reports a *structural* finding: a configuration that is
//  present in the morphology and can be pointed at. None of them interpret.
//  The reading belongs to the reader; the engine only insists on where to look.
// ============================================================================
import type { Ayah, Discovery, Person, Word } from '../types';
import { findSeams, type Seam, DISTANCE_OF } from '../isnad';
import { AGENCY_ROOTS, KHALQ_LEMMAS, RUSUL_LEMMAS, ZAMAN_LEMMAS, QASAS_ACTORS } from '../lexicon';
import { frameAt, type Frame } from './frames';
import { arabicNumber as ar, PERSON_NAME } from '../numerals';

export interface DetectorContext {
  surah: number;
  surahName: string;
  words: Word[];
  ayaat: Ayah[];
  frames: Frame[];
  seams: Seam[];
}

export interface DetectorOptions {
  /** Words either side of a seam considered when measuring رباط. */
  stitchWindow: number;
  /** Word span within which a root may "return". */
  echoWindow: number;
  /** Minimum 3rd-person run before a استحضار pivot counts. */
  minAbsenceRun: number;
  /** Minimum narrative run before a جسر النبأ pivot counts. */
  minNarrativeRun: number;
  /** Discoveries below this score are dropped. */
  minScore: number;
}

export const DEFAULT_OPTIONS: DetectorOptions = {
  stitchWindow: 8,
  echoWindow: 22,
  minAbsenceRun: 2,
  minNarrativeRun: 4,
  minScore: 0.28,
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function ayahOf(ctx: DetectorContext, idx: number): number {
  return ctx.words[idx]?.ayah ?? 1;
}

/** Content roots in a word span — the material a seam can be stitched with. */
function rootsIn(words: Word[], from: number, to: number): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (let i = Math.max(0, from); i <= Math.min(words.length - 1, to); i++) {
    for (const s of words[i].segments) {
      if (!s.root || s.clitic) continue;
      const arr = m.get(s.root) ?? [];
      arr.push(i);
      m.set(s.root, arr);
    }
  }
  return m;
}

/**
 * رِباط — how much lexical material the two banks of a seam hold in common.
 * Shared roots are what make an الالتفات feel deliberate rather than merely
 * adjacent: the subject matter does not move while the attribution does.
 */
function stitchBetween(
  words: Word[],
  aFrom: number,
  aTo: number,
  bFrom: number,
  bTo: number,
): { score: number; shared: string[] } {
  const before = rootsIn(words, aFrom, aTo);
  const after = rootsIn(words, bFrom, bTo);
  const shared: string[] = [];
  for (const r of before.keys()) if (after.has(r)) shared.push(r);
  const union = new Set([...before.keys(), ...after.keys()]).size || 1;
  return { score: clamp01(shared.length / Math.sqrt(union)), shared };
}

/** Fixed-window stitch, for seams with no natural span of their own. */
function stitchAcross(words: Word[], seamIdx: number, window: number) {
  return stitchBetween(words, seamIdx - window, seamIdx - 1, seamIdx, seamIdx + window);
}

/** Magnitude of the grammatical motion carried by a seam. */
function seamDelta(s: Seam): number {
  return clamp01(
    Math.abs(s.axisDelta) * 0.6 +
      (s.person ? 0.2 : 0) +
      (s.tense ? 0.15 : 0) +
      (s.number ? 0.08 : 0) +
      (s.gender ? 0.05 : 0),
  );
}

/** The نسخ family (FAM:) of any accusative particle carried by a word. */
function nasikhFamily(w: Word): string | undefined {
  const seg = w.segments.find((s) => s.tag === 'ACC');
  if (!seg) return undefined;
  const fam = seg.feats.find((f) => f.startsWith('FAM:'));
  return fam ? fam.slice(4) : seg.lemma;
}

/** Any 2nd-person reference on a word, in any office. */
function addresses(w: Word, p: Person): boolean {
  return w.refs.some((r) => r.person === p);
}

// ═══════════════════════════════════════════════════════════════════════════
//  ١ — استحضار الغائب  ·  Presence Summons
//
//  A party is spoken of in absence, and within a few words the tongue turns
//  and addresses someone directly — the referent is drawn from the third
//  person into the room. Scored highest when the pivot carries a first-person
//  self-anchor and the address lands immediately.
//  Reference instance: هود ٢٩ — إِنَّهُم مُّلَٰقُوا۟ رَبِّهِمْ ← وَلَٰكِنِّىٓ أَرَىٰكُمْ
// ═══════════════════════════════════════════════════════════════════════════
export function detectIstihdar(ctx: DetectorContext, opt: DetectorOptions): Discovery[] {
  const { words } = ctx;
  const spine = words.filter((w) => w.person !== null);
  const out: Discovery[] = [];

  for (let i = 0; i < spine.length; i++) {
    if (spine[i].person !== 3) continue;
    // Measure the run of absence ending at i.
    let run = 1;
    while (i - run >= 0 && spine[i - run].person === 3) run++;
    if (run < opt.minAbsenceRun) continue;
    // Only fire at the end of the run.
    if (i + 1 < spine.length && spine[i + 1].person === 3) continue;

    const pivot = spine[i + 1];
    if (!pivot) continue;

    // The pivot must leave absence, and address must arrive close behind it.
    const selfAnchor = pivot.person === 1;
    let addressAt = -1;
    for (let k = i + 1; k < Math.min(spine.length, i + 5); k++) {
      if (spine[k].person === 2 || addresses(spine[k], 2)) {
        addressAt = spine[k].idx;
        break;
      }
    }
    if (addressAt < 0) continue;

    const absenceStart = spine[i - run + 1].idx;
    const gap = addressAt - pivot.idx;
    // The banks of this seam are the absence run itself and the address that
    // answers it, not an arbitrary window - a long غيبة deserves a long look.
    const stitch = stitchBetween(
      words,
      absenceStart,
      pivot.idx - 1,
      pivot.idx,
      Math.max(addressAt, pivot.idx + opt.stitchWindow),
    );

    // A نسخ particle on both banks (إِنَّهُم … وَلَٰكِنِّىٓ) is the strongest
    // available evidence that the two attributions were built as a pair.
    const famBefore = nasikhFamily(spine[i]);
    const famAfter = nasikhFamily(pivot);
    const mirrored = !!famBefore && famBefore === famAfter;

    const score = clamp01(
      0.2 +
        Math.min(run, 5) * 0.07 +
        (selfAnchor ? 0.2 : 0.05) +
        Math.max(0, 0.22 - gap * 0.04) +
        (mirrored ? 0.22 : 0) +
        stitch.score * 0.25,
    );
    if (score < opt.minScore) continue;

    out.push({
      id: `${ctx.surah}:istihdar:${pivot.idx}`,
      kind: 'istihdar',
      surah: ctx.surah,
      ayahFrom: ayahOf(ctx, absenceStart),
      ayahTo: ayahOf(ctx, addressAt),
      from: absenceStart,
      to: addressAt,
      seam: pivot.idx,
      score,
      title: 'استحضار الغائب إلى الخطاب',
      note:
        `سُبِق الملتقى بـ${ar(run)} من مواضع الإسناد إلى الغائب، ثم انعطف اللسان عند «${pivot.text}»` +
        `${selfAnchor ? ' إلى المتكلم' : ''}، ` +
        (gap === 0
          ? 'ووقع الخطاب المباشر في الكلمة نفسها.'
          : `ولم يفصل بينه وبين الخطاب المباشر إلا ${ar(gap)} من الكلم.`) +
        (mirrored ? ` وقد حُمِل الطرفان على ناسخٍ واحد (${famBefore}).` : ''),
      evidence: {
        'طول الغيبة': ar(run),
        'مسافة الخطاب': ar(gap),
        'مرساة المتكلم': selfAnchor ? 'نعم' : 'لا',
        'تقابل النواسخ': mirrored ? (famBefore as string) : 'لا',
        'جذور رابطة': stitch.shared.slice(0, 6),
      },
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ٢ — رجع الجذر  ·  Root Return Across the Seam
//
//  A root is predicated of a party, and then the same root comes back out of
//  a different attribution frame — most strikingly from the mouth of the very
//  party it was predicated of.
//  Reference instance: ق ٢ — بَلْ عَجِبُوٓا۟ … فَقَالَ ٱلْكَٰفِرُونَ هَٰذَا شَىْءٌ عَجِيبٌ
// ═══════════════════════════════════════════════════════════════════════════
export function detectRootReturn(ctx: DetectorContext, opt: DetectorOptions): Discovery[] {
  const { words, frames } = ctx;
  const byRoot = new Map<string, number[]>();
  for (const w of words) {
    const stem = w.segments.find((s) => s.root && !s.clitic);
    if (!stem?.root) continue;
    const arr = byRoot.get(stem.root) ?? [];
    arr.push(w.idx);
    byRoot.set(stem.root, arr);
  }

  const out: Discovery[] = [];
  for (const [root, idxs] of byRoot) {
    for (let a = 0; a < idxs.length - 1; a++) {
      const i = idxs[a];
      const j = idxs[a + 1];
      if (j - i > opt.echoWindow) continue;

      const wi = words[i];
      const wj = words[j];
      const fi = frameAt(frames, i);
      const fj = frameAt(frames, j);

      const depthChanged = (fi?.depth ?? -1) !== (fj?.depth ?? -1);
      const enteredSpeech = !fi && !!fj;
      const voiceFlipped =
        wi.segments.some((s) => s.cls === 'V' && s.passive) !==
        wj.segments.some((s) => s.cls === 'V' && s.passive);
      const personChanged =
        wi.person !== null && wj.person !== null && wi.person !== wj.person;

      // The root must genuinely change hands; a plain repetition is not this.
      if (!depthChanged && !voiceFlipped && !personChanged) continue;

      // Coreference: does the quoted speaker match the party the root was
      // predicated of? Number and gender agreement is all the corpus affords.
      const subjRef = wi.refs.find((r) => r.role === 'verb-subject' || r.role === 'subject-enclitic');
      const corefers =
        !!fj && !!subjRef && fj.speaker.num === subjRef.num && fj.speaker.person === 3;

      const score = clamp01(
        0.18 +
          (enteredSpeech ? 0.3 : depthChanged ? 0.18 : 0) +
          (corefers ? 0.24 : 0) +
          (voiceFlipped ? 0.2 : 0) +
          (personChanged ? 0.14 : 0) +
          Math.max(0, 0.16 - (j - i) * 0.008),
      );
      if (score < opt.minScore) continue;

      const flavour = enteredSpeech
        ? corefers
          ? 'نُسِب الجذر إليهم وهم غُيَّب، ثم عاد على ألسنتهم إقرارًا في إطار القول'
          : 'خرج الجذر من إطار الحكاية إلى إطار القول'
        : voiceFlipped
          ? 'عاد الجذر وقد انقلب بناؤه من المعلوم إلى المجهول'
          : 'عاد الجذر تحت إسنادٍ آخر';

      out.push({
        id: `${ctx.surah}:rajjidhr:${i}-${j}`,
        kind: 'raj-al-jidhr',
        surah: ctx.surah,
        ayahFrom: wi.ayah,
        ayahTo: wj.ayah,
        from: i,
        to: j,
        seam: j,
        score,
        title: `رجع الجذر «${root}»`,
        note: `${flavour}: «${wi.text}» ← ${ar(j - i)} كلمة → «${wj.text}».`,
        evidence: {
          'الجذر': root,
          'المسافة': ar(j - i),
          'دخول القول': enteredSpeech ? 'نعم' : 'لا',
          'مطابقة القائل': corefers ? (fj?.speaker.label ?? 'نعم') : 'لا',
          'انقلاب البناء': voiceFlipped ? 'نعم' : 'لا',
        },
      });
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ٣ — جسر النبأ  ·  The Naba' Bridge
//
//  A sustained third-person past narrative gives way to a first-person
//  imperfect. The account stops being an account: the verb moves into the
//  reader's own tense while the subject matter carries over unbroken.
//  Reference instance: القصص ٤ ← ٥ — إِنَّ فِرْعَوْنَ عَلَا … وَنُرِيدُ أَن نَّمُنَّ
// ═══════════════════════════════════════════════════════════════════════════
export function detectNabaBridge(ctx: DetectorContext, opt: DetectorOptions): Discovery[] {
  const { words } = ctx;
  const spine = words.filter((w) => w.person !== null);
  const out: Discovery[] = [];

  for (let i = 0; i < spine.length; i++) {
    if (spine[i].person !== 3) continue;
    let run = 1;
    let perf = spine[i].tense === 'PERF' ? 1 : 0;
    while (i - run >= 0 && spine[i - run].person === 3) {
      if (spine[i - run].tense === 'PERF') perf++;
      run++;
    }
    if (run < opt.minNarrativeRun) continue;
    if (i + 1 < spine.length && spine[i + 1].person === 3) continue;
    if (perf === 0) continue;

    const pivot = spine[i + 1];
    if (!pivot || pivot.person !== 1 || pivot.tense !== 'IMPF') continue;

    // Count how far the living tense sustains itself past the pivot.
    let sustain = 0;
    for (let k = i + 1; k < Math.min(spine.length, i + 10); k++) {
      if (spine[k].person === 1 && spine[k].tense === 'IMPF') sustain++;
    }

    const start = spine[i - run + 1].idx;
    const tail = spine[Math.min(spine.length - 1, i + 6)].idx;
    // A bridge is measured bank to bank: the whole past account against the
    // whole living stretch that answers it.
    const stitch = stitchBetween(words, start, pivot.idx - 1, pivot.idx, tail);
    const score = clamp01(
      0.16 +
        Math.min(run, 10) * 0.035 +
        (perf / run) * 0.18 +
        Math.min(sustain, 5) * 0.06 +
        stitch.score * 0.28,
    );
    if (score < opt.minScore) continue;

    out.push({
      id: `${ctx.surah}:naba:${pivot.idx}`,
      kind: 'jisr-al-naba',
      surah: ctx.surah,
      ayahFrom: ayahOf(ctx, start),
      ayahTo: ayahOf(ctx, tail),
      from: start,
      to: tail,
      seam: pivot.idx,
      score,
      title: 'جسر النبأ إلى الزمن الحاضر',
      note:
        `سرد غائبٌ ماضٍ امتدّ ${ar(run)} من مواضع الإسناد (${ar(perf)} منها بالماضي)، ثم انتقل عند ` +
        `«${pivot.text}» إلى المتكلم بالمضارع، واستمرّ ${ar(sustain)} من المواضع.` +
        (stitch.shared.length
          ? ` وقد عبَر الجسرَ ${ar(stitch.shared.length)} من الجذور نفسها: ${stitch.shared.slice(0, 4).join('، ')}.`
          : ''),
      evidence: {
        'طول السرد': ar(run),
        'مواضع الماضي': ar(perf),
        'امتداد المضارع': ar(sustain),
        'جذور عابرة': stitch.shared.slice(0, 6),
      },
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ٤ — رِباط الملتقى  ·  Seam Stitching   ← the master metric
//
//  Maximum grammatical motion held against maximum lexical continuity.
//  All three of the reference instances above score highly here; this detector
//  is what generalises them to the rest of the muṣḥaf.
// ═══════════════════════════════════════════════════════════════════════════
export function detectRibat(ctx: DetectorContext, opt: DetectorOptions): Discovery[] {
  const out: Discovery[] = [];
  for (const s of ctx.seams) {
    const stitch = stitchAcross(ctx.words, s.at, opt.stitchWindow);
    if (!stitch.shared.length) continue;
    const delta = seamDelta(s);
    const score = clamp01(Math.sqrt(stitch.score * delta) * 1.15);
    if (score < opt.minScore + 0.12) continue;

    const dir = s.axisDelta < 0 ? 'اقترابًا' : s.axisDelta > 0 ? 'ابتعادًا' : 'ثباتًا في المسافة';
    out.push({
      id: `${ctx.surah}:ribat:${s.at}`,
      kind: 'ribat',
      surah: ctx.surah,
      ayahFrom: ctx.words[Math.max(0, s.at - opt.stitchWindow)].ayah,
      ayahTo: ctx.words[Math.min(ctx.words.length - 1, s.at + opt.stitchWindow)].ayah,
      from: Math.max(0, s.at - opt.stitchWindow),
      to: Math.min(ctx.words.length - 1, s.at + opt.stitchWindow),
      seam: s.at,
      score,
      title: 'رِباط الملتقى — ثبات اللفظ وحركة الإسناد',
      note:
        `تحوّل الإسناد من ${PERSON_NAME[s.from]} إلى ${PERSON_NAME[s.to]} ${dir}` +
        `${s.tense ? ' مع تغيّر الزمن' : ''}، ومع ذلك بقي ${ar(stitch.shared.length)} من الجذور ` +
        `مشتركًا بين ضفّتي الملتقى: ${stitch.shared.slice(0, 4).join('، ')}.`,
      evidence: {
        'من': PERSON_NAME[s.from],
        'إلى': PERSON_NAME[s.to],
        'حركة المحور': Number(s.axisDelta.toFixed(2)),
        'تغيّر الزمن': s.tense ? 'نعم' : 'لا',
        'الجذور الرابطة': stitch.shared.slice(0, 8),
      },
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ٥ — تقابل النواسخ  ·  Mirrored Nāsikh Frame
// ═══════════════════════════════════════════════════════════════════════════
export function detectNasikhMirror(ctx: DetectorContext, opt: DetectorOptions): Discovery[] {
  const carriers = ctx.words
    .map((w) => ({ w, fam: nasikhFamily(w) }))
    .filter((x) => x.fam && x.w.person !== null);
  const out: Discovery[] = [];
  for (let i = 0; i < carriers.length - 1; i++) {
    const a = carriers[i];
    const b = carriers[i + 1];
    if (a.fam !== b.fam) continue;
    if (a.w.person === b.w.person) continue;
    if (b.w.idx - a.w.idx > opt.echoWindow) continue;
    const score = clamp01(0.42 + Math.max(0, 0.3 - (b.w.idx - a.w.idx) * 0.02));
    if (score < opt.minScore) continue;
    out.push({
      id: `${ctx.surah}:nasikh:${a.w.idx}`,
      kind: 'nasikh-mirror',
      surah: ctx.surah,
      ayahFrom: a.w.ayah,
      ayahTo: b.w.ayah,
      from: a.w.idx,
      to: b.w.idx,
      seam: b.w.idx,
      score,
      title: `تقابل الناسخ «${a.fam}»`,
      note:
        `حُمِل «${a.w.text}» على الإسناد إلى ${PERSON_NAME[a.w.person!]}، ` +
        `وحُمِل «${b.w.text}» على الناسخ نفسه بالإسناد إلى ${PERSON_NAME[b.w.person!]}.`,
      evidence: {
        'الناسخ': a.fam as string,
        'من': PERSON_NAME[a.w.person!],
        'إلى': PERSON_NAME[b.w.person!],
        'المسافة': ar(b.w.idx - a.w.idx),
      },
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ٦ — ألسنة الخلق  ·  Creation in the Isnād Chair
// ═══════════════════════════════════════════════════════════════════════════
export function detectKhalq(ctx: DetectorContext, opt: DetectorOptions): Discovery[] {
  const { words } = ctx;
  const out: Discovery[] = [];

  for (const w of words) {
    const stem = w.segments.find((s) => !s.clitic && s.lemma && KHALQ_LEMMAS[s.lemma]);
    if (!stem?.lemma) continue;
    const entry = KHALQ_LEMMAS[stem.lemma];
    const nominative = stem.gcase === 'NOM';
    const vocative = w.segments.some((s) => s.tag === 'VOC');

    // Find an agency verb agreeing with it in the immediate neighbourhood.
    let agent: Word | undefined;
    let speech = false;
    let commanded = false;
    for (let k = Math.max(0, w.idx - 3); k <= Math.min(words.length - 1, w.idx + 3); k++) {
      const v = words[k].segments.find((s) => s.cls === 'V' && s.root && AGENCY_ROOTS.has(s.root));
      if (!v) continue;
      // An imperative aimed at a vocative creature (يَٰٓأَرْضُ ٱبْلَعِى) seats it
      // in the chair just as squarely as a verb it performs, but the two are
      // not the same act and must not be reported as though they were.
      if (v.tense === 'IMPV' && vocative) {
        agent = words[k];
        commanded = true;
        break;
      }
      // A verb preceding its subject stays singular in Arabic, so agreement is
      // checked on person, not on number.
      if (v.person !== 3) continue;
      agent = words[k];
      if (v.root === 'قول' || v.root === 'نطق' || v.root === 'حدث' || v.root === 'شهد') speech = true;
      break;
    }
    if (!agent && !nominative && !vocative) continue;

    const score = clamp01(
      0.2 +
        (speech ? 0.42 : commanded ? 0.36 : agent ? 0.28 : 0) +
        (nominative ? 0.18 : 0) +
        (vocative ? 0.16 : 0),
    );
    if (score < opt.minScore) continue;

    w.khalq = {
      root: stem.root ?? stem.lemma,
      label: entry.label,
      category: entry.category,
      speech: speech || commanded,
    };

    out.push({
      id: `${ctx.surah}:khalq:${w.idx}`,
      kind: 'alsinat-al-khalq',
      surah: ctx.surah,
      ayahFrom: w.ayah,
      ayahTo: agent ? agent.ayah : w.ayah,
      from: Math.min(w.idx, agent?.idx ?? w.idx),
      to: Math.max(w.idx, agent?.idx ?? w.idx),
      seam: w.idx,
      score,
      title: `${entry.label} في مقعد الإسناد`,
      note: commanded
        ? `نودي ${entry.label} وخوطب بالأمر عند «${agent!.text}»، فوقع في مقعد المخاطَب.`
        : speech
          ? `أُسند القول أو الشهادة إلى ${entry.label} عند «${agent?.text ?? w.text}».`
          : agent
            ? `أُسند فعلٌ إلى ${entry.label} عند «${agent.text}».`
            : `وقع ${entry.label} مرفوعًا في موضع الإسناد إليه.`,
      evidence: {
        'الكيان': entry.label,
        'الصنف': entry.category,
        'الحال': commanded ? 'مخاطَب بالأمر' : speech ? 'ناطق' : agent ? 'فاعل' : 'مرفوع',
        'الفعل': agent?.text ?? '—',
      },
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ٧ — تداخل الإسناد  ·  Nested Attribution
// ═══════════════════════════════════════════════════════════════════════════
export function detectTabaqat(ctx: DetectorContext, opt: DetectorOptions): Discovery[] {
  return ctx.frames
    .filter((f) => f.depth >= 1)
    .map((f) => {
      const chain: string[] = [];
      let cur: Frame | undefined = f;
      while (cur) {
        chain.unshift(cur.speaker.label);
        cur = ctx.frames.find((x) => x.id === cur!.parent);
      }
      return {
        id: `${ctx.surah}:tabaqat:${f.open}`,
        kind: 'tabaqat-al-isnad' as const,
        surah: ctx.surah,
        ayahFrom: f.ayahFrom,
        ayahTo: f.ayahTo,
        from: f.from,
        to: f.to,
        seam: f.open,
        score: clamp01(0.35 + f.depth * 0.2),
        title: `قولٌ في جوف قول — الطبقة ${ar(f.depth + 1)}`,
        note: `سلسلة الإسناد: ${chain.join(' ← ')}.`,
        evidence: { 'العمق': f.depth + 1, 'السلسلة': chain, 'القائل': f.speaker.label },
        // `العمق` stays numeric: verify-exemplars sorts on it.
      };
    })
    .filter((d) => d.score >= opt.minScore);
}

// ═══════════════════════════════════════════════════════════════════════════
//  ٨ — ألسنة الرسل  ·  Messenger Tongues
// ═══════════════════════════════════════════════════════════════════════════
export function detectRusul(ctx: DetectorContext, opt: DetectorOptions): Discovery[] {
  const out: Discovery[] = [];
  for (const f of ctx.frames) {
    const named = Object.entries(RUSUL_LEMMAS).find(([, ar]) => f.speaker.label === ar);
    if (!named) continue;
    const span = ctx.words.slice(f.from, f.to + 1);
    const contour = span.filter((w) => w.person !== null).map((w) => w.person).join('');
    if (contour.length < 2) continue;
    const addressesQawm = span.some((w) =>
      w.segments.some((s) => s.lemma === 'قَوْم') && w.segments.some((s) => s.tag === 'VOC'),
    );
    const score = clamp01(0.34 + (addressesQawm ? 0.25 : 0) + Math.min(contour.length, 10) * 0.02);
    if (score < opt.minScore) continue;
    out.push({
      id: `${ctx.surah}:rusul:${f.open}`,
      kind: 'rusul-echo',
      surah: ctx.surah,
      ayahFrom: f.ayahFrom,
      ayahTo: f.ayahTo,
      from: f.from,
      to: f.to,
      seam: f.open,
      score,
      title: `لسان ${named[1]}`,
      note: `خطابٌ منسوب إلى ${named[1]}${addressesQawm ? ' بندائه قومَه' : ''}، كنتور إسناده: ${contour}.`,
      evidence: { 'الرسول': named[1], 'الكنتور': contour, 'نداء القوم': addressesQawm ? 'نعم' : 'لا' },
    });
  }
  return out;
}

// ── ساعة الآية ──────────────────────────────────────────────────────────────
export function clockOf(words: Word[]): Ayah['clock'] {
  let past = 0, present = 0, imperative = 0, timeNouns = 0, future = 0;
  for (const w of words) {
    for (const s of w.segments) {
      if (s.tense === 'PERF') past++;
      else if (s.tense === 'IMPF') present++;
      else if (s.tense === 'IMPV') imperative++;
      if (s.tag === 'FUT') future++;
      if (s.lemma && ZAMAN_LEMMAS.has(s.lemma)) timeNouns++;
    }
  }
  const n = Math.max(1, words.length);
  const p = past / n;
  const q = present / n;
  return {
    past: p,
    present: q,
    imperative: imperative / n,
    timeNouns: timeNouns / n,
    future: future / n,
    // A bridge needs both banks: neither pure narrative nor pure address.
    bridge: clamp01(Math.sqrt(p * q) * 2.6),
  };
}

/**
 * Detectors that scan a sliding window fire once per qualifying position, so a
 * single passage can yield a handful of findings whose spans nearly coincide.
 * Keep the strongest of each overlapping cluster: the reader wants the passage
 * pointed at once, not five times with the numbers nudged.
 */
function dedupe(items: Discovery[], overlapRatio = 0.6): Discovery[] {
  const kept: Discovery[] = [];
  for (const d of [...items].sort((a, b) => b.score - a.score)) {
    const clash = kept.some((k) => {
      if (k.kind !== d.kind) return false;
      const lo = Math.max(k.from, d.from);
      const hi = Math.min(k.to, d.to);
      if (hi < lo) return false;
      const shared = hi - lo + 1;
      const shortest = Math.min(k.to - k.from + 1, d.to - d.from + 1);
      return shared / shortest >= overlapRatio;
    });
    if (!clash) kept.push(d);
  }
  return kept;
}

// ── the full sweep ──────────────────────────────────────────────────────────
export function runAllDetectors(
  ctx: DetectorContext,
  opt: DetectorOptions = DEFAULT_OPTIONS,
): Discovery[] {
  const all = [
    ...detectIstihdar(ctx, opt),
    ...detectRootReturn(ctx, opt),
    ...detectNabaBridge(ctx, opt),
    ...detectRibat(ctx, opt),
    ...detectNasikhMirror(ctx, opt),
    ...detectKhalq(ctx, opt),
    ...detectTabaqat(ctx, opt),
    ...detectRusul(ctx, opt),
  ];
  return dedupe(all).sort((a, b) => b.score - a.score);
}

export const KIND_AR: Record<string, { label: string; short: string; hint: string }> = {
  istihdar: { label: 'استحضار الغائب', short: 'استحضار', hint: 'غائبٌ يُذكر ثم يُخاطَب' },
  'raj-al-jidhr': { label: 'رجع الجذر', short: 'رجع الجذر', hint: 'جذرٌ يعود من إسنادٍ آخر' },
  'jisr-al-naba': { label: 'جسر النبأ', short: 'جسر النبأ', hint: 'سردٌ ماضٍ ينتقل إلى المضارع' },
  ribat: { label: 'رِباط الملتقى', short: 'الرباط', hint: 'ثبات اللفظ مع حركة الإسناد' },
  'nasikh-mirror': { label: 'تقابل النواسخ', short: 'تقابل', hint: 'ناسخٌ واحد يحمل إسنادين' },
  'alsinat-al-khalq': { label: 'ألسنة الخلق', short: 'الخلق', hint: 'غير الإنسي في مقعد الإسناد' },
  'tabaqat-al-isnad': { label: 'تداخل الإسناد', short: 'التداخل', hint: 'قولٌ في جوف قول' },
  'rusul-echo': { label: 'ألسنة الرسل', short: 'الرسل', hint: 'خطابُ رسولٍ وكنتور إسناده' },
};
