# مرصد الإسناد · Isnād Observatory

A studio for reading the Qur'an through **الإسناد** — grammatical attribution — and
for finding the places where the attribution *moves*. Arabic only; there are no
translations anywhere in the application, by design.

```bash
npm install && npm run dev     # works on a fresh clone: no network, no database, no config
```

---

## 1 · The idea

A shift in grammatical person is easy to detect and, alone, not interesting.
What makes one worth stopping at is when the shift *does* something — when the
tongue swings the attribution while holding everything else still, and the
referent moves as a result.

Three passages set the standard the engine is held to:

| | what happens |
|---|---|
| **هود ٢٩** | Nūḥ speaks of the believers as absent (`إِنَّهُم مُّلَٰقُوا۟ رَبِّهِمْ`), then without pause turns to his people directly (`وَلَٰكِنِّىٓ أَرَىٰكُمْ`). The same particle family carries both banks: `إِنَّ` holding the third person, `لٰكِنَّ` the first. Contour `1312`. |
| **ق ٢** | Wonder is predicated of them while absent (`بَلْ عَجِبُوٓا۟`); nine words later the same root returns from their own mouths (`هَٰذَا شَىْءٌ عَجِيبٌ`). |
| **القصص ٤–٥** | Nineteen words of closed third-person past about Fir'awn, then `وَنُرِيدُ أَن نَّمُنَّ` — first person, imperfect, four times. `ضعف` crosses the seam active→passive, `جعل` crosses it, `فِى ٱلْأَرْضِ` appears verbatim on both sides. |

All three share one signature: **maximum grammatical motion held against maximum
lexical continuity**. That product — `lexicalContinuity × isnādDelta` — is the
master metric the engine is organised around, and it fell out of the three
passages rather than being imposed on them.

`npm run verify` pins the engine to all three. If a change stops finding them,
the change is wrong.

**الإسناد, precisely.** A person tag is not attribution. `رَبِّهِمْ` references a
third person; it does not predicate to one. Segments that seat a referent in the
attribution chair (`verb-subject`, `subject-enclitic`, `detached`,
`nasikh-subject`) are separated from those that merely point at one (`object`,
`possessive`, `prepositional`, `vocative`), and everything downstream stands on
that distinction. The **proximity axis** places المخاطب at 0 — direct address is
the nearest a discourse can stand — المتكلم at 0.5, الغائب at 1.

---

## 2 · The engine

**Eight detectors**, each reporting a *structural configuration* present in the
morphology. None of them interpret.

`istihdar` استحضار الغائب · `raj-al-jidhr` رجع الجذر · `jisr-al-naba` جسر النبأ ·
`ribat` رِباط الملتقى · `nasikh-mirror` تقابل النواسخ · `alsinat-al-khalq` ألسنة الخلق ·
`tabaqat-al-isnad` تداخل الإسناد · `rusul-echo` ألسنة الرسل

**المثاني.** Every isnād-bearing word contributes one symbol (person × tense),
making the muṣḥaf a single string of 23,784 symbols over a twelve-letter
alphabet. A **suffix automaton** yields every right-maximal repeated contour at
once, with no ceiling on length — the point being that the interesting مثاني are
not the ones you thought to look for.

**الأعلام.** 32 declarative markers → 628 occurrences. A marker is not a keyword
search: it can require a lemma in a given case, a run of consecutive words with
alternatives per position, two roots co-occurring in one āyah, or hand-named
loci. `قَآئِلٌ مِّنْهُمْ` occurs **exactly three times** (١٢:١٠، ١٨:١٩، ٣٧:٥١) where a
loose search for `قائل` returns six, three of them a different root.

**وحدة الزمن.** Twelve time modalities, each anchored to particles the corpus
actually tags. They are deliberately not one axis: `لَن` forecloses a future,
`لَو` opens one that never was, `كُلَّمَا` refuses to happen once, `أَبَدًا` removes
the question.

---

## 3 · The surfaces

| route | |
|---|---|
| `/` | **الكون** — 1,000 āyāt placed in isnād space, WebGL, flown freely |
| `/explore` | **القرآن الغامر** — pick any of the 114, entered through الاستعاذة once |
| `/studio` | **مرصد الإسناد** — three-pane studio: reader, waveform, تدبر matrix |
| `/compose` · `/gallery` · `/watch/…` | author recitations, publish them, play them in الفرقان |

**الكون.** **Radius** is discourse distance, so flying inward *is* moving toward
المخاطب; **colour** is the dominant person. Navigation is the text's own —
**السنابل**, seven branches per grain after `سَبْعَ سَنَابِلَ` (2:261), 7,000 edges;
**السُّلَّم**, which rescales discourse distance itself
(`أَمْ لَهُمْ سُلَّمٌ يَسْتَمِعُونَ فِيهِ`); and **الإسناد as the camera** — المتكلم seats
you *at* the āyah looking out, المخاطب places it before you, الغائب watches from
outside.

**الخيوط.** The corpus engine addresses everything by موقع; the field addresses
everything by node index. The join between them turns relations the engine had
already found into things you can see and follow: 2,015 motif strands, 1,054
root strands, 257 detector strands, resonance per focused āyah, and رِباط's
`حركة المحور` as an actual displacement between two person shells whose radial
extent is exactly the delta the detector measured. Each carries the engine's own
evidence, never a paraphrase, because a line on a canvas reads as an assertion.

~10,300 relations exist; a frame draws a few hundred, round-robined across the
families so one detector's high scores cannot wear the whole field. The 7,000
سنابل stay a navigation layer and never become 7,000 lines.

**الأساس.** Drawing the strands exposed something the numbers had not. Under the
برج placement, two *related* āyāt land 14% **further** apart than two picked at
random (`npm run basis`) — direction was a label dressed as a cause, and no
cluster could ever form. Three derived bases are now selectable and blendable
against it, with قُربُ المرتبطات shown live: the isnād mix reaches 0.616, a
spectral embedding of the strand graph 0.697, and reading the contour as a
base-three fraction reaches 1.033 — no better than random, an honest negative.
البروج remains the default and the celestial reference; nothing moves until the
reader moves it. Radius is untouched by every basis: it was the one component
that already meant something.

**لوح الزمن** is shaped as an aircraft CDU, because a flight computer does not
*show* a route — you enter legs and it flies them. Enter `ماضٍ → لَوْ → لَنْ`; LEGS
orders them on before↔after, EXEC flies it leg by leg, and the field dims to
what the route admits rather than hiding it.

**الفرقان** is not a recording. Each station names a locus and the āyah, its
words and its isnād are rendered live from the corpus — which is what lets the
controls be controls of the *text*: البروج the movement ring, مواقع النجوم the
scrubber, الفَلَك the circuit, السِّراج the isnād burn, القمر المنير the paired āyah.

---

## 4 · Data and architecture

| | |
|---|---|
| āyāt / words / segments | 6,236 · 77,429 · 130,031 |
| computed relations | 10,326 strands · 282 رِباط displacements |
| discoveries mined | 7,057 · 400 repeated contours · 1,651 roots |
| cosmos | 1,000 nodes · 7,000 سنابل edges · 12 modalities |
| sky | 5,044 stars to magnitude 6 · 89 figures, all Arabic-named · 103 Arabic star names |
| `/data` | 11 MB · 66 source files · ~11,700 lines |

**Sources** (open, cached in `.cache/`): `mustafa0x/quran-morphology` (Quranic
Arabic Corpus v0.4), `risan/quran-json` (Uthmani text), `ofrohn/d3-celestial`
(Yale BSC + IAU figures).

**One source of truth.** `/data` holds only the raw corpus and the globally-mined
indices. Spines, seams, frames and discoveries are rebuilt on request — ~80 ms
for al-Baqarah, then cached. That dropped `/data` from 48 MB to 11 MB and makes
detector thresholds tunable at runtime rather than baked in.

Supabase is **optional**: without credentials, notes go to `localStorage` and
compositions to JSON files, and the badge in the UI says which is live.

---

## 5 · Honesty about the method

Everything surfaced is **استنباط آلي** — computational extraction from
morphological tagging. It points at where to look. It does not interpret, and it
is not tafsīr. Where a reading is the author's, it is rendered in a visually
distinct register labelled **قراءة المؤلِّف**, never as a finding of the engine.

Heuristics the code names as heuristics: the corpus marks no quotation
boundaries, so frames open at a verb of saying and close at the next one or at
āyah end, with nesting decided by the verb's own inflection and capped at depth
4; speakers resolve from an explicit فاعل where there is one and otherwise from
the nearest named actor, marked **مستنبَط**; ألسنة الخلق works from a closed
lexicon and will miss entities not in it.

**Bugs worth recording**, all caught and fixed:

- Āyah vectors, signatures and distances were computed *before* word spines were
  resolved — every one of the 6,236 signatures was silently empty.
- The feature parser discarded noun number/gender, since only person tags carry a
  leading digit.
- Quotation nesting treated every `قُلْ` as speech-inside-speech and reached depth 22.
- `Denebola` matched the key `Deneb` and took the wrong Arabic name.
- `كُلَّمَا` matched **zero**: Arabic diacritics have no canonical order, and the
  declared string ordered fatḥa before shadda where the corpus does the reverse.
  The cosmos ingest now **fails the build** if any declared lemma matches nothing.
- رِباط's `حركة المحور` was first drawn by adding the detector's delta to the
  node's own `d`. That put 238 of 282 displacements outside the proximity axis:
  `d` is the āyah's aggregate over every attribution in it, the delta is measured
  between two single person positions, and the two are not on the same footing.
  A clamp would have concealed it.
- السنابل were fed to the community detection, where — seven neighbours per node,
  derived from isnād and time similarity — they welded 996 of 1,000 āyāt into a
  single label. That is not a community but the absence of one.

---

## 6 · What is in the field

`npm run structures` asks whether any grouping deserves more than a line, on two
measures: **support** — how many independent families of relation agree on it —
and **shape**, from PCA over the member positions. Label propagation over the
3,326 relations that owe nothing to placement finds 283 communities (43, 31, 23,
22, 22, 21, 20 …); 41 groupings of ≥8 āyāt are linear with three-family support
and 11 are planar.

Two things hold this back from becoming surfaces, and they are recorded rather
than worked around. Support is basis-independent, but **shape is not** — the
same groupings are 30 filaments and 74 sheets under البروج, 82 and 15 under
isnād — so any affordance keyed to shape is keyed to a choice of basis. And none
of them is local: median extent 154 where the widest spans 233. These are
threads and sections through the *whole* field, not places in it, which reads
for a trajectory to follow and against a surface to stand on.

---

## 7 · Not built yet

- **Typed word/phrase → custom tarteel.** Planned as a deterministic corpus
  version first (works with zero keys), with OpenRouter / Google AI Studio /
  Ollama layered on when keys arrive.
- **رتق mode** — the inverted glass sphere, outside-in. Least specified; the
  brief for it cut off mid-sentence.
- The remaining أعلام list, which cut off after `سبيل الرشد`. Each is one spec.
