// ============================================================================
//  The strand wire format.
//
//  A chain restates one relation over many links: a motif in twenty-seven
//  segments carries the same pattern and gloss twenty-seven times. On the wire
//  and in the browser's heap that is pure duplication, so evidence is interned
//  once and referenced by index.
//
//  Both sides import this, which is the point — there is no second definition
//  of the format to drift out of step.
// ============================================================================
import type { Strand, StrandEvidence, StrandKind } from './strands';

/** Order is the format. Appending is safe; reordering is not. */
export const WIRE_KINDS: StrandKind[] = ['sunbula', 'motif', 'root', 'discovery', 'resonance'];

/** `[id, a, b, kindIndex, weight, evidenceIndex]` */
export type PackedStrand = [string, number, number, number, number, number];

export interface PackedStrands {
  evidence: StrandEvidence[];
  strands: PackedStrand[];
}

export function packStrands(strands: readonly Strand[]): PackedStrands {
  const evidence: StrandEvidence[] = [];
  const seen = new Map<string, number>();
  const packed: PackedStrand[] = strands.map((s) => {
    const k = JSON.stringify(s.evidence);
    let ei = seen.get(k);
    if (ei === undefined) {
      ei = evidence.length;
      seen.set(k, ei);
      evidence.push(s.evidence);
    }
    return [s.id, s.a, s.b, WIRE_KINDS.indexOf(s.kind), Math.round(s.weight * 1e4) / 1e4, ei];
  });
  return { evidence, strands: packed };
}

export function unpackStrands(p: PackedStrands): Strand[] {
  return p.strands.map(([id, a, b, k, weight, ei]) => ({
    id,
    a,
    b,
    kind: WIRE_KINDS[k],
    weight,
    evidence: p.evidence[ei],
  }));
}
