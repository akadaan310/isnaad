#!/usr/bin/env tsx
/* ===========================================================================
 *  verify-cosmos.ts — acceptance tests for the locus join and the strand layer.
 *
 *  These run against the repository's real artefacts, not fixtures. The point
 *  of the layer is that it restates what the engine already found, so the only
 *  honest way to test it is to hold it against what the engine actually wrote:
 *  data/cosmos/nodes.json, and the mined indices under data/index/.
 *
 *  Every check below is a claim about the join or the edges that would be a
 *  real defect if it broke — a silently empty chain, a strand pointing at a
 *  node that is not the āyah it claims, a displacement whose direction
 *  contradicts the detector's own word for it.
 *
 *  Run: npm run verify:cosmos
 * ======================================================================== */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLocusJoin, locusKey } from '../src/lib/cosmos/locus';
import {
  buildAdjacency,
  discoveryStrands,
  motifStrands,
  ribatSegment,
  ribatVectors,
  rootStrands,
  selectRibat,
  selectStrands,
  sunbulaStrands,
  DEFAULT_SELECT,
  type Strand,
} from '../src/lib/cosmos/strands';
import { distanceAtRadius, lengthOf } from '../src/lib/cosmos/placement';
import type { CosmosPayload } from '../src/lib/cosmos/types';
import type { Discovery, Motif } from '../src/lib/types';
import type { RootIndex } from '../src/lib/engine/graph';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const read = async <T>(...p: string[]): Promise<T> =>
  JSON.parse(await readFile(path.join(DATA, ...p), 'utf8')) as T;

let failed = 0;
const ok = (name: string, detail = '') => console.log(`  ok    ${name}${detail ? `  ${detail}` : ''}`);
const fail = (name: string, detail: string) => {
  failed++;
  console.log(`  FAIL  ${name}  ${detail}`);
};
function check(name: string, cond: boolean, detail = '') {
  cond ? ok(name, detail) : fail(name, detail || 'condition not met');
}

async function main() {
  const payload = await read<CosmosPayload>('cosmos', 'nodes.json');
  const nodes = payload.nodes;
  const motifs = await read<Motif[]>('index', 'motifs.json');
  const roots = await read<RootIndex>('index', 'roots.json');
  const discoveries = await read<Discovery[]>('index', 'discoveries.json');

  console.log('\n  الموقع — the locus join\n');

  const join = buildLocusJoin(nodes);

  check('every node is joinable', join.size === nodes.length, `${join.size}/${nodes.length}`);

  const roundTrip = nodes.every((n) => {
    const l = join.locusOf(n.i);
    return l && l.surah === n.s && l.ayah === n.a && join.at(n.s, n.a) === n.i;
  });
  check('locus ↔ node round-trips for all 1,000', roundTrip);

  check(
    'an unplaced āyah resolves to nothing, not to zero',
    join.at(114, 99) === undefined && join.at(1, 1) !== null,
  );

  // The join must not invent order. A chain is in muṣḥaf order regardless of
  // the order the loci arrived in — the mined indices are already sorted, so a
  // shuffled input is the only way to prove the sort is really happening.
  const sample = nodes.slice(0, 40).map((n) => ({ surah: n.s, ayah: n.a }));
  const shuffled = [...sample].reverse();
  const chainA = join.chain(sample);
  const chainB = join.chain(shuffled);
  check('chain order is muṣḥaf order, not arrival order', JSON.stringify(chainA) === JSON.stringify(chainB));
  const ordered = chainA.every((n, k) => {
    if (!k) return true;
    const p = join.locusOf(chainA[k - 1])!;
    const c = join.locusOf(n)!;
    return p.surah < c.surah || (p.surah === c.surah && p.ayah < c.ayah);
  });
  check('chain is strictly ascending', ordered);

  // Two different denominators, both worth knowing: a quarter of the *āyāt*
  // motifs land in are placed, but those āyāt carry nearly a third of all
  // occurrences — the field is biased toward the loci that recur.
  const occurrences = motifs.flatMap((m) => m.occurrences.map((o) => ({ surah: o.surah, ayah: o.ayah })));
  const cov = join.coverage(occurrences);
  const byOccurrence = occurrences.filter((o) => join.has(o.surah, o.ayah)).length / occurrences.length;
  check(
    'motif coverage is substantial in both senses',
    cov.ratio > 0.2 && byOccurrence > 0.28,
    `${cov.placed}/${cov.distinct} distinct loci (${(cov.ratio * 100).toFixed(1)}%), ` +
      `${(byOccurrence * 100).toFixed(1)}% of all occurrences`,
  );

  console.log('\n  الخيوط — the strand layer\n');

  const sb = sunbulaStrands(nodes);
  const mo = motifStrands(motifs, join);
  const rt = rootStrands(roots, join);
  const dc = discoveryStrands(discoveries, join);
  const all: Strand[] = [...sb, ...mo, ...rt, ...dc];

  check('سنابل', sb.length > 6800, `${sb.length} strands`);
  check('المثاني', mo.length > 1800, `${mo.length} strands over ${new Set(mo.map((s) => (s.evidence as { motif: string }).motif)).size} contours`);
  check('الجذور', rt.length > 900, `${rt.length} strands over ${new Set(rt.map((s) => (s.evidence as { root: string }).root)).size} roots`);
  check('الاستنباطات', dc.length > 200, `${dc.length} strands`);

  // A strand that points at a node which is not the āyah its evidence names is
  // the failure mode that would make the whole layer quietly wrong.
  let mismatched = 0;
  for (const s of mo) {
    const m = motifs.find((x) => x.id === (s.evidence as { motif: string }).motif)!;
    const loci = new Set(m.occurrences.map((o) => locusKey(o.surah, o.ayah)));
    for (const end of [s.a, s.b]) {
      const l = join.locusOf(end)!;
      if (!loci.has(locusKey(l.surah, l.ayah))) mismatched++;
    }
  }
  check('every motif strand lands on an āyah that motif actually occurs in', mismatched === 0, `${mismatched} mismatches`);

  let rootMismatch = 0;
  for (const s of rt) {
    const root = (s.evidence as { root: string }).root;
    const places = new Set((roots[root] ?? []).map(([x, y]) => locusKey(x, y)));
    for (const end of [s.a, s.b]) {
      const l = join.locusOf(end)!;
      if (!places.has(locusKey(l.surah, l.ayah))) rootMismatch++;
    }
  }
  check('every root strand lands on an āyah that root actually occurs in', rootMismatch === 0, `${rootMismatch} mismatches`);

  let discMismatch = 0;
  for (const s of dc) {
    const d = discoveries.find((x) => x.id === (s.evidence as { discovery: string }).discovery)!;
    const a = join.locusOf(s.a)!;
    const b = join.locusOf(s.b)!;
    if (a.surah !== d.surah || b.surah !== d.surah || a.ayah !== d.ayahFrom || b.ayah !== d.ayahTo) discMismatch++;
  }
  check('every discovery strand spans exactly the two banks it names', discMismatch === 0, `${discMismatch} mismatches`);

  check('no strand is a self-loop', all.every((s) => s.a !== s.b));
  check('no strand points outside the field', all.every((s) => nodes[s.a] && nodes[s.b]));
  check('every weight is a real number in 0…1', all.every((s) => s.weight >= 0 && s.weight <= 1));

  // Chains, not cliques: a 60-occurrence motif must not emit 1,770 edges.
  const worst = motifs
    .map((m) => ({ m, n: mo.filter((s) => (s.evidence as { motif: string }).motif === m.id).length }))
    .sort((x, y) => y.n - x.n)[0];
  check(
    'a motif emits a path, not a clique',
    worst.n < worst.m.occurrences.length,
    `${worst.m.id} has ${worst.m.occurrences.length} occurrences → ${worst.n} strands`,
  );

  console.log('\n  الاختيار — what a frame is allowed to show\n');

  const adj = buildAdjacency(all);
  const skeleton = selectStrands(adj, { ...DEFAULT_SELECT, budget: 320 });
  check('the unfocused field shows its skeleton, within budget', skeleton.length === 320, `${skeleton.length} of ${all.length}`);
  check(
    'the skeleton is ordered strongest first',
    skeleton[0].prominence >= skeleton[skeleton.length - 1].prominence,
  );

  // Without balancing, detector scores near 1 crowd out contours near 0.3 and
  // the skeleton becomes one family pretending to be a field.
  const tally = (xs: { kind: string }[]) =>
    xs.reduce<Record<string, number>>((m, s) => ({ ...m, [s.kind]: (m[s.kind] ?? 0) + 1 }), {});
  const raw = selectStrands(adj, { ...DEFAULT_SELECT, budget: 320, balance: false });
  const rawSpread = Object.keys(tally(raw)).length;
  const balSpread = Object.keys(tally(skeleton)).length;
  check(
    'every family is represented in the skeleton',
    balSpread >= rawSpread && balSpread >= 4,
    `balanced ${JSON.stringify(tally(skeleton))} vs unbalanced ${JSON.stringify(tally(raw))}`,
  );

  const focus = nodes.find((n) => n.k === 'ribat')!.i;
  const near = selectStrands(adj, { ...DEFAULT_SELECT, focus, depth: 2, budget: 200 });
  check('a focused field draws only its own neighbourhood', near.length > 0 && near.length <= 200, `${near.length} strands around node ${focus}`);
  check(
    'the focused node is on the strongest strands drawn',
    near.slice(0, 12).some((s) => s.a === focus || s.b === focus),
  );
  check('hop decay orders the neighbourhood', near.every((s) => s.hop >= 0 && s.hop < 2));

  // The flight board narrows rather than hides: a strand leaving the admitted
  // set is dimmed and outranked, not deleted, so a route reads as a passage
  // through the field rather than as a different field. Budget is deliberately
  // lifted here, since at a tight budget the fully-admitted strands rightly
  // take every slot and the policy would not be observable.
  const admitted = new Set(nodes.slice(0, 120).map((n) => n.i));
  const routed = selectStrands(adj, { ...DEFAULT_SELECT, admitted, budget: 4000 });
  const inside = routed.filter((s) => admitted.has(s.a) && admitted.has(s.b));
  const straddling = routed.filter((s) => admitted.has(s.a) !== admitted.has(s.b));
  check(
    'a strand straddling the route survives, dimmed',
    inside.length > 0 && straddling.length > 0,
    `${inside.length} inside, ${straddling.length} straddling`,
  );
  check(
    'a strand with neither end admitted is dropped',
    routed.every((s) => admitted.has(s.a) || admitted.has(s.b)),
  );
  check(
    'admitted strands outrank straddling ones at equal weight',
    straddling.every((s) => s.prominence < s.weight),
  );

  const drawnSunbula = skeleton.filter((s) => s.kind === 'sunbula').length;
  check(
    'the 7,000 سنابل do not become 7,000 lines',
    drawnSunbula < 260,
    `${drawnSunbula} of ${sb.length} drawn in the skeleton`,
  );

  console.log('\n  رِباط — حركة المحور as displacement\n');

  const rb = ribatVectors(discoveries, join);
  check('رِباط vectors', rb.length > 250, `${rb.length} displacements on placed āyāt`);
  check('every displacement is signed and non-zero', rb.every((v) => v.axisDelta !== 0 && Math.abs(v.axisDelta) <= 1));
  check(
    'landing āyāt are resolved where they are placed',
    rb.some((v) => v.to !== null),
    `${rb.filter((v) => v.to !== null).length} land on another placed node`,
  );

  // The detector's own word for the movement is اقترابًا when the axis delta is
  // negative. Radius is the axis, so an inward displacement must shorten the
  // radius. If this ever inverts, the canvas is asserting the opposite of the
  // engine's finding.
  let wrongWay = 0;
  for (const v of rb) {
    if (v.to !== null) continue;
    const { head, tail } = ribatSegment(v, nodes);
    const moved = lengthOf(tail) - lengthOf(head);
    if (Math.sign(moved) !== Math.sign(v.axisDelta) && Math.abs(moved) > 1e-6) wrongWay++;
  }
  check('اقترابًا moves inward and ابتعادًا moves outward', wrongWay === 0, `${wrongWay} inverted`);

  // And the extent must be the measured delta exactly — no clamp, no scaling,
  // no decorative length. Where the landing āyah is placed the segment is the
  // real trajectory between two nodes instead, and is exempt.
  const free = rb.filter((v) => v.to === null);
  let offBy = 0;
  for (const v of free) {
    const { head, tail } = ribatSegment(v, nodes);
    const moved = distanceAtRadius(lengthOf(tail)) - distanceAtRadius(lengthOf(head));
    if (Math.abs(moved - v.axisDelta) > 1e-6) offBy++;
  }
  check(
    'displacement extent is exactly حركة المحور',
    offBy === 0,
    `${free.length} free displacements, ${offBy} off`,
  );
  check(
    'both ends sit on a person shell of the proximity axis',
    free.every((v) => {
      const { head, tail } = ribatSegment(v, nodes);
      const shells = [0, 0.5, 1];
      const on = (p: typeof head) => shells.some((s) => Math.abs(distanceAtRadius(lengthOf(p)) - s) < 1e-6);
      return on(head) && on(tail);
    }),
  );

  const shown = selectRibat(rb, { focus: null, admitted: null, budget: 48 });
  check('the unfocused field draws only the strongest displacements', shown.length === 48, `${shown.length} of ${rb.length}`);
  const anchored = rb.find((v) => v.to !== null)!;
  const atFocus = selectRibat(rb, { focus: anchored.node, admitted: null, budget: 48 });
  check(
    'a focused field draws only displacements touching it',
    atFocus.length > 0 && atFocus.every((v) => v.node === anchored.node || v.to === anchored.node),
    `${atFocus.length} at node ${anchored.node}`,
  );

  console.log('\n  ' + (failed ? `${failed} CHECK(S) FAILED` : 'all checks passed') + '\n');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
