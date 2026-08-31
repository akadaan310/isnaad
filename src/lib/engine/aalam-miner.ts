// ============================================================================
//  Resolving أعلام specs against an assembled sūrah.
//
//  Every clause of a spec narrows: lemma or root gives the candidate, case and
//  definiteness filter it, a phrase requires the next stems to follow in order,
//  and coRoots requires company inside the same āyah. A spec with none of those
//  matches nothing, deliberately — a marker that cannot say what it is looking
//  for should return no hits rather than everything.
// ============================================================================
import type { Ayah, Surah, Word } from '../types';
import type { AlamHit, AlamSpec } from '../aalam';

/** Stems only: a clitic ال or و is never what a marker is naming. */
function stemsOf(w: Word) {
  return w.segments.filter((s) => !s.clitic);
}

function ayahRoots(surah: Surah, a: Ayah): Set<string> {
  const set = new Set<string>();
  for (const w of surah.words.slice(a.from, a.to)) {
    for (const s of w.segments) if (s.root) set.add(s.root);
  }
  return set;
}

/**
 * Does the run of words starting at `idx` carry `phrase`'s lemmas in order?
 * Matching is per word, not per segment, so مِّنْهُمْ counts as the word that
 * carries مِن even though the pronoun rides on the same token.
 */
function phraseMatches(words: Word[], idx: number, phrase: string[][]): boolean {
  for (let k = 0; k < phrase.length; k++) {
    const w = words[idx + k];
    if (!w) return false;
    if (!w.segments.some((s) => s.lemma && phrase[k].includes(s.lemma))) return false;
  }
  return true;
}

export function mineAlam(spec: AlamSpec, surah: Surah): AlamHit[] {
  const { match } = spec;
  const hits: AlamHit[] = [];
  const seen = new Set<number>();

  // Hand-named loci are taken as given; they anchor the first word of the āyah.
  if (match.loci) {
    for (const [s, a] of match.loci) {
      if (s !== surah.id) continue;
      const ayah = surah.ayaat.find((x) => x.n === a);
      if (ayah) hits.push({ surah: s, ayah: a, word: ayah.from, form: surah.words[ayah.from]?.text ?? '' });
    }
  }

  const hasPattern = !!(match.lemmas || match.roots || match.phrase);
  if (!hasPattern) return hits;

  const ayahOf = new Map<number, Ayah>();
  for (const a of surah.ayaat) for (let i = a.from; i < a.to; i++) ayahOf.set(i, a);

  for (const w of surah.words) {
    if (seen.has(w.idx)) continue;
    const stems = stemsOf(w);
    if (!stems.length) continue;

    const anchor = stems.find((s) => {
      if (match.lemmas && (!s.lemma || !match.lemmas.includes(s.lemma))) return false;
      if (match.roots && (!s.root || !match.roots.includes(s.root))) return false;
      if (match.phrase && (!s.lemma || !match.phrase[0].includes(s.lemma))) return false;
      if (match.excludeRoots && s.root && match.excludeRoots.includes(s.root)) return false;
      if (match.cls && s.cls !== match.cls) return false;
      if (match.gcase && s.gcase !== match.gcase) return false;
      if (match.indef !== undefined && !!s.indef !== match.indef) return false;
      return true;
    });
    if (!anchor) continue;

    if (match.phrase && !phraseMatches(surah.words, w.idx, match.phrase)) continue;

    const ayah = ayahOf.get(w.idx);
    if (!ayah) continue;

    if (match.coRoots?.length) {
      const roots = ayahRoots(surah, ayah);
      if (!match.coRoots.every((r) => roots.has(r))) continue;
    }

    seen.add(w.idx);
    hits.push({ surah: surah.id, ayah: ayah.n, word: w.idx, form: anchor.form });
  }

  return hits;
}
