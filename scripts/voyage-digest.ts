#!/usr/bin/env tsx
// Print the digest of the voyage a seed produces, from the committed data —
// the reference a browser run is compared against.
//   tsx scripts/voyage-digest.ts <seed>              → digest
//   tsx scripts/voyage-digest.ts <seed> --json       → the full voyage, legs named
import { readFileSync } from 'node:fs';
import { FLAG, type UniversePayload, type UniverseRelations } from '../src/lib/universe/types';
import { indexRelations } from '../src/lib/universe/relations';
import { DEFAULT_VOYAGE_CONFIG, encodeVoyageConfig, planVoyage, sampleVoyage } from '../src/lib/universe/voyage';
import { digestOf } from '../src/lib/universe/rng';

const U = JSON.parse(readFileSync('data/universe/universe.json', 'utf8')) as UniversePayload;
const R = JSON.parse(readFileSync('data/universe/relations.json', 'utf8')) as UniverseRelations;
const v = planVoyage(U.count, indexRelations(R, U.count), (k) => (U.f[k] & FLAG.ATTRIBUTED) !== 0, {
  ...DEFAULT_VOYAGE_CONFIG,
  seed: process.argv[2] ?? DEFAULT_VOYAGE_CONFIG.seed,
});
if (!process.argv.includes('--json')) {
  console.log(v.digest);
} else {
  const name = (k: number) => `${U.surahs[U.s[k] - 1].name} ${U.s[k]}:${U.a[k]}`;
  console.log(
    JSON.stringify(
      {
        code: encodeVoyageConfig(v.config),
        link: `/universe?voyage=${encodeURIComponent(encodeVoyageConfig(v.config))}`,
        digest: v.digest,
        cameraDigest10Hz: digestOf(sampleVoyage(v, U.p)),
        duration: v.duration,
        legs: v.legs.map((l) => ({ at: l.arriveAt, to: name(l.to), kind: l.kind, evidence: l.evidence })),
      },
      null,
      2,
    ),
  );
}
