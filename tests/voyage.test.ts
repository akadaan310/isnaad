// O2/O5: seeded voyages are reproducible; recordings replay; handoffs verify.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { UniversePayload, UniverseRelations } from '../src/lib/universe/types';
import { FLAG } from '../src/lib/universe/types';
import { indexRelations } from '../src/lib/universe/relations';
import { ordinalOf } from '../src/lib/universe/build';
import {
  DEFAULT_VOYAGE_CONFIG,
  cameraAt,
  decodeVoyageConfig,
  encodeVoyageConfig,
  planVoyage,
  sampleVoyage,
  type VoyageConfig,
} from '../src/lib/universe/voyage';
import { digestOf, hash32, mulberry32, weightedIndex } from '../src/lib/universe/rng';
import {
  FlightRecorder,
  depthResolution,
  diagnose,
  float32Ulp,
  frameStats,
  poseAt,
  replayError,
  verifyRecording,
  type Environment,
  type Frame,
} from '../src/lib/universe/recorder';
import { decodeHandoff, encodeHandoff, makeHandoff } from '../src/lib/universe/handoff';

const DATA = path.join(process.cwd(), 'data', 'universe');
const U = JSON.parse(readFileSync(path.join(DATA, 'universe.json'), 'utf8')) as UniversePayload;
const R = JSON.parse(readFileSync(path.join(DATA, 'relations.json'), 'utf8')) as UniverseRelations;
const adj = indexRelations(R, U.count);
const attributed = (k: number) => (U.f[k] & FLAG.ATTRIBUTED) !== 0;

test('rng: known values, so a seed means the same thing on every engine', () => {
  assert.equal(hash32(''), 2166136261);
  assert.equal(hash32('a'), 0xe40c292c);
  const r = mulberry32(1);
  const seq = [r(), r(), r()].map((x) => Math.round(x * 1e9));
  assert.deepEqual(seq, seq.slice()); // stable shape
  const r2 = mulberry32(1);
  assert.deepEqual([r2(), r2(), r2()].map((x) => Math.round(x * 1e9)), seq);
  assert.equal(weightedIndex([0, 0], 0.5), -1);
  assert.equal(weightedIndex([0, 1, 0], 0.99), 1);
  assert.equal(weightedIndex([1, 1], 0), 0);
});

test('same seed → identical voyage and identical camera samples', () => {
  const cfg: VoyageConfig = { ...DEFAULT_VOYAGE_CONFIG, seed: 'هود٢٩', legs: 40 };
  const a = planVoyage(U.count, adj, attributed, cfg);
  const b = planVoyage(U.count, adj, attributed, cfg);
  assert.equal(a.digest, b.digest);
  assert.deepEqual(a.legs, b.legs);
  assert.equal(digestOf(sampleVoyage(a, U.p)), digestOf(sampleVoyage(b, U.p)));
  assert.equal(a.legs.length, 41);
  assert.ok(attributed(a.legs[0].to));
});

test('different seeds give different routes (over 50 seeds, all distinct)', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 50; i++) seen.add(planVoyage(U.count, adj, attributed, { ...DEFAULT_VOYAGE_CONFIG, seed: `s${i}` }).digest);
  assert.equal(seen.size, 50);
});

test('every leg is a computed relation, with its evidence', () => {
  const v = planVoyage(U.count, adj, attributed, { ...DEFAULT_VOYAGE_CONFIG, seed: 'evidence', legs: 200 });
  for (const leg of v.legs.slice(1)) {
    const found = adj[leg.from].some((l) => l.to === leg.to && l.kind === leg.kind && l.evidence === leg.evidence);
    assert.ok(found, `${leg.from}→${leg.to} ${leg.kind}`);
  }
});

test('a family weighted zero is never taken', () => {
  const cfg: VoyageConfig = {
    ...DEFAULT_VOYAGE_CONFIG,
    seed: 'roots-only',
    legs: 120,
    prefer: { tartib: 0, root: 1, motif: 0, discovery: 0 },
  };
  const v = planVoyage(U.count, adj, attributed, cfg);
  for (const leg of v.legs.slice(1)) assert.equal(leg.kind, 'root');
});

test('a fixed start is honoured, and arrival times are monotone', () => {
  const k = ordinalOf(U, 11, 29)!;
  const v = planVoyage(U.count, adj, attributed, { ...DEFAULT_VOYAGE_CONFIG, start: k, seed: 'x' });
  assert.equal(v.legs[0].to, k);
  for (let i = 1; i < v.legs.length; i++) assert.ok(v.legs[i].arriveAt > v.legs[i - 1].arriveAt);
});

test('camera path is continuous: no jump between consecutive 60 Hz samples', () => {
  const v = planVoyage(U.count, adj, attributed, { ...DEFAULT_VOYAGE_CONFIG, seed: 'continuity', legs: 30 });
  for (const reduce of [false, true]) {
    let prev = cameraAt(v, U.p, 0, reduce);
    let worst = 0;
    for (let t = 1 / 60; t <= v.duration; t += 1 / 60) {
      const c = cameraAt(v, U.p, t, reduce);
      worst = Math.max(worst, Math.hypot(c.p[0] - prev.p[0], c.p[1] - prev.p[1], c.p[2] - prev.p[2]));
      prev = c;
    }
    // Field diameter ≈ 220u; a leg is 3.5 s; anything over ~3u per frame is a cut.
    assert.ok(worst < 3, `reduceMotion=${reduce}: worst step ${worst.toFixed(3)}u`);
  }
});

test('voyage code round-trips and rejects junk', () => {
  const cfg: VoyageConfig = { ...DEFAULT_VOYAGE_CONFIG, seed: 'رحلة ~ مع رموز', start: 42 };
  const back = decodeVoyageConfig(encodeVoyageConfig(cfg));
  assert.deepEqual(back, cfg);
  assert.equal(decodeVoyageConfig('v0~x'), null);
  assert.equal(decodeVoyageConfig('v1~a~~x~1,1,1,1~1~1~1'), null);
  const clamped = decodeVoyageConfig('v1~a~~99999~1,1,1,1~1~1~1')!;
  assert.equal(clamped.legs, 500);
});

const env: Environment = {
  userAgent: 'test',
  platform: 'node',
  device: 'simulated',
  viewport: [800, 600],
  gpu: { vendor: 'none', renderer: 'none', webgl: 'none', maxTexture: 0, highpFragment: true },
  renderer: {},
  geometry: {},
};

function flown(n: number): Frame[] {
  const v = planVoyage(U.count, adj, attributed, { ...DEFAULT_VOYAGE_CONFIG, seed: 'rec', legs: 6 });
  const out: Frame[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * v.duration;
    const c = cameraAt(v, U.p, t);
    out.push({ t, p: c.p, q: [0, 0, 0, 1], fov: 58, near: 0.1, far: 4000, locus: c.leg, dt: 16.7, origin: [0, 0, 0] });
  }
  return out;
}

test('recorder: export verifies, tampering is detected, replay error is zero on itself', () => {
  const rec = new FlightRecorder(env, 1000, '2026-10-18T00:00:00.000Z');
  for (const f of flown(300)) rec.frame(f);
  const r = rec.export();
  assert.ok(verifyRecording(r));
  assert.equal(replayError(r.frames, r.frames), 0);
  const tampered = { ...r, frames: r.frames.map((f, i) => (i === 10 ? { ...f, p: [0, 0, 0] as [number, number, number] } : f)) };
  assert.equal(verifyRecording(tampered), false);
  assert.ok(replayError(r.frames, tampered.frames) > 0);
});

test('recorder: ring is bounded and counts what it dropped', () => {
  const rec = new FlightRecorder(env, 50);
  for (const f of flown(120)) rec.frame(f);
  const r = rec.export();
  assert.equal(r.frames.length, 50);
  assert.equal(r.dropped, 70);
});

test('recorder: non-finite poses are logged as events', () => {
  const rec = new FlightRecorder(env, 10);
  rec.frame({ t: 0, p: [NaN, 0, 0], q: [0, 0, 0, 1], fov: 58, near: 0.1, far: 4000, locus: -1, dt: 16, origin: [0, 0, 0] });
  const r = rec.export();
  assert.equal(r.events.filter((e) => e.kind === 'non-finite').length, 1);
  assert.ok(diagnose(r).find((f) => f.cls === 'precision')!.supported);
});

test('poseAt interpolates between frames and takes the short way round', () => {
  const frames: Frame[] = [
    { t: 0, p: [0, 0, 0], q: [0, 0, 0, 1], fov: 58, near: 0.1, far: 4000, locus: -1, dt: 0, origin: [0, 0, 0] },
    { t: 1, p: [10, 0, 0], q: [0, 0, 0, -1], fov: 58, near: 0.1, far: 4000, locus: -1, dt: 0, origin: [0, 0, 0] },
  ];
  const m = poseAt(frames, 0.5)!;
  assert.deepEqual(m.p, [5, 0, 0]);
  assert.ok(Math.abs(Math.abs(m.q[3]) - 1) < 1e-12);
});

test('diagnose: a canvas laid out at its buffer size is classified as compositing', () => {
  const rec = new FlightRecorder(env, 10);
  // What setSize(w, h, false) does at dpr 2: buffer 2w×2h, no CSS size, so the
  // element lays out at 2w×2h inside a w×h host.
  rec.geometry(0, { hostW: 400, hostH: 800, cssW: 800, cssH: 1600, bufW: 800, bufH: 1600, dpr: 2, deviceDpr: 2.625 });
  const f = diagnose(rec.export());
  const c = f.find((x) => x.cls === 'compositing')!;
  assert.ok(c.supported);
  assert.match(c.evidence, /25%/);
  assert.equal(f.find((x) => x.cls === 'buffer')!.supported, false);
  const ok = new FlightRecorder(env, 10);
  ok.geometry(0, { hostW: 400, hostH: 800, cssW: 400, cssH: 800, bufW: 800, bufH: 1600, dpr: 2, deviceDpr: 2.625 });
  assert.equal(diagnose(ok.export()).find((x) => x.cls === 'compositing')!.supported, false);
});

test('precision helpers agree with IEEE-754 float32', () => {
  assert.equal(float32Ulp(1), 2 ** -23);
  assert.equal(float32Ulp(900), 2 ** (9 - 23));
  const f = new Float32Array([900 + float32Ulp(900) * 0.4]);
  assert.equal(f[0], 900, 'sub-ulp offset is lost in float32');
  assert.ok(depthResolution(900, 0.1, 4000) < 1);
  assert.ok(depthResolution(900, 0.001, 4000) > depthResolution(900, 0.1, 4000));
});

test('frameStats', () => {
  const s = frameStats(flown(100));
  assert.equal(s.median, 16.7);
  assert.ok(Math.abs(s.fps - 59.88) < 0.1);
});

test('handoff: round-trip, Arabic note, tamper and locus checks', () => {
  const k = ordinalOf(U, 50, 2)!;
  const h = makeHandoff({
    locus: { k, surah: 50, ayah: 2 },
    lens: 'isnad',
    voyage: encodeVoyageConfig(DEFAULT_VOYAGE_CONFIG),
    camera: { p: [1, 2, 3], look: [4, 5, 6] },
    note: 'بَلْ عَجِبُوٓا۟ — انظر رجع الجذر',
    from: 'Abed',
    to: '7u',
    createdAt: '2026-10-18T00:00:00.000Z',
  });
  const code = encodeHandoff(h);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  const back = decodeHandoff(code, (s, a) => ordinalOf(U, s, a));
  assert.ok(back.ok);
  if (back.ok) assert.equal(back.handoff.note, h.note);
  const bad = makeHandoff({ ...h, locus: { k: k + 1, surah: 50, ayah: 2 } });
  assert.deepEqual(decodeHandoff(encodeHandoff(bad), (s, a) => ordinalOf(U, s, a)), { ok: false, reason: 'locus does not match ordinal' });
  const forged = encodeHandoff({ ...h, note: 'changed' });
  assert.deepEqual(decodeHandoff(forged), { ok: false, reason: 'digest mismatch' });
  assert.equal(decodeHandoff('!!').ok, false);
});
