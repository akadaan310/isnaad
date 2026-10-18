// Full-universe invariants: O1 (addressability, zero silent omissions, legacy
// reconstructible). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { FLAG, type UniverseManifest, type UniversePayload, type UniverseRelations } from '../src/lib/universe/types';
import { ordinalOf } from '../src/lib/universe/build';
import {
  UNATTRIBUTED_RADIUS,
  distanceAtUniverseRadius,
  ordinalOfDirection,
  placeOrdinal,
  spiralDirection,
  universeRadius,
} from '../src/lib/universe/placement';
import { indexRelations } from '../src/lib/universe/relations';
import { radiusOf } from '../src/lib/cosmos/placement';

const DATA = path.join(process.cwd(), 'data');
const raw = (f: string) => readFileSync(path.join(DATA, f), 'utf8');
const uText = raw('universe/universe.json');
const rText = raw('universe/relations.json');
const U = JSON.parse(uText) as UniversePayload;
const R = JSON.parse(rText) as UniverseRelations;
const M = JSON.parse(raw('universe/manifest.json')) as UniverseManifest;
const meta = JSON.parse(raw('corpus/meta.json')) as Record<string, { name: string; uthmani: string[] }>;
const legacy = JSON.parse(raw('cosmos/nodes.json')) as { nodes: { i: number; s: number; a: number; d: number }[] };
const ayaat = JSON.parse(raw('index/ayaat.json')) as { s: number; a: number; d: number; v: number[]; w: number }[];

test('every āyah of the corpus is a row, exactly once, in muṣḥaf order', () => {
  let expected = 0;
  for (let s = 1; s <= 114; s++) expected += meta[String(s)].uthmani.length;
  assert.equal(expected, 6236);
  assert.equal(U.count, 6236);
  for (const col of ['s', 'a', 'd', 'sig', 'w', 'dc', 'dk', 'sm', 'f', 'legacy'] as const) {
    assert.equal(U[col].length, 6236, col);
  }
  assert.equal(U.p.length, 6236 * 3);
  assert.equal(U.v.length, 6236 * 3);
  let k = 0;
  for (let s = 1; s <= 114; s++) {
    for (let a = 1; a <= meta[String(s)].uthmani.length; a++, k++) {
      assert.equal(U.s[k], s);
      assert.equal(U.a[k], a);
      assert.equal(ordinalOf(U, s, a), k);
    }
  }
});

test('ordinal arithmetic refuses loci that do not exist', () => {
  assert.equal(ordinalOf(U, 0, 1), undefined);
  assert.equal(ordinalOf(U, 115, 1), undefined);
  assert.equal(ordinalOf(U, 1, 0), undefined);
  assert.equal(ordinalOf(U, 1, 8), undefined);
  assert.equal(ordinalOf(U, 2, 286), U.surahs[1].first + 285);
  assert.equal(ordinalOf(U, 2, 287), undefined);
  assert.equal(ordinalOf(U, 1, 1.5), undefined);
});

test('every row has a finite position — including one-word and transition-free āyāt', () => {
  for (let k = 0; k < U.count; k++) {
    for (let c = 0; c < 3; c++) assert.ok(Number.isFinite(U.p[k * 3 + c]), `row ${k}`);
  }
  const oneWord = ayaat.filter((r) => r.w === 1);
  assert.equal(oneWord.length, 28);
  for (const r of oneWord) assert.ok(ordinalOf(U, r.s, r.a) !== undefined);
  const noSeam = U.sm.filter((x) => x === 0).length;
  assert.ok(noSeam > 0, 'there are āyāt with no detected transition, and they are placed');
  assert.equal(M.counts.placed, 6236);
});

test('radius is discourse distance, and zero-mass āyāt are on their own shell', () => {
  let unattributed = 0;
  for (let k = 0; k < U.count; k++) {
    const r = Math.hypot(U.p[k * 3], U.p[k * 3 + 1], U.p[k * 3 + 2]);
    const attributed = (U.f[k] & FLAG.ATTRIBUTED) !== 0;
    if (!attributed) {
      unattributed++;
      assert.equal(U.d[k], -1);
      assert.ok(Math.abs(r - UNATTRIBUTED_RADIUS) < 0.01);
    } else {
      assert.ok(Math.abs(r - radiusOf(U.d[k])) < 0.01, `row ${k}: r=${r} d=${U.d[k]}`);
      assert.ok(Math.abs(distanceAtUniverseRadius(r) - U.d[k]) < 2e-4);
    }
  }
  const zeroMass = ayaat.filter((r) => r.v[0] + r.v[1] + r.v[2] === 0).length;
  assert.equal(unattributed, zeroMass);
  assert.equal(unattributed, M.counts.unattributed);
  // The engine's default would have put them on the المتكلم shell.
  assert.ok(ayaat.filter((r) => r.v[0] + r.v[1] + r.v[2] === 0).every((r) => r.d === 0.5));
});

test('direction is muṣḥaf order: the ordinal is recoverable from the position', () => {
  for (let k = 0; k < U.count; k += 7) {
    const r = Math.hypot(U.p[k * 3], U.p[k * 3 + 1], U.p[k * 3 + 2]);
    assert.equal(ordinalOfDirection(U.p[k * 3 + 1] / r, U.count), k);
  }
});

test('spiral property: unit length, monotone z, bounded step between neighbours', () => {
  const n = 6236;
  let worst = 0;
  let prev = spiralDirection(0, n);
  for (let k = 1; k < n; k++) {
    const u = spiralDirection(k, n);
    assert.ok(Math.abs(Math.hypot(...u) - 1) < 1e-12);
    assert.ok(u[1] < prev[1]);
    worst = Math.max(worst, Math.hypot(u[0] - prev[0], u[1] - prev[1], u[2] - prev[2]));
    prev = u;
  }
  // Equal-area spacing is √(4π/n) ≈ 0.045; the polar caps are the worst case.
  assert.ok(worst < 0.1, `largest neighbour step ${worst}`);
  assert.deepEqual(placeOrdinal(5, n, -1).map((c) => Math.round(c * 1e6)), spiralDirection(5, n).map((c) => Math.round(c * UNATTRIBUTED_RADIUS * 1e6)));
  assert.equal(universeRadius(NaN), UNATTRIBUTED_RADIUS);
});

test('the legacy 1,000 are flagged, indexed, and were reconstructed by the ingest', () => {
  assert.equal(legacy.nodes.length, 1000);
  for (const n of legacy.nodes) {
    const k = ordinalOf(U, n.s, n.a)!;
    assert.ok(U.f[k] & FLAG.LEGACY);
    assert.equal(U.legacy[k], n.i);
  }
  assert.equal(U.f.filter((f) => f & FLAG.LEGACY).length, 1000);
  assert.equal(M.legacy.reconstructed, true);
  assert.equal(M.legacy.mismatches, 0);
  // What the legacy filter dropped is present here.
  assert.equal(U.f.filter((f) => f & FLAG.SHORT).length, ayaat.filter((r) => r.w < 3).length);
});

test('manifest hashes match the files on disk', () => {
  assert.equal(M.sha256['universe.json'], createHash('sha256').update(uText).digest('hex'));
  assert.equal(M.sha256['relations.json'], createHash('sha256').update(rText).digest('hex'));
});

test('the four coverage counts are distinct quantities, and ordered', () => {
  const c = M.counts;
  assert.equal(c.corpus, 6236);
  assert.equal(c.analyzed, 6236);
  assert.ok(c.withDiscovery <= c.detected && c.detected <= c.analyzed);
  assert.ok(c.placed <= c.corpus);
  assert.equal(c.surahs, 114);
});

test('relations: endpoints valid, a < b, muṣḥaf chain complete, evidence present', () => {
  for (const [a, b, k, w, e] of R.links) {
    assert.ok(a >= 0 && b < U.count && a < b);
    assert.ok(k >= 0 && k < R.kinds.length);
    assert.ok(w >= 0 && w <= 1000);
    assert.ok(typeof R.evidence[e] === 'string' && R.evidence[e].length > 0);
  }
  const tartib = R.links.filter((l) => R.kinds[l[2]] === 'tartib');
  assert.equal(tartib.length, U.count - 1);
  const adj = indexRelations(R, U.count);
  assert.ok(adj.every((l) => l.length >= 1), 'no āyah is unreachable');
});
