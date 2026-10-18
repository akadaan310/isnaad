#!/usr/bin/env tsx
// Print the digest of the voyage a seed produces, from the committed data —
// the reference a browser run is compared against. Usage: tsx scripts/voyage-digest.ts <seed>
import { readFileSync } from 'node:fs';
import { FLAG, type UniversePayload, type UniverseRelations } from '../src/lib/universe/types';
import { indexRelations } from '../src/lib/universe/relations';
import { DEFAULT_VOYAGE_CONFIG, planVoyage } from '../src/lib/universe/voyage';

const U = JSON.parse(readFileSync('data/universe/universe.json', 'utf8')) as UniversePayload;
const R = JSON.parse(readFileSync('data/universe/relations.json', 'utf8')) as UniverseRelations;
const v = planVoyage(U.count, indexRelations(R, U.count), (k) => (U.f[k] & FLAG.ATTRIBUTED) !== 0, {
  ...DEFAULT_VOYAGE_CONFIG,
  seed: process.argv[2] ?? DEFAULT_VOYAGE_CONFIG.seed,
});
console.log(v.digest);
