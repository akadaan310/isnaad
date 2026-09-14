// ============================================================================
//  الرِّحلة — travel without end, over a field that is not endless.
//
//  The muṣḥaf is finite and the placed field is 1,000 āyāt. Nothing here
//  fabricates more, and nothing tiles or repeats the text to fake extent. What
//  is genuinely without end is the *walk*: every āyah opens seven سنابل, and
//  each of those opens seven more, so a traversal has no terminal state. That
//  is the sense in which this is infinite, and it is the text's own sense —
//  حَبَّةٍ أَنۢبَتَتْ سَبْعَ سَنَابِلَ.
//
//  The steering idea: the traveller does not choose an āyah, they choose a
//  *heading*. Among the relations leaving the āyah they are on, the one whose
//  direction best matches that heading is where they arrive. So the hand sets
//  the bearing and the text decides what lies along it — which is the whole
//  thesis of the field, made into a control.
// ============================================================================
import type { CosmosNode } from './types';
import type { Strand } from './strands';

export interface Course {
  /** The āyah being left. */
  from: number;
  /** The āyah being approached. */
  to: number;
  /** What relation carries this leg — the reason the journey went this way. */
  via: Strand | null;
  /** سنابل branch index, when the leg is a branch rather than a strand. */
  branch: number | null;
}

export interface VoyageOptions {
  /** How strongly the traveller's heading biases the choice, 0…1. */
  steerWeight: number;
  /** Legs remembered, so a journey does not immediately double back. */
  memory: number;
}

export const DEFAULT_VOYAGE: VoyageOptions = { steerWeight: 0.72, memory: 24 };

/** Candidate legs out of an āyah: its seven branches, plus any drawn relation. */
export function legsFrom(
  node: CosmosNode,
  strandsByNode: Map<number, Strand[]>,
): { to: number; via: Strand | null; branch: number | null; weight: number }[] {
  const out: { to: number; via: Strand | null; branch: number | null; weight: number }[] = [];

  node.sb.forEach((j, branch) => {
    if (j === node.i) return;
    // السنابل are transport, not evidence — they carry the walk and are given
    // no more weight than that.
    out.push({ to: j, via: null, branch, weight: 0.45 - branch * 0.03 });
  });

  for (const s of strandsByNode.get(node.i) ?? []) {
    const other = s.a === node.i ? s.b : s.a;
    if (other === node.i) continue;
    out.push({ to: other, via: s, branch: null, weight: s.weight });
  }
  return out;
}

/**
 * Choose the next leg. Alignment with the traveller's heading is the dominant
 * term; relation weight breaks ties and decides when the hand is still.
 *
 * `heading` and the node positions must be in the same space.
 */
export function chooseLeg(
  node: CosmosNode,
  positions: Float32Array,
  heading: { x: number; y: number; z: number },
  strandsByNode: Map<number, Strand[]>,
  visited: readonly number[],
  opt: VoyageOptions = DEFAULT_VOYAGE,
): Course | null {
  const legs = legsFrom(node, strandsByNode);
  if (!legs.length) return null;

  const recent = new Set(visited.slice(-opt.memory));
  const ox = positions[node.i * 3];
  const oy = positions[node.i * 3 + 1];
  const oz = positions[node.i * 3 + 2];
  const hl = Math.hypot(heading.x, heading.y, heading.z) || 1;

  let best: Course | null = null;
  let bestScore = -Infinity;

  for (const leg of legs) {
    const dx = positions[leg.to * 3] - ox;
    const dy = positions[leg.to * 3 + 1] - oy;
    const dz = positions[leg.to * 3 + 2] - oz;
    const dl = Math.hypot(dx, dy, dz);
    if (dl < 1e-3) continue;

    // −1 … 1, how far in front of the traveller this āyah lies.
    const align = (dx * heading.x + dy * heading.y + dz * heading.z) / (dl * hl);
    let score = opt.steerWeight * align + (1 - opt.steerWeight) * leg.weight;
    // A journey that immediately returns is not a journey. This is a penalty,
    // never a prohibition: a field this size would otherwise dead-end.
    if (recent.has(leg.to)) score -= 0.55;

    if (score > bestScore) {
      bestScore = score;
      best = { from: node.i, to: leg.to, via: leg.via, branch: leg.branch };
    }
  }
  return best;
}

/** Why the journey went this way, in the engine's own words. */
const AR_DIGIT = ['١', '٢', '٣', '٤', '٥', '٦', '٧'];

export function legReason(course: Course): string {
  if (course.branch !== null) {
    return `سُنبلة ${AR_DIGIT[course.branch] ?? ''}`;
  }
  const e = course.via?.evidence;
  if (!e) return 'سُنبلة';
  switch (e.kind) {
    case 'motif':
      return `مثاني ${e.pattern}`;
    case 'root':
      return `جذر «${e.root}»`;
    case 'discovery':
      return e.title;
    case 'resonance':
      return e.reason;
    case 'sunbula':
      return `سُنبلة ${AR_DIGIT[e.branch] ?? ''}`;
  }
}

/** Index strands by the nodes they touch, once per field. */
export function indexStrands(strands: readonly Strand[]): Map<number, Strand[]> {
  const m = new Map<number, Strand[]>();
  const push = (n: number, s: Strand) => {
    const list = m.get(n);
    if (list) list.push(s);
    else m.set(n, [s]);
  };
  for (const s of strands) {
    push(s.a, s);
    push(s.b, s);
  }
  return m;
}
