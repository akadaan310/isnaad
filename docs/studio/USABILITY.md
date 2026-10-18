# Usability record

Failures, not just happy paths. Everything here was **observed in screenshots
from scripted runs on simulated devices**. The phone is a 393×852 viewport at
DPR 2.75 with touch; the desktop is 1440×900. **No human first-time user has
used the studio yet**, so O3 is only partly met until one does.

Script: `tests/browser/studio.mjs`, currently 32/32 on the production build
behind the access gate. Screenshots: `evidence/studio/`.

## Observed failures

| # | where | what was wrong | status |
|---|---|---|---|
| U1 | phone, top | The lens statement sat at a fixed offset and collided with the lens tabs and search field, leaving half-sentences peeking out | **fixed**: moved above the dock |
| U2 | inspector | Latin digits inside Arabic prose («42٪», «0.63») next to Arabic-Indic ones | **fixed**: `arabicNumber` / `arabicDecimal` |
| U3 | phone, inspector | Covered about 80% of the screen and the voyage caption, with no way to shrink it | **fixed**: «اطوِ/افتح» toggle; collapses on its own while a voyage runs on narrow screens; reopens on a manual selection |
| U4 | phone, dock | 12 buttons do not fit; the leftmost (المسجّل، تسليم) were cut off with no hint the bar scrolls | **mitigated**: fade at the scroll edge. **Open**: a second row or an overflow menu would be better |
| U5 | inspector text | **Missing-glyph box in 1,241 āyāt.** The risan Uthmani uses U+065E for open dammatan 1,807 times; the self-hosted Amiri Quran subset (128 codepoints) has no glyph for it, though it has U+08F1 OPEN DAMMATAN | **fixed in /universe** with a display-only mapping (`lib/universe/display-text.ts`). **Pre-existing in the legacy views** that set `.uthmani` in the Quran face: the reader's muṣḥaf mode, the الفرقان player, the composer. Left untouched there pending confirmation (blocker B4) |
| U6 | first launch | The faint muṣḥaf thread zig-zags between radius shells and, seen from outside, read as a starburst that hid the āyāt | **fixed**: thread at 18% opacity |
| U7 | tour | The card overlapped the lens statement; the counter used Latin digits | **fixed** |
| U8 | phone, collapsed inspector | A tall pause mark (U+06D6 ۖ, in الإسراء ١٠١) leaked below the collapsed box | **fixed**: body hidden, not clipped |

## Suspected, not yet tested

- **Tour pace.** Ten seconds per station, but stations run 35–45 Arabic words,
  which may be too fast to read. Each station can be held («أمهِل», added after
  this was noticed; WCAG 2.2.1), advanced or skipped, but only a person can say
  whether the default pace works.
- **Opaque codes.** «الكنتور: 1231» and the motif patterns («3p.3p.1p.1p»)
  are the engine's own notation, shown verbatim. They are correct but
  unexplained to a non-engineer.
- **Touch picking** chooses the nearest projected āyah within 30 px. It has not
  been tried with a real finger on a dense region.

## Mistakes in the test itself, recorded

- The first handoff check expected 50:2, but the handoff correctly carried the
  āyah focused at link time, where the voyage had moved (الإسراء ١٠١). The
  check now compares against the locus named in the incoming banner.

## For the first human session

Hand the phone over at `/universe` with no instructions, and note where they
hesitate, what they tap expecting a response, and whether they reach
"افحص آية" unaided. Add the notes here as U9 onward.
