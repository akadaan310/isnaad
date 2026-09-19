// ============================================================================
//  /api/cosmos/convergence — where you are, and where the relations lead.
//
//  One request answers both halves of a step: the position the reader occupies
//  stated in the field's own computed terms, and the destinations more than one
//  independent family of relation agrees on. Following one is the same call
//  again with the destination as the anchor, which is the whole navigation
//  model — there is no index, no listing and nothing to pick from.
//
//  Built server-side for the reason /api/cosmos/strands is: the relation graph
//  needs 2.3 MB of mined indices to exist. It is assembled once per process;
//  only الرنين is per-request, because resonance is ranked *against* an anchor
//  and does not exist until there is one.
//
//  With no سورة/آية the anchor is computed rather than defaulted — see
//  `computedOrigin`. A first position has to come from somewhere, and a list to
//  choose from is the menu this surface exists to do without.
// ============================================================================
import { NextResponse } from 'next/server';
import {
  getAyahIndex,
  getCosmos,
  getMotifs,
  getRootIndex,
  getTopDiscoveries,
} from '@/lib/data.server';
import { buildLocusJoin, type LocusJoin } from '@/lib/cosmos/locus';
import {
  discoveryStrands,
  motifStrands,
  resonanceStrands,
  ribatVectors,
  rootStrands,
  type RibatVector,
  type Strand,
} from '@/lib/cosmos/strands';
import {
  buildRelationIndex,
  computedOrigin,
  convergenceAt,
  DEFAULT_CONVERGENCE,
  type Convergence,
  type ConvergenceReport,
  type RelationIndex,
  type Route,
} from '@/lib/cosmos/convergence';
import { findResonance } from '@/lib/engine/graph';
import type { CosmosNode } from '@/lib/cosmos/types';

export const dynamic = 'force-dynamic';

/** What a destination shows before you have gone there. */
interface NodeBrief {
  i: number;
  s: number;
  a: number;
  name: string;
  text: string;
  /** Proximity axis: 0 = المخاطب … 1 = الغائب. */
  d: number;
  /** The isnād mix — the share of attribution at each person. */
  v: [number, number, number];
  sig: string;
  con: string;
  conAr: string;
  k: string | null;
  note: string | null;
  tm: number[];
}

const brief = (n: CosmosNode): NodeBrief => ({
  i: n.i,
  s: n.s,
  a: n.a,
  name: n.name,
  text: n.text,
  d: n.d,
  v: n.v,
  sig: n.sig,
  con: n.con,
  conAr: n.conAr,
  k: n.k,
  note: n.note,
  tm: n.tm,
});

interface Field {
  nodes: CosmosNode[];
  join: LocusJoin;
  /** Everything but الرنين, which is anchored and so is built per request. */
  strands: Strand[];
  index: RelationIndex;
  ribat: RibatVector[];
  origin: { node: number; converging: number; strength: number } | null;
}

let field: Promise<Field> | null = null;

function loadField(): Promise<Field> {
  return (field ??= (async () => {
    const [cosmos, motifs, roots, discoveries] = await Promise.all([
      getCosmos(),
      getMotifs(),
      getRootIndex(),
      getTopDiscoveries(),
    ]);
    const nodes = cosmos.nodes;
    const join = buildLocusJoin(nodes);
    const strands = [
      ...motifStrands(motifs, join),
      ...rootStrands(roots, join),
      ...discoveryStrands(discoveries, join),
    ];
    const index = buildRelationIndex(strands);
    return {
      nodes,
      join,
      strands,
      index,
      ribat: ribatVectors(discoveries, join),
      origin: computedOrigin(nodes.length, index),
    };
  })());
}

/** A convergence or route, with its destination resolved to an āyah. */
const placeConvergence = (c: Convergence, nodes: CosmosNode[]) => ({ ...c, to: brief(nodes[c.node]) });
const placeRoute = (r: Route, nodes: CosmosNode[]) => ({
  ...r,
  to: brief(nodes[r.node]),
  through: brief(nodes[r.via]),
});

export async function GET(req: Request) {
  let f: Field;
  try {
    f = await loadField();
  } catch {
    return NextResponse.json(
      { error: 'لم يُبنَ الكون بعد — شغّل npm run ingest:cosmos' },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const rawSurah = url.searchParams.get('surah');
  const rawAyah = url.searchParams.get('ayah');
  const asked = rawSurah !== null || rawAyah !== null;

  let anchor: number | undefined;
  if (asked) {
    const surah = Number(rawSurah);
    const ayah = Number(rawAyah);
    if (!Number.isInteger(surah) || !Number.isInteger(ayah)) {
      return NextResponse.json({ error: 'يلزم تحديد السورة والآية' }, { status: 400 });
    }
    anchor = f.join.at(surah, ayah);
    if (anchor === undefined) {
      // The field holds 1,000 of the 6,236 āyāt. An āyah outside it is not an
      // error in the request, and saying so plainly is the only honest answer.
      return NextResponse.json(
        { error: 'هذه الآية ليست من الألف الموضوعة في الحقل', placed: false },
        { status: 404 },
      );
    }
  } else {
    anchor = f.origin?.node;
    if (anchor === undefined) {
      return NextResponse.json({ error: 'لا يلتقي في هذا الحقل شيء' }, { status: 503 });
    }
  }

  const here = f.nodes[anchor];

  // ── الرنين ────────────────────────────────────────────────────────────────
  // Ranked against this anchor over all 6,236 āyāt, then joined back to the
  // placed field. It is a genuine computation per request, not a lookup, and
  // it is the one family that could not have been in the resident graph.
  let resonant: Strand[] = [];
  try {
    const ayaat = await getAyahIndex();
    const { matches } = findResonance(ayaat, here.s, here.a, 40);
    resonant = resonanceStrands(anchor, matches, f.join);
  } catch {
    // The report is still true without it; the client is told which families
    // were in the graph rather than being left to assume all four were.
    resonant = [];
  }

  // الرنين joins the resident groups rather than replacing them. Rebuilding the
  // index costs a pass over ~3,400 relations, which is cheaper than holding a
  // per-anchor index and far cheaper than being wrong about which groups exist.
  const index = resonant.length
    ? buildRelationIndex([...f.strands, ...resonant])
    : f.index;

  const report: ConvergenceReport = convergenceAt(anchor, index, DEFAULT_CONVERGENCE);

  // ── حركة المحور ───────────────────────────────────────────────────────────
  // رِباط الملتقى measures the attribution leaving one person and arriving at
  // another, signed, on the same proximity axis this field's radius is. Where
  // it departs from this āyah it is part of where you are standing, not a
  // destination someone chose — and where it lands on a placed āyah it is the
  // text's own movement and can be followed as one.
  const movement = f.ribat
    .filter((v) => v.node === anchor)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((v) => ({ ...v, landing: v.to !== null ? brief(f.nodes[v.to]) : null }));

  return NextResponse.json({
    here: brief(here),
    /** True when the anchor was computed rather than asked for. */
    computed: !asked,
    origin: f.origin,
    movement,
    field: {
      placed: f.nodes.length,
      relations: f.strands.length + resonant.length,
      groups: index.groups.length,
      /** Which families were in the index this report was computed over. */
      families: resonant.length
        ? ['motif', 'root', 'discovery', 'resonance']
        : ['motif', 'root', 'discovery'],
      /** Independence classes, not families: see `CLASS_OF`. */
      minSupport: DEFAULT_CONVERGENCE.minSupport,
    },
    report: {
      ...report,
      convergences: report.convergences.map((c) => placeConvergence(c, f.nodes)),
      routes: report.routes.map((r) => placeRoute(r, f.nodes)),
    },
  });
}
