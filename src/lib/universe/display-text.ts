// ============================================================================
//  عرض النص — a display-only substitution, recorded rather than hidden.
//
//  data/corpus/meta.json (risan/quran-json) writes the open, sequential
//  dammatan as U+065E ARABIC FATHA WITH TWO DOTS — 1,807 times in 1,241 āyāt,
//  always on a nominative tanwīn (عَظِيمٞ، مَّرَضٞ، قَدِيرٞ). The self-hosted
//  Amiri Quran subset has no glyph for U+065E and draws a missing-glyph box;
//  it does have U+08F1 ARABIC OPEN DAMMATAN, the codepoint Unicode assigns to
//  that mark.
//
//  This maps one to the other at render time only. The stored text is never
//  changed, the mapping is one codepoint, and it is an inference about the
//  source's convention — docs/studio/USABILITY.md asks a reader of the muṣḥaf
//  to confirm it before it is applied anywhere else in the app.
// ============================================================================

export const OPEN_DAMMATAN_SOURCE = 'ٞ';
export const OPEN_DAMMATAN_UNICODE = 'ࣱ';

export function displayUthmani(text: string): string {
  return text.replaceAll(OPEN_DAMMATAN_SOURCE, OPEN_DAMMATAN_UNICODE);
}
