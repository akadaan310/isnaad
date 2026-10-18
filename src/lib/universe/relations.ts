// ============================================================================
//  روابط الكون الكامل — relations the engine already computed, over all 6,236.
//
//  Four families, each a different computation, each carrying its evidence:
//
//    tartib     muṣḥaf adjacency. Not a finding; it is the order of the text,
//               and it is what a reader would walk if nothing else were drawn.
//    root       two āyāt share a rare root (2–24 loci in the whole muṣḥaf).
//               Weighted by inverse locus frequency, top `rootPerAyah` per āyah.
//    motif      consecutive occurrences of one mined مثاني contour, in muṣḥaf
//               order — a chain, never a clique (see cosmos/strands.ts).
//    discovery  a detector finding whose span crosses an āyah boundary.
//
//  Nothing is inferred here. Every link is a count or an index the ingest and
//  the detectors already wrote; this module only joins them to ordinals.
// ============================================================================
import type { Discovery, Motif } from '../types';
import type { RootIndex } from '../engine/graph';
import type { UniverseLinkKind, UniverseRelations } from './types';

export const LINK_KINDS: UniverseLinkKind[] = ['tartib', 'root', 'motif', 'discovery'];

export interface RelationOptions {
  rootMin: number;
  rootMax: number;
  rootPerAyah: number;
}

export const DEFAULT_RELATIONS: RelationOptions = { rootMin: 2, rootMax: 24, rootPerAyah: 3 };

export type OrdinalOf = (surah: number, ayah: number) => number | undefined;

export function buildRelations(
  n: number,
  ordinal: OrdinalOf,
  roots: RootIndex,
  motifs: readonly Motif[],
  discoveries: readonly Discovery[],
  opt: RelationOptions = DEFAULT_RELATIONS,
): UniverseRelations {
  const evidence: string[] = [];
  const evIndex = new Map<string, number>();
  const ev = (s: string) => {
    let i = evIndex.get(s);
    if (i === undefined) {
      i = evidence.length;
      evidence.push(s);
      evIndex.set(s, i);
    }
    return i;
  };

  // Keyed by (a,b,kind) so a pair can carry one link per family, and the
  // strongest evidence within a family wins.
  const links = new Map<string, [number, number, number, number, number]>();
  const put = (x: number, y: number, kind: UniverseLinkKind, weight: number, e: string) => {
    if (x === y) return;
    const a = Math.min(x, y);
    const b = Math.max(x, y);
    const k = LINK_KINDS.indexOf(kind);
    const key = `${a}:${b}:${k}`;
    const w = Math.round(Math.max(0, Math.min(1, weight)) * 1000);
    const prev = links.get(key);
    if (!prev || prev[3] < w) links.set(key, [a, b, k, w, ev(e)]);
  };

  for (let k = 0; k + 1 < n; k++) put(k, k + 1, 'tartib', 0.3, 'ترتيب المصحف');

  // Roots: idf-weighted overlap, kept to the strongest few per āyah.
  const maxIdf = Math.log(n / opt.rootMin);
  const share = new Map<number, Map<number, { w: number; roots: string[] }>>();
  for (const [root, places] of Object.entries(roots)) {
    const loci = [...new Set(places.map(([s, a]) => ordinal(s, a)).filter((x): x is number => x !== undefined))];
    if (loci.length < opt.rootMin || loci.length > opt.rootMax) continue;
    const idf = Math.log(n / loci.length) / maxIdf;
    for (const i of loci) {
      let m = share.get(i);
      if (!m) share.set(i, (m = new Map()));
      for (const j of loci) {
        if (i === j) continue;
        const cur = m.get(j);
        if (cur) {
          cur.w += idf;
          cur.roots.push(root);
        } else m.set(j, { w: idf, roots: [root] });
      }
    }
  }
  for (const [i, m] of share) {
    const best = [...m.entries()].sort((x, y) => y[1].w - x[1].w || x[0] - y[0]).slice(0, opt.rootPerAyah);
    for (const [j, { w, roots: rs }] of best) {
      put(i, j, 'root', Math.min(1, w / 2), rs.sort().join('، '));
    }
  }

  for (const m of motifs) {
    const chain = [
      ...new Set(m.occurrences.map((o) => ordinal(o.surah, o.ayah)).filter((x): x is number => x !== undefined)),
    ].sort((x, y) => x - y);
    const w = Math.min(1, 0.25 + m.length * 0.08);
    for (let t = 0; t + 1 < chain.length; t++) put(chain[t], chain[t + 1], 'motif', w, m.pattern);
  }

  for (const d of discoveries) {
    if (d.ayahFrom === d.ayahTo) continue;
    const a = ordinal(d.surah, d.ayahFrom);
    const b = ordinal(d.surah, d.ayahTo);
    if (a === undefined || b === undefined) continue;
    put(a, b, 'discovery', d.score, d.title);
  }

  const out = [...links.values()].sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
  return { version: 1, kinds: LINK_KINDS, evidence, links: out };
}

export interface Leg {
  to: number;
  kind: UniverseLinkKind;
  weight: number;
  evidence: string;
}

/** Adjacency by ordinal, built once on the client. */
export function indexRelations(rel: UniverseRelations, n: number): Leg[][] {
  const adj: Leg[][] = Array.from({ length: n }, () => []);
  for (const [a, b, k, w, e] of rel.links) {
    const kind = rel.kinds[k];
    const evidence = rel.evidence[e];
    adj[a].push({ to: b, kind, weight: w / 1000, evidence });
    adj[b].push({ to: a, kind, weight: w / 1000, evidence });
  }
  for (const list of adj) list.sort((x, y) => x.to - y.to || x.kind.localeCompare(y.kind));
  return adj;
}
