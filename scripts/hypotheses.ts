#!/usr/bin/env tsx
/* ===========================================================================
 *  hypotheses.ts — six claims about the field, each against a baseline.
 *
 *  Every test is seeded (lib/universe/rng), so a rerun reproduces every number.
 *  A claim is "supported" only when it beats its null at the stated level; a
 *  result that does not is reported as refused, with the numbers. Nothing here
 *  is adjusted after seeing the outcome: thresholds and nulls are fixed below.
 *
 *  Run: npm run hypotheses   → docs/studio/evidence/hypotheses.json
 * ======================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { analyze, buildSurah, parseCorpus, type SurahSource } from '../src/lib/corpus';
import { stitchBetween } from '../src/lib/engine/detectors';
import { FLAG, type UniversePayload, type UniverseRelations } from '../src/lib/universe/types';
import { indexRelations } from '../src/lib/universe/relations';
import { DEFAULT_VOYAGE_CONFIG, planVoyage } from '../src/lib/universe/voyage';
import { rngFrom } from '../src/lib/universe/rng';
import type { Discovery, Word } from '../src/lib/types';
import type { Seam } from '../src/lib/isnad';

const ROOT = process.cwd();
const read = <T>(...p: string[]) => JSON.parse(readFileSync(path.join(ROOT, ...p), 'utf8')) as T;
const U = read<UniversePayload>('data', 'universe', 'universe.json');
const R = read<UniverseRelations>('data', 'universe', 'relations.json');
const legacy = read<{ nodes: { s: number; a: number; p: [number, number, number] }[] }>('data', 'cosmos', 'nodes.json');
const meta = read<Record<number, SurahSource>>('data', 'corpus', 'meta.json');
const ALPHA = 0.01;
/** Upper tail of the standard normal, via erfc (Abramowitz & Stegun 7.1.26, |ε| < 1.5e-7). */
function normalTail(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erfc = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
  return z >= 0 ? erfc / 2 : 1 - erfc / 2;
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

type Result = { id: string; claim: string; null: string; metric: Record<string, unknown>; p?: number; verdict: 'supported' | 'refused' | 'descriptive'; note: string };
const results: Result[] = [];
const log = (r: Result) => {
  results.push(r);
  console.log(`\n${r.id} [${r.verdict}] ${r.claim}`);
  console.log('   ', JSON.stringify(r.metric));
  if (r.p !== undefined) console.log(`    p = ${r.p}`);
  console.log(`    ${r.note}`);
};

const unit = (p: ArrayLike<number>, k: number) => {
  const x = p[k * 3], y = p[k * 3 + 1], z = p[k * 3 + 2];
  const r = Math.hypot(x, y, z) || 1;
  return [x / r, y / r, z / r];
};
const angle = (a: number[], b: number[]) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));

// ── engine pass: seams, discoveries, words, per surah ──────────────────────
const surahs: { id: number; words: Word[]; seams: Seam[]; discoveries: Discovery[] }[] = [];
for (let id = 1; id <= 114; id++) {
  const s = buildSurah(id, parseCorpus(readFileSync(path.join(ROOT, 'data', 'corpus', `${id}.txt`), 'utf8')), meta[id]);
  const a = analyze(s);
  surahs.push({ id, words: s.words, seams: a.seams, discoveries: a.discoveries });
}

// ── H1 ─────────────────────────────────────────────────────────────────────
{
  const rootKind = R.kinds.indexOf('root');
  const links = R.links.filter((l) => l[2] === rootKind);
  const cross = links.filter((l) => U.s[l[0]] !== U.s[l[1]]);
  const obsAll = mean(links.map(([a, b]) => angle(unit(U.p, a), unit(U.p, b))));
  const obsCross = mean(cross.map(([a, b]) => angle(unit(U.p, a), unit(U.p, b))));
  const rnd = rngFrom('H1');
  const REPS = 200;
  let leAll = 0;
  let leCross = 0;
  const nullAll: number[] = [];
  for (let r = 0; r < REPS; r++) {
    const m = mean(links.map(([a]) => angle(unit(U.p, a), unit(U.p, Math.floor(rnd() * U.count)))));
    nullAll.push(m);
    if (m <= obsAll) leAll++;
    const mc = mean(cross.map(([a]) => angle(unit(U.p, a), unit(U.p, Math.floor(rnd() * U.count)))));
    if (mc <= obsCross) leCross++;
  }
  // Legacy برج placement, same relation family, restricted to the thousand.
  const at = new Map(legacy.nodes.map((n, i) => [`${n.s}:${n.a}`, i]));
  const lp = legacy.nodes.flatMap((n) => n.p);
  const legLinks = links
    .map(([a, b]) => [at.get(`${U.s[a]}:${U.a[a]}`), at.get(`${U.s[b]}:${U.a[b]}`)])
    .filter((x): x is [number, number] => x[0] !== undefined && x[1] !== undefined);
  const obsLegacy = mean(legLinks.map(([a, b]) => angle(unit(lp, a), unit(lp, b))));
  let leLegacy = 0;
  for (let r = 0; r < REPS; r++) {
    const m = mean(legLinks.map(([a]) => angle(unit(lp, a), unit(lp, Math.floor(rnd() * legacy.nodes.length)))));
    if (m <= obsLegacy) leLegacy++;
  }
  const pAll = (leAll + 1) / (REPS + 1);
  const pCross = (leCross + 1) / (REPS + 1);
  const pLegacy = (leLegacy + 1) / (REPS + 1);
  log({
    id: 'H1',
    claim: 'Under the muṣḥaf-spiral placement, āyāt sharing a rare root lie closer in direction than random pairs — including across sūrahs — while the legacy برج placement shows no such locality.',
    null: 'one endpoint replaced by a uniformly random āyah (200 seeded draws); legacy: random legacy node',
    metric: {
      links: links.length,
      crossSurah: cross.length,
      meanAngleDeg: +(obsAll * 57.2958).toFixed(2),
      nullMeanAngleDeg: +(mean(nullAll) * 57.2958).toFixed(2),
      crossMeanAngleDeg: +(obsCross * 57.2958).toFixed(2),
      legacyLinks: legLinks.length,
      legacyMeanAngleDeg: +(obsLegacy * 57.2958).toFixed(2),
      pAll,
      pCross,
      pLegacy,
    },
    p: pAll,
    verdict: pAll < ALPHA && pCross < ALPHA && pLegacy >= ALPHA ? 'supported' : 'refused',
    note: 'Locality under muṣḥaf order is partly by construction: rare roots recur inside one story. The cross-sūrah figure is the part that is not.',
  });
}

// ── H2: the master metric's limit ──────────────────────────────────────────
{
  const W = 8;
  const rnd = rngFrom('H2');
  const seamScores: number[] = [];
  const randScores: number[] = [];
  let seamShared = 0;
  let randShared = 0;
  let wins = 0;
  let ties = 0;
  const ribatLen: number[] = [];
  for (const s of surahs) {
    const near = new Set<number>();
    for (const sm of s.seams) for (let d = -2; d <= 2; d++) near.add(sm.at + d);
    const candidates: number[] = [];
    for (let j = W; j < s.words.length - W; j++) if (!near.has(j)) candidates.push(j);
    for (const sm of s.seams) {
      if (sm.at < W || sm.at > s.words.length - W || !candidates.length) continue;
      const a = stitchBetween(s.words, sm.at - W, sm.at - 1, sm.at, sm.at + W);
      // Control: a non-seam point in the same sūrah, same window.
      const j = candidates[Math.floor(rnd() * candidates.length)];
      const b = stitchBetween(s.words, j - W, j - 1, j, j + W);
      seamScores.push(a.score);
      randScores.push(b.score);
      if (a.shared.length) seamShared++;
      if (b.shared.length) randShared++;
      if (a.score > b.score) wins++;
      else if (a.score === b.score) ties++;
    }
    for (const d of s.discoveries) if (d.kind === 'ribat') ribatLen.push(d.to - d.from + 1);
  }
  const n = seamScores.length;
  const decisive = n - ties;
  // One-sided sign test, normal approximation (n is in the thousands).
  const z = (wins - decisive / 2) / Math.sqrt(decisive / 4);
  const p = normalTail(z);
  const diff = mean(seamScores) - mean(randScores);
  log({
    id: 'H2',
    claim: 'Lexical continuity across an isnād seam (the stitch half of رِباط = √(continuity × delta)) exceeds the continuity across an arbitrary non-seam point in the same sūrah.',
    null: 'paired control: a uniformly drawn non-seam word index (±2 excluded) in the same sūrah, same ±8-word windows',
    metric: {
      seams: n,
      meanStitchAtSeam: +mean(seamScores).toFixed(4),
      meanStitchAtControl: +mean(randScores).toFixed(4),
      difference: +diff.toFixed(4),
      sharedRootRateAtSeam: +(seamShared / n).toFixed(3),
      sharedRootRateAtControl: +(randShared / n).toFixed(3),
      seamWins: wins,
      ties,
      z: +z.toFixed(2),
      ribatSpanWords: ribatLen.length ? Math.round(mean(ribatLen)) : 0,
    },
    p: +p.toExponential(2),
    verdict: z > 2.58 ? 'supported' : 'refused',
    note: 'If refused, the continuity half of the master metric is a property of the text\'s vocabulary at that scale, not of seams; the metric then ranks seams by delta with a lexical gate, and should be read that way.',
  });
}

// ── H3 ─────────────────────────────────────────────────────────────────────
{
  const rnd = rngFrom('H3');
  const groups: number[][] = [];
  for (const s of U.surahs) {
    if (s.count < 12) continue;
    const ds: number[] = [];
    for (let k = s.first; k < s.first + s.count; k++) ds.push(U.d[k]);
    groups.push(ds);
  }
  const stat = (pick: (ds: number[]) => number[]) =>
    mean(groups.map((ds) => {
      const att = ds.filter((d) => d >= 0);
      const tail = pick(ds).filter((d) => d >= 0);
      return tail.length && att.length ? mean(tail) - mean(att) : 0;
    }));
  const obs = stat((ds) => ds.slice(-3));
  const REPS = 2000;
  let le = 0;
  for (let r = 0; r < REPS; r++) {
    const m = stat((ds) => {
      const out: number[] = [];
      const idx = new Set<number>();
      while (idx.size < 3) idx.add(Math.floor(rnd() * ds.length));
      for (const i of idx) out.push(ds[i]);
      return out;
    });
    if (m <= obs) le++;
  }
  const p = (le + 1) / (REPS + 1);
  log({
    id: 'H3',
    claim: 'The last three āyāt of a sūrah sit nearer to direct address (lower discourse distance) than the sūrah\'s own average.',
    null: 'three āyāt drawn at random within the same sūrah (2,000 seeded draws); sūrahs with ≥12 āyāt',
    metric: { surahs: groups.length, meanShift: +obs.toFixed(4) },
    p,
    verdict: p < ALPHA && obs < 0 ? 'supported' : 'refused',
    note: 'A shift is a shift in the engine\'s person tagging, not a claim about the closing of sūrahs as such.',
  });
}

// ── H4: interaction — what the seeded voyage actually buys ────────────────
{
  const adj = indexRelations(R, U.count);
  const att = (k: number) => (U.f[k] & FLAG.ATTRIBUTED) !== 0;
  const measure = (legs: number[]) => {
    const surahsSeen = new Set(legs.map((k) => U.s[k]));
    const revisits = legs.length - new Set(legs).size;
    let chord = 0;
    for (let i = 1; i < legs.length; i++) chord += Math.hypot(U.p[legs[i] * 3] - U.p[legs[i - 1] * 3], U.p[legs[i] * 3 + 1] - U.p[legs[i - 1] * 3 + 1], U.p[legs[i] * 3 + 2] - U.p[legs[i - 1] * 3 + 2]);
    return { surahs: surahsSeen.size, revisits, chord: chord / Math.max(1, legs.length - 1) };
  };
  const SEEDS = 100;
  const LEGS = 40;
  const runs = { voyage: [] as ReturnType<typeof measure>[], uniform: [] as ReturnType<typeof measure>[], tartib: [] as ReturnType<typeof measure>[] };
  for (let i = 0; i < SEEDS; i++) {
    const v = planVoyage(U.count, adj, att, { ...DEFAULT_VOYAGE_CONFIG, seed: `H4-${i}`, legs: LEGS });
    runs.voyage.push(measure(v.legs.map((l) => l.to)));
    const t = planVoyage(U.count, adj, att, { ...DEFAULT_VOYAGE_CONFIG, seed: `H4-${i}`, legs: LEGS, prefer: { tartib: 1, root: 0, motif: 0, discovery: 0 } });
    runs.tartib.push(measure(t.legs.map((l) => l.to)));
    // Uniform: same start, any neighbour with equal probability, no memory.
    const rnd = rngFrom(`H4u-${i}`);
    const walk = [v.legs[0].to];
    for (let s = 0; s < LEGS; s++) {
      const opts = adj[walk[walk.length - 1]];
      walk.push(opts[Math.floor(rnd() * opts.length)].to);
    }
    runs.uniform.push(measure(walk));
  }
  const summary = Object.fromEntries(
    Object.entries(runs).map(([k, v]) => [k, { surahs: +mean(v.map((x) => x.surahs)).toFixed(2), revisits: +mean(v.map((x) => x.revisits)).toFixed(2), chord: +mean(v.map((x) => x.chord)).toFixed(2) }]),
  );
  const better = runs.voyage.filter((x, i) => x.surahs > runs.uniform[i].surahs).length;
  log({
    id: 'H4',
    claim: 'A seeded voyage (evidence-weighted, with memory) visits more distinct sūrahs and revisits fewer āyāt in 40 legs than a uniform random walk over the same relations.',
    null: 'uniform random neighbour walk from the same start (no weights, no memory); also a muṣḥaf-order-only walk',
    metric: { seeds: SEEDS, legs: LEGS, ...summary, voyageBeatsUniformOnSurahs: `${better}/${SEEDS}` },
    verdict: better >= 0.8 * SEEDS && (summary.voyage as { revisits: number }).revisits < (summary.uniform as { revisits: number }).revisits ? 'supported' : 'refused',
    note: 'An interaction claim: the voyage is worth its parameters only if it shows more of the text per minute than chance.',
  });
}

// ── H5: precision — is the floating origin doing anything here? ──────────
{
  let worstAbs = 0;
  let worstRel = 0;
  for (let k = 0; k < U.count; k++) {
    for (let c = 0; c < 3; c++) {
      const x = U.p[k * 3 + c];
      worstAbs = Math.max(worstAbs, Math.abs(Math.fround(x) - x));
      // Camera-relative: the worst case is a vertex up to REBASE + field radius away.
      const r = x - 64;
      worstRel = Math.max(worstRel, Math.abs(Math.fround(r) - r));
    }
  }
  const skyErr = Math.abs(Math.fround(900.123456) - 900.123456);
  // Pixel size of a world error seen at the standoff distance (9u), 60° fov, 2000 px tall.
  const px = (err: number, dist = 9) => (err / (2 * dist * Math.tan(Math.PI / 6))) * 2000;
  // Coordinate magnitude at which float32 spacing becomes half a pixel at 9u.
  const halfPx = (0.5 / 2000) * 2 * 9 * Math.tan(Math.PI / 6);
  const magAtHalfPx = halfPx * 2 ** 23;
  log({
    id: 'H5',
    claim: 'At this field\'s scale, the floating origin is needed to keep vertex quantisation below visibility.',
    null: 'absolute float32 coordinates with no rebasing',
    metric: {
      worstAbsErr: worstAbs.toExponential(2),
      worstAbsErrPx: px(worstAbs).toExponential(2),
      worstRelErr: worstRel.toExponential(2),
      skyShellErr: skyErr.toExponential(2),
      magnitudeWhereHalfPixel: Math.round(magAtHalfPx),
    },
    verdict: px(worstAbs) > 0.5 ? 'supported' : 'refused',
    note: `Absolute float32 error at the field's scale is ${px(worstAbs).toExponential(1)} px at the closest viewing distance. Whatever the verdict, the floating origin is insurance for free flight far outside the field, which nothing prevents.`,
  });
}

// ── H6: where the unattributed āyāt are ───────────────────────────────────
{
  const MUQATTAAT = new Set([2, 3, 7, 10, 11, 12, 13, 14, 15, 19, 20, 26, 27, 28, 29, 30, 31, 32, 36, 38, 40, 41, 42, 43, 44, 45, 46, 50, 68]);
  let total = 0;
  let first = 0;
  let muq = 0;
  let short = 0;
  const per: number[] = [];
  for (const s of U.surahs) {
    let c = 0;
    for (let k = s.first; k < s.first + s.count; k++) {
      if (U.f[k] & FLAG.ATTRIBUTED) continue;
      c++;
      total++;
      if (U.a[k] === 1) first++;
      if (U.a[k] === 1 && MUQATTAAT.has(s.id)) muq++;
      if (U.f[k] & FLAG.SHORT) short++;
    }
    per.push(c);
  }
  const rate = total / U.count;
  let chi = 0;
  U.surahs.forEach((s, i) => {
    const e = s.count * rate;
    chi += (per[i] - e) ** 2 / e;
  });
  // df = 113; the 0.1% critical value is ≈ 164.
  const top = U.surahs.map((s, i) => ({ s: s.id, name: s.name, n: per[i], share: +(per[i] / s.count).toFixed(2) })).sort((a, b) => b.share - a.share).slice(0, 6);
  log({
    id: 'H6',
    claim: 'Āyāt with no person mass are not spread evenly over the muṣḥaf; they concentrate in particular sūrahs beyond what sūrah length explains.',
    null: 'each sūrah receives unattributed āyāt in proportion to its āyah count (χ², df = 113)',
    metric: { unattributed: total, chi2: +chi.toFixed(1), critical001: 164, firstAyahs: first, muqattaatOpenings: muq, short, top },
    verdict: chi > 164 ? 'supported' : 'refused',
    note: 'Descriptive of the tagging, not of the text: an āyah has no person mass when no segment the engine reads as attribution carries a person.',
  });
}

const out = path.join(ROOT, 'docs', 'studio', 'evidence');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'hypotheses.json'), JSON.stringify({ alpha: ALPHA, seeded: true, results }, null, 2) + '\n');
console.log(`\nwritten docs/studio/evidence/hypotheses.json — ${results.filter((r) => r.verdict === 'supported').length} supported, ${results.filter((r) => r.verdict === 'refused').length} refused`);
