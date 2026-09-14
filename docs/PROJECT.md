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

**الكون.** Placement is meaning: **direction** is the برج realm from that
constellation's real RA/Dec; **radius** is discourse distance, so flying inward
*is* moving toward المخاطب; **colour** is the dominant person. Navigation is the
text's own — **السنابل**, seven branches per grain after `سَبْعَ سَنَابِلَ` (2:261),
7,000 edges; **السُّلَّم**, which rescales discourse distance itself
(`أَمْ لَهُمْ سُلَّمٌ يَسْتَمِعُونَ فِيهِ`); and **الإسناد as the camera** — المتكلم seats
you *at* the āyah looking out, المخاطب places it before you, الغائب watches from
outside.

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

---

## 6 · The فهرس — studying this codebase

`docs/FIHRIS.md` exposes the whole address space — 66 modules, 272 exports, 13
routes, 12 data files — as **FIHRIS/1**, a prompt-based request protocol for an
AI agent studying the codebase: nine verbs (فهرس، شرح، نسب، تتبّع، حجّة، حدّ،
مثال، تأثير، تمرين), twelve named invariants with the cost of breaking each, and
eight ordered curricula.

The index itself, `docs/fihris.json`, is generated from the tree by
`npm run fihris` and never hand-written. The build fails if an invariant
citation stops resolving, if a declared vocabulary id is no longer in its source,
or if a library goes unclassified, and `npm run fihris:check` fails on any drift
— so the فهرس cannot describe a codebase that no longer exists.

---

## 7 · Not built yet

- **Typed word/phrase → custom tarteel.** Planned as a deterministic corpus
  version first (works with zero keys), with OpenRouter / Google AI Studio /
  Ollama layered on when keys arrive.
- **رتق mode** — the inverted glass sphere, outside-in. Least specified; the
  brief for it cut off mid-sentence.
- The remaining أعلام list, which cut off after `سبيل الرشد`. Each is one spec.
