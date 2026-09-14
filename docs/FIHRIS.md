# الفهرس · FIHRIS/1

**A prompt-based computational request protocol for studying this codebase.**

This document is addressed to an AI agent, not to a human maintainer. It exposes
the entirety of the engines and libraries of مرصد الإسناد as an *addressable*
space, and defines nine verbs with which you can request expositions of any part
of it.

You are reading the map. The territory is `docs/fihris.json` — 66 modules, 272
exports, 13 routes, 12 data files, ~11,900 lines — generated from the source tree
by `npm run fihris`, never written by hand, and validated on every build against
the tree it claims to describe. If a citation in this protocol stops resolving,
the build fails. The فهرس is not permitted to describe a codebase that no longer
exists.

```bash
npm run fihris         # rebuild docs/fihris.json from the tree
npm run fihris:check   # fail if the committed فهرس has drifted
npm run verify         # the three passages the engine is pinned to
```

---

## 0 · What you are being given access to

A studio for reading the Qur'an through **الإسناد** — grammatical attribution —
and for finding the places where the attribution *moves*.

The whole system rests on one distinction. A person tag is not attribution.
`رَبِّهِمْ` references a third person; it does not predicate to one. Four
grammatical offices seat a referent in the attribution chair — `verb-subject`,
`subject-enclitic`, `detached`, `nasikh-subject` — and four merely point at one.
Everything downstream stands on that separation.

The master metric is `lexicalContinuity × isnādDelta`: maximum grammatical
motion held against maximum lexical continuity. It was not designed. It fell out
of three passages — هود ٢٩، ق ٢، القصص ٤–٥ — and the engine is pinned to all
three by `npm run verify`.

**The stance you inherit by using this protocol.** Everything here is
**استنباط آلي** — computational extraction from morphological tagging. It points
at where to look. It does not interpret, and it is not tafsīr. Any exposition you
request or produce over FIHRIS/1 inherits that stance: a structural finding may
not be laundered into a claim about meaning.

---

## 1 · Addressing — العنونة

```
isnaad://<space>/<path>[#<symbol>]
```

| space | resolves to | example |
|---|---|---|
| `module` | a library under `src/lib` | `isnaad://module/isnad#findSeams` |
| `engine` | a library under `src/lib/engine` | `isnaad://engine/detectors#detectRibat` |
| `surface` | a React/WebGL component | `isnaad://surface/cosmos/scene` |
| `app` | a file under `src/app` | `isnaad://app/api/chamber/route` |
| `script` | an ingestion or acceptance script | `isnaad://script/verify-exemplars` |
| `api` | an HTTP endpoint | `isnaad://api/surah/[id]` |
| `page` | a rendered surface | `isnaad://page/studio` |
| `data` | a committed data file | `isnaad://data/index/motifs.json` |
| `kind` | one of the eight discovery kinds | `isnaad://kind/jisr-al-naba` |
| `alam` | one of the 32 declarative markers | `isnaad://alam/qail-minhum` |
| `modality` | one of the twelve time modalities | `isnaad://modality/law` |
| `operation` | one of six chamber-walk operations | `isnaad://operation/root-return` |
| `locus` | a place in the muṣḥaf | `isnaad://locus/28:5` |
| `invariant` | a rule the codebase may not break | `isnaad://invariant/spine-before-vector` |
| `curriculum` | an ordered study route | `isnaad://curriculum/mabda` |

Every address above resolves to something this repository actually contains. An
address that does not resolve is a malformed request, **not an invitation to
invent one**. `docs/fihris.json` holds the complete enumeration of each space.

---

## 2 · The nine verbs — الأفعال

| verb | ar | asks for | returns |
|---|---|---|---|
| `FIHRIS` | فهرس | enumerate what is addressable under a prefix | flat list of addresses, one line of gloss each, no prose |
| `SHARH` | شرح | exposition of one node | purpose · mechanism · inputs · outputs · neighbours · citations |
| `NASAB` | نسب | provenance of a number or claim | raw source → script → data file → module → surface, each link cited |
| `TATABBUA` | تتبّع | trace one datum end-to-end | ordered stages; module, function and shape at each |
| `HUJJA` | حجّة | the evidence for a claim | verbatim excerpts with `path:line` + the command that reproduces it |
| `HADD` | حدّ | the boundary — what it does *not* do | declared heuristics, caps, closed lexicons, known misses |
| `MITHAL` | مثال | a worked example at a real locus | concrete locus, actual computed values, emitted record |
| `TATHIR` | تأثير | blast radius of a proposed change | modules, data, invariants, acceptance checks, rebuild needed? |
| `TAMRIN` | تمرين | an exercise that tests understanding | task + verifying command + the observable that proves you were right |

`HADD` is not optional politeness. This system declares its heuristics, and an
exposition that omits them is a defective answer.

---

## 3 · The envelopes

**Request**

```
⟨FIHRIS/1⟩
verb: SHARH
target: isnaad://engine/detectors#detectRibat
depth: 2
lens: mechanism, failure-mode
at: isnaad://locus/28:5
budget: 500
lang: ar+en
```

| field | |
|---|---|
| `verb` | **required** — one of the nine |
| `target` | **required** — one `isnaad://` address |
| `depth` | `0` orientation · `1` working knowledge · `2` mechanism · `3` line by line (default `1`) |
| `lens` | `mechanism`, `invariant`, `failure-mode`, `provenance`, `performance`, `arabic`, `extension` |
| `at` | a locus to ground the answer in |
| `budget` | soft word ceiling (default 600) |
| `lang` | `ar` · `en` · `ar+en` (default `ar+en`) |

Several envelopes may be sent in one message; they are answered in order, and a
later one may depend on an earlier answer.

**Response**

```
⟨FIHRIS/1 · SHARH · isnaad://engine/detectors#detectRibat⟩
… the verb's contract …

— حجّة: src/lib/engine/detectors.ts:382-417, src/lib/isnad.ts:151-182
— حدّ: what this answer did not cover, and where it would break
```

**Obligations on every response**

1. **Cite.** Every factual claim carries `path` or `path:line`. A claim that
   cannot be cited is marked **استنباط** — an inference — or is not made.
2. **Bound.** Every response ends with `حدّ`.
3. **Never interpret.** Structure is reported as structure.
4. **Never invent an address.** If the target does not resolve, say so and offer
   the nearest addresses that do.
5. **Never translate the vocabulary away.** الإسناد is الإسناد. A gloss may
   follow the Arabic term; it may not replace it.
6. **Prefer the code's own words.** This codebase documents itself densely in
   comments. Quote before paraphrasing — `docs/fihris.json` carries the comment
   attached to every one of the 272 exports for exactly this reason.

---

## 4 · A worked exchange

**Request**

```
⟨FIHRIS/1⟩
verb: SHARH
target: isnaad://engine/detectors#detectRibat
depth: 2
lens: mechanism
```

**Response**

> ⟨FIHRIS/1 · SHARH · isnaad://engine/detectors#detectRibat⟩
>
> **الغرض.** رِباط الملتقى is the master metric: *maximum grammatical motion held
> against maximum lexical continuity*. The other seven detectors name particular
> configurations; this one generalises the three reference passages to the rest
> of the muṣḥaf.
>
> **الآلة.** It iterates `ctx.seams` — not words. A seam is a point where the
> attribution turns, produced by `findSeams` (`src/lib/isnad.ts:151`). At each
> seam two independent quantities are computed:
>
> - `stitchAcross(words, s.at, opt.stitchWindow)` takes an 8-word bank either
>   side and returns `shared.length / √union` over **content roots only** —
>   clitics excluded (`detectors.ts:51-87`). This is the لفظ holding still.
> - `seamDelta(s)` weights the motion: `|axisDelta| × 0.6`, plus `0.2` for a
>   person change, `0.15` tense, `0.08` number, `0.05` gender
>   (`detectors.ts:89-99`). This is the إسناد moving.
>
> The score is their geometric mean, `√(stitch × delta) × 1.15`, clamped to
> `[0,1]`. A geometric mean is the whole argument: either factor at zero kills
> the finding. Lexical continuity without grammatical motion is just a repeated
> word; motion without continuity is just a new subject.
>
> **الحدّ الأدنى.** `minScore + 0.12` — this detector is held to a stricter bar
> than the other seven, because seams are plentiful and most are unremarkable.
>
> **المخرَج.** A `Discovery` whose `evidence` carries `من`, `إلى`,
> `حركة المحور`, `تغيّر الزمن`, and the binding roots themselves — so the reader
> is shown the stitching, not told about it.
>
> — حجّة: `src/lib/engine/detectors.ts:382-417`, `src/lib/isnad.ts:129-182`,
>   `scripts/verify-exemplars.ts` (28:5 pins this detector at score 0.535,
>   root `أرض` crossing the seam)
> — حدّ: this covers scoring only. It does not cover `dedupe()`
>   (`detectors.ts:640`), which decides which of several overlapping رِباط
>   findings survives; nor the runtime tuning path
>   (`isnaad://module/data.server#optionsFromQuery`). The 8-word window is
>   fixed-width and has no linguistic justification beyond having worked on the
>   three exemplars — a seam whose relevant material sits nine words away is
>   invisible to it.

---

## 5 · The layers — عشر طبقات

Ask `FIHRIS` on any of these to get its modules.

| layer | | what lives there |
|---|---|---|
| `asl` | الأصل | ingestion: two open sources → `/data`. 6 modules |
| `sarf` | الصرف | morphology and the core shapes. 3 |
| `isnad` | الإسناد | the attribution model itself. 1 |
| `istinbat` | الاستنباط | the eight detectors, quotation frames, closed lexicons. 3 |
| `tadin` | التعدين | global mining: suffix automaton, declarative markers. 3 |
| `khariita` | الخريطة | the muṣḥaf as a space: resonance, the walk, placement, time. 3 |
| `talif` | التأليف | authoring: marker → برج → composition. 3 |
| `khidma` | الخدمة | the server boundary: caches, clamped thresholds, 13 routes. 16 |
| `mashhad` | المشهد | surfaces: studio, WebGL cosmos, الفرقان player, الاستعاذة. 24 |
| `lisan` | اللسان | the Arabic-facing vocabulary: labels, colours, Eastern numerals. 4 |

---

## 6 · The invariants — الثوابت

Twelve rules the codebase is not allowed to break. Each carries, in
`docs/fihris.json`, a statement, the cost of breaking it, and citations checked
on every build. Several are recorded because they *were* broken:

| id | rule |
|---|---|
| `spine-before-vector` | resolve every word's isnād spine before aggregating over it — computing them in one pass silently yielded 6,236 empty signatures |
| `subject-vs-reference` | a person tag is not attribution |
| `proximity-axis` | المخاطب `0`, المتكلم `0.5`, الغائب `1` — discourse distance, not person ordering |
| `three-exemplars` | if a change stops finding هود ٢٩، ق ٢، القصص ٤–٥, the change is wrong |
| `no-interpretation` | detectors report structure; the engine never becomes tafsīr |
| `no-translation` | the application is Arabic only, by design |
| `one-source-of-truth` | `/data` holds raw corpus + mined indices only; the rest rebuilds in ~80 ms |
| `render-time-text` | a composition stores loci, never rendered text |
| `declared-lemma-must-match` | a declared lemma matching nothing fails the build — `كُلَّمَا` once matched zero because Arabic diacritics have no canonical order |
| `id-path-safety` | a composition id arrives from a URL and becomes a filename |
| `optional-postgres` | the studio runs fully without Supabase |
| `thresholds-at-the-edge` | detector thresholds are query parameters, not baked data |

---

## 7 · Curricula — المناهج

Eight ordered study routes. Each is a **literal sequence of FIHRIS/1 requests**
with a stated reason for its position; each names the understanding it produces.
Send them in order.

| curriculum | produces |
|---|---|
| `mabda` | you can say what the project claims, what it refuses to claim, and where any number came from |
| `isnad` | you can decide, for any segment, whether it seats a referent or merely references one |
| `istinbat` | you can read any `Discovery`, reproduce its score, and separate measurement from threshold |
| `tadin` | you can say why a suffix automaton was the right instrument, and why a marker is not a keyword search |
| `khariita` | you can say what makes two āyāt neighbours here, and why the walk refuses to repeat an operation |
| `talif` | you can compose, store and play a recitation, and say what is stored and what is not |
| `khidma` | you can add an endpoint without breaking the fresh-clone guarantee |
| `tawsia` | you can add a detector, marker or modality and know what to rebuild and what must still pass |

The full request sequences are in `docs/fihris.json` under `curricula`.

---

## 8 · Cold start

Paste this to the agent that holds the codebase:

```
I am an agentic computational universalist studying مرصد الإسناد.
I will address you over FIHRIS/1 as specified in docs/FIHRIS.md.
Load docs/fihris.json as the authoritative index; treat any address
that does not appear in it as unresolvable.
Honour the six response obligations, ending every answer with حجّة and حدّ.
Begin by running isnaad://curriculum/mabda, one request at a time,
and stop after each for my questions.
```

---

## 9 · Keeping this honest

The فهرس is derived, validated and checkable:

- `scripts/build-fihris.ts` extracts every export, its kind, its line and the
  comment above it, directly from the tree.
- On every build it checks that each invariant citation still resolves, that
  each vocabulary id still appears in its declared source, that every annotated
  module still exists, and that no library or script is unclassified. Any
  failure exits non-zero: **الفهرس يدّعي ما ليس في الشجرة**.
- `npm run fihris:check` fails if the committed فهرس has drifted from the tree —
  suitable for CI beside `npm run verify`.

What this protocol does **not** do: it does not execute anything, does not read
the Qur'anic text for you, and does not rank the importance of what it indexes.
It tells you what exists, what each thing is for, what it refuses to do, and in
what order to learn it.

> استنباط آلي — it points at where to look. It does not interpret.
