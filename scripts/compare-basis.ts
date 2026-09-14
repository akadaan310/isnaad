#!/usr/bin/env tsx
/* ===========================================================================
 *  compare-basis.ts — hold the candidate spatial bases against the one in use.
 *
 *  Nothing here writes anything. The question is narrow and answerable: given
 *  the relations the engine computed, does a basis put related āyāt near each
 *  other, or is a relation no shorter than a coincidence?
 *
 *  Run: npm run basis
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
  type StrandKind,
} from '../src/lib/cosmos/strands';
import {
  constellationBasis,
  contourBasis,
  isnadBasis,
  measureBasis,
  spectralBasis,
  type Basis,
} from '../src/lib/cosmos/basis';
import type { CosmosPayload } from '../src/lib/cosmos/types';
import type { Discovery, Motif } from '../src/lib/types';
import type { RootIndex } from '../src/lib/engine/graph';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async <T>(...p: string[]): Promise<T> =>
  JSON.parse(await readFile(path.join(ROOT, 'data', ...p), 'utf8')) as T;

const KINDS: StrandKind[] = ['sunbula', 'motif', 'root', 'discovery'];
const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length));

async function main() {
  const nodes = (await read<CosmosPayload>('cosmos', 'nodes.json')).nodes;
  const join = buildLocusJoin(nodes);
  const strands: Strand[] = [
    ...sunbulaStrands(nodes),
    ...motifStrands(await read<Motif[]>('index', 'motifs.json'), join),
    ...rootStrands(await read<RootIndex>('index', 'roots.json'), join),
    ...discoveryStrands(await read<Discovery[]>('index', 'discoveries.json'), join),
  ];

  console.log(`\n  ${nodes.length} āyāt · ${strands.length} computed relations\n`);

  const bases: Basis[] = [
    constellationBasis(nodes),
    isnadBasis(nodes),
    contourBasis(nodes),
    spectralBasis(nodes, strands),
  ];

  console.log(
    `  ${pad('basis', 16)}${pad('locality', 10)}${pad('related', 10)}${pad('random', 10)}` +
      KINDS.map((k) => pad(k, 11)).join('') +
      'convergences',
  );
  console.log('  ' + '-'.repeat(16 + 30 + KINDS.length * 11 + 12));

  const reports = bases.map((b) => measureBasis(nodes, strands, b));
  for (const r of reports) {
    console.log(
      `  ${pad(r.id, 16)}${pad(r.locality.toFixed(3), 10)}${pad(r.medianRelated.toFixed(1), 10)}` +
        `${pad(r.medianRandom.toFixed(1), 10)}` +
        KINDS.map((k) => pad((r.medianByKind[k] ?? 0).toFixed(1), 11)).join('') +
        String(r.convergences),
    );
  }

  console.log('\n  locality = median related distance / median random distance.');
  console.log('  1.000 means the basis is blind to structure: a computed relation is no');
  console.log('  shorter than a coincidence. Lower means structure has become local.\n');

  for (const b of bases) console.log(`  ${pad(b.id, 16)}${b.note}`);

  // السنابل were built in the ingest partly from isnād and time similarity,
  // so measuring the isnād basis against them is partly circular. The mined
  // relations — contours, roots, detector findings — owe nothing to placement,
  // so they are the honest test.
  const independent = strands.filter((s) => s.kind !== 'sunbula');
  console.log(`\n  the same, over the ${independent.length} relations that owe nothing to placement:\n`);
  console.log(`  ${pad('basis', 16)}${pad('locality', 10)}${pad('related', 10)}${pad('random', 10)}convergences`);
  console.log('  ' + '-'.repeat(58));
  const clean = bases.map((b) => measureBasis(nodes, independent, b));
  for (const r of clean) {
    console.log(
      `  ${pad(r.id, 16)}${pad(r.locality.toFixed(3), 10)}${pad(r.medianRelated.toFixed(1), 10)}` +
        `${pad(r.medianRandom.toFixed(1), 10)}${r.convergences}`,
    );
  }

  const best = [...clean].sort((a, b) => a.locality - b.locality)[0];
  const current = clean.find((r) => r.id === 'constellation')!;
  console.log(
    `\n  strongest: ${best.id} at ${best.locality.toFixed(3)} against ` +
      `${current.locality.toFixed(3)} for the placement in use ` +
      `(${(current.locality / best.locality).toFixed(1)}× tighter), ` +
      `${best.convergences} convergences against ${current.convergences}.\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
