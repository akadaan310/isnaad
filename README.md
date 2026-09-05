# مرصد الإسناد · Isnād Studio

A studio for reading the Qur'an through **الإسناد** — grammatical attribution — and
for finding the places where the attribution *moves*.

The text is Arabic only. There are no translations anywhere in this application,
by design.

```bash
npm install
npm run dev      # http://localhost:3000
```

`/data` is committed, so that works on a fresh clone with no network, no
database, and no configuration.

| | |
|---|---|
| `/` | **الكون** — a thousand āyāt placed in isnād space, in WebGL. Flown freely. |
| `/explore` | **القرآن الغامر** — pick any of the 114 and play it. Entered through الاستعاذة, once. |
| `/studio` | **مرصد الإسناد** — the three-pane studio. Opens on هود ٢٩. |
| `/compose` | **التأليف** — build a recitation out of أعلام. |
| `/gallery` | **المعرض** — published recitations, public. |
| `/watch/surah/<n>` | **الفرقان** — a whole sūrah, recited through the sky. |
| `/watch/<id>` | **الفرقان** — a composed recitation. |

---

## What this is actually for

A shift in grammatical person is easy to detect and, on its own, not very
interesting. What makes one worth stopping at is when the shift *does* something
— when the tongue swings the attribution while holding everything else still,
and the referent moves as a result.

Three passages set the standard the engine is held to:

**هود ٢٩** — Nūh speaks of the believers in the third person, as absent people:
`إِنَّهُم مُّلَٰقُوا۟ رَبِّهِمْ`. Then, without pause, `وَلَٰكِنِّىٓ أَرَىٰكُمْ قَوْمًا تَجْهَلُونَ` — first
person, and his people addressed directly. The same particle family carries both
banks: `إِنَّ` holding the third person, `لٰكِنَّ` holding the first. The āyah's
contour is `1312`.

**ق ٢** — wonder is predicated of them while they are absent, `بَلْ عَجِبُوٓا۟`; nine
words later the same root comes back out of their own mouths inside a quotation,
`فَقَالَ ٱلْكَٰفِرُونَ هَٰذَا شَىْءٌ عَجِيبٌ`.

**القصص ٤–٥** — nineteen words of closed third-person past about Fir'awn, then
`وَنُرِيدُ أَن نَّمُنَّ` — first person, imperfect, four times over. And `ضعف` crosses the
seam from active to passive (`يَسْتَضْعِفُ` → `ٱسْتُضْعِفُوا۟`), `جعل` crosses it
(`جَعَلَ` → `نَجْعَلَ`), and `فِى ٱلْأَرْضِ` appears verbatim on both sides.

Those three turn out to share one signature: **maximum grammatical motion held
against maximum lexical continuity**. That product — `lexicalContinuity ×
isnādDelta` — is the master metric the whole engine is organised around, and it
fell out of the three passages rather than being imposed on them.

`npm run verify` pins the engine to all three. If a change stops finding them,
the change is wrong.

---

## الإسناد, precisely

A person tag is not attribution. `رَبِّهِمْ` references a third person; it does not
predicate to one. The engine separates the segments that seat a referent in the
attribution chair from those that merely point at one, and everything downstream
stands on that distinction:

| office | Arabic | seats a referent? |
|---|---|---|
| `verb-subject` | إسناد فعلي | yes |
| `subject-enclitic` | ضمير رفع متصل | yes |
| `detached` | ضمير منفصل | yes |
| `nasikh-subject` | اسم الناسخ | yes |
| `object` | ضمير نصب | reference only |
| `possessive` | مضاف إليه | reference only |
| `prepositional` | مجرور بحرف | reference only |
| `vocative` | منادى | reference only |

The **proximity axis** places المخاطب at 0 — direct address is the nearest a
discourse can stand — المتكلم at 0.5, and الغائب at 1.

---

## The detectors

Eight, in `src/lib/engine/detectors.ts`. Each reports a *structural
configuration* present in the morphology. None of them interpret.

| | Arabic | what it finds |
|---|---|---|
| `istihdar` | استحضار الغائب | a party spoken of in absence, then direct address within a few words |
| `raj-al-jidhr` | رجع الجذر | a root returning across a person, voice, or quotation boundary |
| `jisr-al-naba` | جسر النبأ | sustained third-person past giving way to first-person imperfect |
| `ribat` | رِباط الملتقى | lexical continuity held against isnād motion — the master metric |
| `nasikh-mirror` | تقابل النواسخ | one particle family hosting two different persons |
| `alsinat-al-khalq` | ألسنة الخلق | non-human creation seated in the chair, or commanded in the vocative |
| `tabaqat-al-isnad` | تداخل الإسناد | speech reported inside speech |
| `rusul-echo` | ألسنة الرسل | messenger speech and the contour it runs on |

Thresholds are read from the query string, so they are tunable per request
rather than baked into the data — see `optionsFromQuery`.

### المثاني — motif mining

Every isnād-bearing word contributes one symbol (person × tense), making the
whole muṣḥaf a single string over a twelve-letter alphabet, 23,784 symbols long.
A **suffix automaton** over that string yields every *right-maximal* repeated
contour at once, with no ceiling on length — which is the point: the interesting
مثاني are not the ones you thought to look for. Mirror pairs (المتكلم and الغائب
trading seats) are flagged automatically.

### حجرة اللاتزمّن

A greedy walk over a weighted graph whose **edges are the ʿarabī operations
themselves** — a shared motif, an inverted contour, a returning root, a bridge
into the present, creation taking the chair, an inversion of discourse distance.
The walk may not use the same operation twice in a row, so what it composes is a
tartīl of *different* operations rather than a list of similar āyāt.

It seeds from places where the text audits elapsed time: the sleepers of the
cave and their `كَمْ لَبِثْتُمْ`, the hundred years of ٢:٢٥٩, `مَا لَبِثُوا۟ غَيْرَ سَاعَةٍ`,
and ٤١:٤٧ — `إِلَيْهِ يُرَدُّ عِلْمُ ٱلسَّاعَةِ`.

A walk from ١٨:١٩ steps to ٦:٥٩ on the root `ورق` — `وَرِقِكُمْ` to `وَرَقَةٍ` — which
occurs in four places in the entire muṣḥaf.

---

## الفرقان — the player

A composition is **not a recording and not a video**. Each station names a
locus; the āyah, its words and its isnād are fetched from the corpus and
rendered at watch time. That is what lets the controls be controls of the
*text* rather than of a timeline — so they are named for the constructs they
operate on, and each one does real work:

| control | construct | what it does |
|---|---|---|
| **البُرُوج** | `وَجَعَلَ فِى ٱلسَّمَآءِ بُرُوجًا` | the movements, as stations to jump between |
| **مواقع النجوم** | `فَلَآ أُقْسِمُ بِمَوَٰقِعِ ٱلنُّجُومِ` | the scrubber — positions inside one برج |
| **الفَلَك** | `كُلٌّ فِى فَلَكٍ يَسْبَحُونَ` | the circuit: stations advance on their own, and it orbits |
| **السِّراج** | `وَجَعَلَ فِيهَا سِرَاجًا` | how far the isnād burn reaches, from plain muṣḥaf to full |
| **القمر المنير** | `وَقَمَرًا مُّنِيرًا` | reflected light — the paired āyah held beside this one |
| **نَذِيرًا** | `لِيَكُونَ لِلْعَٰلَمِينَ نَذِيرًا` | sending it out |

Keys: `space` الفلك · `←/→` stations · `↑/↓` movements · `m` القمر · `f`
fullscreen.

## الأعلام — the constructs

Markers are declarative, one spec each, in `src/lib/aalam.ts`. A marker is not
a keyword search: it can require a lemma in a given case, a run of consecutive
words with alternatives at each position, two roots co-occurring in one āyah,
or hand-named loci. That precision is the whole point.

`قَآئِلٌ مِّنْهُمْ` — an unnamed voice from inside a group, turning the account —
occurs **exactly three times**: ١٢:١٠، ١٨:١٩، ٣٧:٥١. A loose search for `قائل`
returns six, three of them a different root entirely. Likewise `فَلَك` (the
orbit) twice, `مَوَٰقِع` once, `بُرُوج` four times, `ٱلْفُلْكِ ٱلْمَشْحُونِ` three
times — the third of which sits two āyāt from `فَٱلْتَقَمَهُ ٱلْحُوتُ`.

Twenty-one markers ship, across seven families (الكتاب واللسان، الأنباء،
الأمثال، الفُلك والفَلَك، الفرقان ومواقعه، السبيل، الكيد والقائل), resolving to
572 occurrences. Adding one means adding a spec; nothing else changes.

## التأليف — the composer

Name a عَلَم and the assembler packs a برج out of it. The pacing rule is the
point: each marker occurrence is followed, where one exists, by the strongest
thing the isnād engine found **at that same locus**. So a برج does not read as
a concordance — it reads as *here is the construct*, then immediately *and here
is what the tongue does with it*, over and over:

```
٤:٧٨   البروج — «بُرُوجٍ»
٤:٧٨   استحضار الغائب — سُبِق الملتقى بـ٤ من مواضع الإسناد إلى الغائب…
١٥:١٦  البروج — «بُرُوجًا»
١٥:١٦  رجع الجذر — «ٱلسَّمَآءَ» ← ١٥ كلمة → «ٱلسَّمَآءِ»
```

Assembly is a draft. Everything is editable: reorder movements and stations,
rewrite the framing, cut what does not earn its place, then publish.

Compositions are stored in Supabase when it is configured and as JSON files
under `data/compositions/` otherwise. The file path is what makes the gallery
work on a fresh clone; it is also why a serverless deployment wants Supabase,
since a read-only filesystem cannot accept a save. `npm run seed` builds one
worked example.

---

## Data

Two open sources, both fetched over plain HTTPS and cached in `.cache/`:

- [`mustafa0x/quran-morphology`](https://github.com/mustafa0x/quran-morphology) —
  the Quranic Arabic Corpus v0.4 morphology with Buckwalter resolved to Arabic.
- [`risan/quran-json`](https://github.com/risan/quran-json) — Uthmani text and
  sūrah metadata.

**The reader's word tokens are built from the morphology itself**, not by aligning
two files, so a word and its analysis cannot drift apart.

`/data` holds only the raw corpus and the globally-mined indices. Spines, seams,
frames and discoveries are all rebuilt on request — ~80ms for al-Baqarah, the
longest sūrah, then cached. One source of truth, 9.8MB instead of 48MB, and
detector thresholds that can actually be tuned at runtime.

```
data/corpus/<n>.txt     morphology rows for one sūrah, verbatim
data/corpus/meta.json   sūrah names, types, Uthmani āyah text
data/index/motifs.json  mined مثاني contours
data/index/ayaat.json   per-āyah vector index (6,236 rows)
data/index/roots.json   1,651 roots → where each occurs
data/index/aalam.json   the أعلام registry resolved to its occurrences
data/compositions/      saved compositions, when not using Supabase
data/sky/sky.json       5,044 stars and 89 constellation figures
data/cosmos/nodes.json  the thousand placed āyāt and their سنابل
```

| | |
|---|---|
| āyāt | 6,236 |
| words | 77,429 |
| morphological segments | 130,031 |
| isnād symbols | 23,784 |
| discoveries mined | 7,057 |
| repeated contours | 400 |

---

## Supabase (optional)

The studio runs fully without it; تدبّر notes go to `localStorage` and the badge
in the تدبّر panel says so. To use Postgres instead, apply
`supabase/migrations/01_isnad_quran_schema.sql`, fill in `.env.local` from
`.env.example`, and:

```bash
npm run ingest -- --push-supabase
```

That pushes `surahs` and `ayaat`. The `words` and `isnad_attributions` tables are
defined in full — the word level is where the isnād lives, and the migration ships
two views (`isnad_seams`, `root_returns`) that express the same questions in SQL —
but the ingest script does not populate them by default, since the app rebuilds
that layer in milliseconds and it is ~180,000 rows.

---

## Commands

```bash
npm run dev              # the studio
npm run ingest           # rebuild /data from cache, downloading if absent
npm run ingest:refresh   # re-download the sources first
npm run verify           # the three passages, as acceptance tests
npm run seed             # assemble and publish one worked composition
npm run ingest:sky       # build the naked-eye sky (stars + 89 figures)
npm run ingest:cosmos    # place the thousand āyāt in isnād space
npm run build            # production build
```

---

## Honesty about the method

Everything the studio surfaces is **استنباط آلي** — computational extraction from
morphological tagging. It points at where to look. It does not interpret, and it
is not tafsīr.

Some of it is frankly heuristic, and the code says so where it is:

- The corpus marks no quotation boundaries. A frame opens at a verb of saying and
  closes at the next one or at the end of the āyah, running on into following
  āyāt only while those open no frame of their own. Nesting is decided by the
  verb's own inflection — a third-person verb is the narrator reporting, `قُلْ` is
  the narrator commanding, but `قُلْتَ` or `أَقُولُ` cannot be either, so it nests.
  Depth is capped at 4.
- Speakers are resolved from an explicit nominative فاعل where there is one, and
  otherwise from the nearest preceding named actor. The second case is marked
  **مستنبَط** in the tree, because it is a guess.
- ألسنة الخلق works from a closed lexicon of creation lemmas plus a set of agency
  roots. It will miss entities not in the lexicon.
