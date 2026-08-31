// ============================================================================
//  Quotation frames and the nested attribution tree.
//
//  A frame opens at a verb of saying. Whether a later verb of saying *nests*
//  inside it or *replaces* it is the whole difference between a dialogue and a
//  speech-within-a-speech, and the corpus marks no quotation boundaries at all.
//  The rule used here reads the verb's own inflection:
//
//    A third-person verb (قَالَ، قَالُوا، يَقُولُ) is the narrator reporting,
//    and an imperative (قُلْ) is the narrator commanding the addressee to
//    speak. Both are narrator-level acts: they close whatever was open and
//    start a sibling frame.
//
//    A first- or second-person non-imperative (قُلْتَ، قُلْتُ، أَقُولُ) cannot
//    be the narrator reporting, so it is already inside someone's speech and
//    nests one level deeper.
//
//  That test recovers the genuinely deep cases - 5:116, where Allah quotes
//  Isa being asked what he told the people - without the runaway chains that
//  treating every قُلْ as nested would produce.
// ============================================================================
import type { Ayah, Person, Word } from '../types';
import { QAWL_STRICT } from '../isnad';
import { RUSUL_LEMMAS, QASAS_ACTORS } from '../lexicon';

export interface Frame {
  id: string;
  /** Word index of the verb of saying that opened the frame. */
  open: number;
  /** Quoted span, inclusive. */
  from: number;
  to: number;
  ayahFrom: number;
  ayahTo: number;
  depth: number;
  parent: string | null;
  children: string[];
  speaker: {
    label: string;
    person: Person;
    num: string | null;
    gender: string | null;
    /**
     * `noun`    - an explicit nominative فاعل followed the verb.
     * `context` - the nearest preceding proper noun, inferred.
     * `verb`    - only the verb's own person was available.
     */
    source: 'noun' | 'context' | 'verb';
  };
  /** true where the frame ran past the ayah that opened it. */
  continued: boolean;
}

/** How far a frame may run past the ayah that opened it. */
const MAX_CONTINUATION = 6;
/**
 * Hard ceiling on nesting. Speech reported inside speech inside speech is real
 * but rare; anything past this is the heuristic compounding its own errors, so
 * the frame is treated as a sibling instead.
 */
const MAX_NESTING = 4;

function qawlSegment(w: Word) {
  return w.segments.find((s) => s.cls === 'V' && s.root && QAWL_STRICT.has(s.root));
}

/** A named actor carried by a word, if it is one the قصص tracks. */
function namedActor(w: Word): string | undefined {
  for (const s of w.segments) {
    if (s.clitic || !s.lemma) continue;
    const named = RUSUL_LEMMAS[s.lemma] ?? QASAS_ACTORS[s.lemma];
    if (named) return named;
  }
  return undefined;
}

/** Name the sayer: an explicit nominative فاعل, else the nearest named actor. */
function resolveSpeaker(words: Word[], verbIdx: number, end: number): Frame['speaker'] {
  const verb = words[verbIdx];
  const vSeg = qawlSegment(verb)!;

  for (let i = verbIdx + 1; i <= Math.min(end, verbIdx + 3); i++) {
    const w = words[i];
    const stem = w.segments.find((s) => !s.clitic && s.cls === 'N');
    if (!stem) continue;
    if (stem.gcase !== 'NOM') break;
    return {
      label: namedActor(w) ?? w.text,
      person: 3,
      num: stem.num ?? null,
      gender: stem.gender ?? null,
      source: 'noun',
    };
  }

  // No explicit subject: fall back to the nearest named actor behind the verb.
  // Reported as `context` so the UI can mark it as inferred rather than read.
  for (let i = verbIdx - 1; i >= Math.max(0, verbIdx - 14); i--) {
    const named = namedActor(words[i]);
    if (named) {
      return {
        label: named,
        person: vSeg.person ?? 3,
        num: vSeg.num ?? null,
        gender: vSeg.gender ?? null,
        source: 'context',
      };
    }
  }

  return {
    label: verb.text,
    person: vSeg.person ?? 3,
    num: vSeg.num ?? null,
    gender: vSeg.gender ?? null,
    source: 'verb',
  };
}

/**
 * The quoted content starts after the sayer and after a `لـ` addressee phrase
 * (قال لهم), i.e. after the complements the verb of saying governs.
 */
function quoteStart(words: Word[], verbIdx: number, end: number): number {
  let i = verbIdx + 1;
  while (i <= end) {
    const w = words[i];
    const stem = w.segments.find((s) => !s.clitic);
    if (!stem) break;
    const startsWithLam = w.segments.some((s) => s.clitic && s.tag === 'P' && s.lemma === 'ل');
    const nominativeSubject = stem.cls === 'N' && stem.gcase === 'NOM' && stem.tag !== 'DEM';
    if (startsWithLam || nominativeSubject) i++;
    else break;
  }
  return Math.min(i, end);
}

export function buildFrames(words: Word[], ayaat: Ayah[]): Frame[] {
  const frames: Frame[] = [];
  let stack: Frame[] = [];
  let carry = 0;

  for (const a of ayaat) {
    const opens: number[] = [];
    for (let i = a.from; i < a.to; i++) if (qawlSegment(words[i])) opens.push(i);

    if (opens.length === 0) {
      // No reporting verb here: let the open frames run on, within the cap.
      if (stack.length && carry < MAX_CONTINUATION) {
        for (const f of stack) {
          f.to = a.to - 1;
          f.ayahTo = a.n;
          f.continued = true;
        }
        carry++;
      } else {
        stack = [];
        carry = 0;
      }
      continue;
    }

    carry = 0;
    for (const openIdx of opens) {
      const vSeg = qawlSegment(words[openIdx])!;
      // Only a first- or second-person non-imperative can be speech inside
      // speech; third person is narration and قُلْ is a command to narrate.
      const embedded = (vSeg.person === 1 || vSeg.person === 2) && vSeg.tense !== 'IMPV';
      const nests = embedded && stack.length > 0 && stack.length < MAX_NESTING;

      if (!nests) {
        for (const f of stack) if (f.to >= openIdx) f.to = openIdx - 1;
        stack = [];
      }

      const parent = stack.length ? stack[stack.length - 1] : null;
      const end = parent ? Math.min(parent.to, a.to - 1) : a.to - 1;
      const frame: Frame = {
        id: `f${openIdx}`,
        open: openIdx,
        from: quoteStart(words, openIdx, end),
        to: end,
        ayahFrom: a.n,
        ayahTo: a.n,
        depth: parent ? parent.depth + 1 : 0,
        parent: parent?.id ?? null,
        children: [],
        speaker: resolveSpeaker(words, openIdx, end),
        continued: false,
      };
      if (parent) parent.children.push(frame.id);
      frames.push(frame);
      stack.push(frame);
    }
  }

  // A frame that never received content is noise, not speech.
  return frames.filter((f) => f.to >= f.from);
}

/** Stamp each word with the depth of the innermost frame containing it. */
export function applyDepth(words: Word[], frames: Frame[]): void {
  for (const w of words) w.depth = 0;
  for (const f of frames) {
    for (let i = f.from; i <= f.to && i < words.length; i++) {
      if (f.depth + 1 > words[i].depth) words[i].depth = f.depth + 1;
    }
  }
}

/** The innermost frame containing a word, if any. */
export function frameAt(frames: Frame[], idx: number): Frame | undefined {
  let best: Frame | undefined;
  for (const f of frames) {
    if (idx >= f.from && idx <= f.to && (!best || f.depth > best.depth)) best = f;
  }
  return best;
}

export function maxDepth(frames: Frame[]): number {
  return frames.reduce((m, f) => Math.max(m, f.depth + 1), 0);
}
