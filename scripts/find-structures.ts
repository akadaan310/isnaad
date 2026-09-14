#!/usr/bin/env tsx
/* ===========================================================================
 *  find-structures.ts — what is actually in the field, under each basis.
 *
 *  This writes nothing and draws nothing. It answers the only question that
 *  should decide whether a surface, a chamber or a portal is ever built: is
 *  there a grouping here that several independent computations agree on, and
 *  does it have a shape?
 *
 *  Run: npm run structures
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
  constellationBasis,
  contourBasis,
  isnadBasis,
  positionsFor,
  spectralBasis,
  type Basis,
} from '../src/lib/cosmos/basis';
import { findStructures, shapeName } from '../src/lib/cosmos/structures';
import type { CosmosPayload } from '../src/lib/cosmos/types';
import type { Discovery, Motif } from '../src/lib/types';
import type { RootIndex } from '../src/lib/engine/graph';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async <T>(...p: string[]): Promise<T> =>
  JSON.parse(await readFile(path.join(ROOT, 'data', ...p), 'utf8')) as T;
const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length));
const rpad = (s: string, n: number) => ' '.repeat(Math.max(0, n - s.length)) + s;

async function main() {
  const nodes = (await read<CosmosPayload>('cosmos', 'nodes.json')).nodes;
  const join = buildLocusJoin(nodes);
  const strands: Strand[] = [
    ...sunbulaStrands(nodes),
    ...motifStrands(await read<Motif[]>('index', 'motifs.json'), join),
    ...rootStrands(await read<RootIndex>('index', 'roots.json'), join),
    ...discoveryStrands(await read<Discovery[]>('index', 'discoveries.json'), join),
  ];

  const bases: Basis[] = [
    constellationBasis(nodes),
    isnadBasis(nodes),
    contourBasis(nodes),
    spectralBasis(nodes, strands),
  ];

  console.log('\n  a grouping counts only if at least two families of relation agree on it.');
  console.log('  السنابل are excluded from support: they were derived from isnād and time,');
  console.log('  so they agree with everything by construction.\n');

  console.log(
    `  ${pad('basis', 16)}${rpad('groups', 8)}${rpad('خيط', 7)}${rpad('صفيحة', 9)}${rpad('كتلة', 8)}` +
      `${rpad('best', 8)}  strongest grouping`,
  );
  console.log('  ' + '-'.repeat(100));

  const found = bases.map((b) => ({ b, s: findStructures(nodes, strands, positionsFor(nodes, b)) }));
  for (const { b, s } of found) {
    const shapes = { 'خيط': 0, 'صفيحة': 0, 'كتلة': 0 } as Record<string, number>;
    for (const x of s) shapes[shapeName(x.shape)]++;
    const top = s[0];
    console.log(
      `  ${pad(b.id, 16)}${rpad(String(s.length), 8)}${rpad(String(shapes['خيط']), 7)}` +
        `${rpad(String(shapes['صفيحة']), 9)}${rpad(String(shapes['كتلة']), 8)}` +
        `${rpad(top ? top.score.toFixed(1) : '—', 8)}  ${top ? `${top.label} · ${top.nodes.length} آية · ${shapeName(top.shape)}` : '—'}`,
    );
  }

  // The basis that actually made structure local is the one worth reading in
  // detail; the others are here to be compared against, not mined.
  const best = found.find((f) => f.b.id === 'isnad')!;
  console.log(`\n  the ten strongest under ${best.b.id}:\n`);
  console.log(
    `  ${pad('grouping', 26)}${rpad('آيات', 6)}${rpad('خيوط', 7)}${rpad('support', 9)}` +
      `${rpad('lin', 7)}${rpad('plan', 7)}${rpad('sph', 7)}${rpad('extent', 9)}  shape · families`,
  );
  console.log('  ' + '-'.repeat(112));
  for (const x of best.s.slice(0, 10)) {
    console.log(
      `  ${pad(x.label, 26)}${rpad(String(x.nodes.length), 6)}${rpad(String(x.internalStrands), 7)}` +
        `${rpad(String(x.support), 9)}${rpad(x.shape.linearity.toFixed(2), 7)}` +
        `${rpad(x.shape.planarity.toFixed(2), 7)}${rpad(x.shape.sphericity.toFixed(2), 7)}` +
        `${rpad(x.shape.extent.toFixed(1), 9)}  ${shapeName(x.shape)} · ${x.families.filter((f) => f !== 'sunbula').join(', ')}`,
    );
  }

  const sheets = best.s.filter((x) => shapeName(x.shape) === 'صفيحة' && x.nodes.length >= 8);
  const filaments = best.s.filter((x) => shapeName(x.shape) === 'خيط' && x.nodes.length >= 8);
  console.log(
    `\n  candidates for an enterable surface (planar, ≥8 āyāt, ≥2 families): ${sheets.length}` +
      `\n  candidates for a followable trajectory (linear, ≥8 āyāt, ≥2 families): ${filaments.length}\n`,
  );

  // Two claims of very different strength are on this page and they must not
  // be read as one. Support is a fact about the text: three independent
  // families of relation agreeing on a grouping says nothing about where
  // anything was drawn. Shape is a fact about the *embedding* — the same
  // grouping is a filament under one basis and a sheet under another, as the
  // first table shows. Only support survives a change of basis.
  const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const spread = median([...sheets, ...filaments].map((x) => x.shape.extent));
  const diameter = Math.max(...best.s.map((x) => x.shape.extent));
  console.log(
    `  support is basis-independent; shape is not — the same grouping is a filament under\n` +
      `  one basis and a sheet under another. And none of these is *local*: the median\n` +
      `  extent of a candidate is ${spread.toFixed(0)} in a field whose widest grouping spans ${diameter.toFixed(0)},\n` +
      `  so these are threads and sections through the whole space, not places in it.\n`,
  );
  for (const x of sheets.slice(0, 5)) {
    const names = x.nodes.slice(0, 6).map((i) => `${nodes[i].name} ${nodes[i].a}`);
    console.log(`    صفيحة  ${pad(x.label, 24)} ${x.nodes.length} آية — ${names.join(' · ')}…`);
  }
  for (const x of filaments.slice(0, 5)) {
    const names = x.nodes.slice(0, 6).map((i) => `${nodes[i].name} ${nodes[i].a}`);
    console.log(`    خيط    ${pad(x.label, 24)} ${x.nodes.length} آية — ${names.join(' · ')}…`);
  }
  console.log();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
