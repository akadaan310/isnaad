#!/usr/bin/env tsx
/* ===========================================================================
 *  verify-convergence.ts — acceptance tests for الالتقاء.
 *
 *  The navigation model makes one claim on every step: that several
 *  *independent* families of relation agree about this destination. Everything
 *  the reader can do follows from it, so the claim has to be held against the
 *  repository's real artefacts rather than a fixture — data/cosmos/nodes.json
 *  and the mined indices under data/index/, the same ones the route reads.
 *
 *  Every check below would be a real defect if it broke: a سنبلة counted as
 *  evidence, a family claimed without a strand behind it, evidence paraphrased
 *  instead of carried, a route that quietly asserts a relation, a report whose
 *  own counts do not add up, or an answer that changes between runs.
 *
 *  It also walks three steps and prints them, because the only way to see that
 *  a navigation model goes anywhere is to go.
 *
 *  Run: npm run verify:convergence
 * ======================================================================== */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLocusJoin } from '../src/lib/cosmos/locus';
import {
  discoveryStrands,
  motifStrands,
  rootStrands,
  sunbulaStrands,
  type Strand,
} from '../src/lib/cosmos/strands';
import {
  buildRelationIndex,
  CLASS_OF,
  classesOf,
  computedOrigin,
  convergenceAt,
  DEFAULT_CONVERGENCE,
  EVIDENCE_FAMILIES,
  type EvidenceFamily,
} from '../src/lib/cosmos/convergence';
import type { CosmosPayload, CosmosNode } from '../src/lib/cosmos/types';
import type { Discovery, Motif } from '../src/lib/types';
import type { RootIndex } from '../src/lib/engine/graph';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async <T>(...p: string[]): Promise<T> =>
  JSON.parse(await readFile(path.join(ROOT, 'data', ...p), 'utf8')) as T;

let failed = 0;
const ok = (name: string, detail = '') => console.log(`  ok    ${name}${detail ? `  ${detail}` : ''}`);
const fail = (name: string, detail: string) => {
  failed++;
  console.log(`  FAIL  ${name}  ${detail}`);
};
const check = (name: string, cond: boolean, detail = '') =>
  cond ? ok(name, detail) : fail(name, detail || 'condition not met');

const locus = (n: CosmosNode) => `${n.name} ${n.a}`;

async function main() {
  const nodes = (await read<CosmosPayload>('cosmos', 'nodes.json')).nodes;
  const join = buildLocusJoin(nodes);
  const evidence: Strand[] = [
    ...motifStrands(await read<Motif[]>('index', 'motifs.json'), join),
    ...rootStrands(await read<RootIndex>('index', 'roots.json'), join),
    ...discoveryStrands(await read<Discovery[]>('index', 'discoveries.json'), join),
  ];
  // The سنابل are deliberately mixed in: the whole point of the first check is
  // that the layer drops them itself rather than relying on its caller to.
  const withSanabil = [...sunbulaStrands(nodes), ...evidence];
  const index = buildRelationIndex(withSanabil);

  console.log(
    `\n  ${nodes.length} nodes · ${evidence.length} evidence strands · ` +
      `${withSanabil.length - evidence.length} سنابل mixed in · ` +
      `${index.groups.length} relation groups\n`,
  );

  // ── the origin ────────────────────────────────────────────────────────────
  const origin = computedOrigin(nodes.length, index);
  check('an origin is computed at all', origin !== null);
  if (!origin) {
    process.exit(1);
  }
  const anchor = origin.node;
  ok('computed origin', `${locus(nodes[anchor])} — ${origin.converging} converging destinations`);

  const report = convergenceAt(anchor, index);

  // ── السنابل are not evidence ──────────────────────────────────────────────
  const claimed = new Set<string>();
  for (const c of report.convergences) for (const w of c.witnesses) claimed.add(w.family);
  for (const r of report.routes) {
    claimed.add(r.first.family);
    claimed.add(r.second.family);
  }
  check(
    'no سنبلة is reported as evidence',
    ![...claimed].includes('sunbula' as EvidenceFamily),
    `families seen: ${[...claimed].join(', ') || 'none'}`,
  );
  check(
    'no سنبلة reaches the anchor tally',
    !Object.keys(report.atAnchor).includes('sunbula'),
    `tally: ${EVIDENCE_FAMILIES.map((f) => `${f} ${report.atAnchor[f]}`).join(', ')}`,
  );

  // ── the counts add up ─────────────────────────────────────────────────────
  // With minSupport 2 every neighbour is either single-family or converging,
  // so the two must exhaust the neighbourhood. A gap would mean a destination
  // was dropped somewhere between the walk and the report.
  check(
    'neighbours = single + converging',
    report.neighbours === report.single + report.converging,
    `${report.neighbours} = ${report.single} + ${report.converging}`,
  );
  check(
    'the anchor tally counts every group the anchor belongs to',
    EVIDENCE_FAMILIES.reduce((n, f) => n + report.atAnchor[f], 0) ===
      (index.byNode.get(anchor) ?? []).length,
  );
  check(
    'no group of one survives the index',
    index.groups.every((g) => g.members.length >= 2),
  );
  check(
    'nothing is reported above the limit without saying so',
    report.convergences.length <= DEFAULT_CONVERGENCE.limit &&
      report.converging >= report.convergences.length,
  );

  // ── every claimed family has a computation behind it ──────────────────────
  const between = (a: number, b: number, family: EvidenceFamily) =>
    (index.byNode.get(a) ?? [])
      .map((i) => index.groups[i])
      .filter((g) => g.family === family && g.members.includes(b));

  let unbacked = 0;
  let misweighted = 0;
  let miscounted = 0;
  let paraphrased = 0;
  for (const c of report.convergences) {
    for (const w of c.witnesses) {
      const backing = between(anchor, c.node, w.family);
      if (!backing.length) unbacked++;
      else {
        const top = Math.max(...backing.map((g) => g.weight));
        if (Math.abs(top - w.weight) > 1e-12) misweighted++;
        if (backing.length !== w.count) miscounted++;
        // Verbatim means the same object, not an equal-looking one: every
        // record carried must be the evidence of a group that actually holds
        // both āyāt.
        for (const e of w.evidence) if (!backing.some((g) => g.evidence === e)) paraphrased++;
      }
    }
    if (c.support !== c.classes.length) fail('support = classes', `${c.node}`);
  }
  check('every claimed family holds both āyāt', unbacked === 0, `${unbacked} unbacked`);
  check("a witness's weight is its family's strongest", misweighted === 0, `${misweighted} wrong`);
  check("a witness's count is its family's size", miscounted === 0, `${miscounted} wrong`);
  check('evidence is carried, never rebuilt', paraphrased === 0, `${paraphrased} not verbatim`);
  check(
    'a convergence clears minSupport',
    report.convergences.every((c) => c.support >= DEFAULT_CONVERGENCE.minSupport),
  );
  // The whole reason classes exist: المثاني and الرنين read the same contour,
  // so a destination witnessed only by those two is one computation counted
  // twice and must not reach the surface as an agreement.
  check(
    'support counts classes, not families',
    report.convergences.every(
      (c) => c.support === new Set(c.witnesses.map((w) => CLASS_OF[w.family])).size,
    ),
  );
  check(
    'no convergence rests on المثاني and الرنين alone',
    report.convergences.every((c) => classesOf(c.witnesses).length >= 2),
  );
  check(
    'convergences are ranked by support then strength',
    report.convergences.every((c, i, xs) =>
      i === 0 ? true : xs[i - 1].support > c.support ||
        (xs[i - 1].support === c.support && xs[i - 1].strength >= c.strength - 1e-12),
    ),
  );

  // ── a route is not a relation ─────────────────────────────────────────────
  const direct = new Set<number>();
  for (const gi of index.byNode.get(anchor) ?? []) {
    for (const m of index.groups[gi].members) if (m !== anchor) direct.add(m);
  }
  check(
    'no route ends where a direct relation already goes',
    report.routes.every((r) => !direct.has(r.node)),
  );
  check(
    'a route never doubles one class',
    report.routes.every((r) => CLASS_OF[r.first.family] !== CLASS_OF[r.second.family]),
  );
  check(
    'both legs of a route are real',
    report.routes.every(
      (r) =>
        between(anchor, r.via, r.first.family).length > 0 &&
        between(r.via, r.node, r.second.family).length > 0,
    ),
  );
  check(
    'a route is worth its weakest leg',
    report.routes.every(
      (r) => Math.abs(r.strength - Math.min(r.first.weight, r.second.weight)) < 1e-12,
    ),
  );

  // ── determinism ───────────────────────────────────────────────────────────
  const again = convergenceAt(anchor, index);
  check(
    'the same anchor gives the same report twice',
    JSON.stringify(report) === JSON.stringify(again),
  );
  const reordered = buildRelationIndex([...withSanabil].reverse());
  const shuffled = convergenceAt(anchor, reordered);
  check(
    'the answer does not depend on strand order',
    JSON.stringify(report.convergences.map((c) => [c.node, c.support])) ===
      JSON.stringify(shuffled.convergences.map((c) => [c.node, c.support])),
  );

  // ── how much of the field this actually navigates ─────────────────────────
  // Measurements, not thresholds. Whatever they say is the answer, and the
  // surface has to state it rather than let twelve ranked cards imply that the
  // field is dense. The dominant term is squaring: the field holds 1,000 of
  // the 6,236 āyāt, and a relation needs *both* ends placed.
  const sizes: Record<string, number[]> = {};
  for (const g of index.groups) (sizes[g.family] ??= []).push(g.members.length);
  for (const f of EVIDENCE_FAMILIES) {
    const xs = (sizes[f] ?? []).sort((a, b) => a - b);
    if (!xs.length) continue;
    ok(
      `${f} groups`,
      `${xs.length} · median ${xs[Math.floor(xs.length / 2)]} · widest ${xs[xs.length - 1]}`,
    );
  }

  let withConvergence = 0;
  let placedNodes = 0;
  let edges = 0;
  const combos = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) {
    if (!index.byNode.has(i)) continue;
    placedNodes++;
    const r = convergenceAt(i, index, {
      ...DEFAULT_CONVERGENCE,
      limit: Number.MAX_SAFE_INTEGER,
      routeLimit: 0,
    });
    if (r.converging > 0) withConvergence++;
    edges += r.converging;
    for (const c of r.convergences) {
      const k = [...c.classes].sort().join(' + ');
      combos.set(k, (combos.get(k) ?? 0) + 1);
    }
  }
  ok(
    'āyāt with at least one convergence',
    `${withConvergence} of ${placedNodes} carrying any relation, of ${nodes.length} placed`,
  );
  ok('convergent pairs', `${edges / 2}`);
  for (const [k, n] of [...combos.entries()].sort((a, b) => b[1] - a[1])) {
    ok(`  agreeing classes`, `${k} — ${n / 2} pairs`);
  }

  // ── three steps, printed ──────────────────────────────────────────────────
  // A navigation model that cannot go anywhere is not one, so the walk is part
  // of the test. Where no new convergence leaves a position it says so and
  // takes a route instead, which is the same fallback the surface offers.
  console.log('\n  a walk, each step on what the engine computed:\n');
  let at = anchor;
  const seen = new Set([at]);
  console.log(`    ${locus(nodes[at])}`);
  for (let step = 0; step < 6; step++) {
    const here = convergenceAt(at, index, { ...DEFAULT_CONVERGENCE, limit: 64, routeLimit: 64 });
    const next = here.convergences.find((c) => !seen.has(c.node));
    if (next) {
      const why = next.witnesses.map((w) => `${w.family}×${w.count}@${w.weight.toFixed(2)}`).join('  ');
      console.log(`      ↓  التقاء · ${next.support} classes [${next.classes.join(', ')}]:  ${why}`);
      console.log(`    ${locus(nodes[next.node])}`);
      seen.add(next.node);
      at = next.node;
      continue;
    }
    const route = here.routes.find((r) => !seen.has(r.node));
    if (!route) {
      console.log('    — لا مقصد جديد من هنا، لا بالتقاء ولا بطريق');
      break;
    }
    console.log(
      `      ↓  طريق عبر ${locus(nodes[route.via])} · ` +
        `${route.first.family} ثم ${route.second.family} @${route.strength.toFixed(2)}`,
    );
    console.log(`    ${locus(nodes[route.node])}`);
    seen.add(route.node);
    at = route.node;
  }

  console.log(failed ? `\n  ${failed} failed\n` : '\n  all checks passed\n');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
