#!/usr/bin/env tsx
/* ===========================================================================
 *  ingest-cosmos.ts - place a thousand āyāt in isnād space.
 *
 *  Selection is not random and not "the famous ones". Every āyah is scored for
 *  how much the isnād engine actually found in it - discoveries, seams, marker
 *  hits, time tension - and the strongest thousand are placed.
 *
 *  Placement is meaning, not decoration:
 *
 *    direction  the برج realm the āyah is anchored to, as a unit vector from
 *               that constellation's real RA/Dec
 *    radius     discourse distance. المخاطب sits near you, الغائب sits far out.
 *               Flying inward is literally moving toward direct address.
 *    colour     the dominant person in the āyah's isnād
 *
 *  السنابل - each node keeps seven branches, after 2:261: حَبَّةٍ أَنۢبَتَتْ سَبْعَ
 *  سَنَابِلَ فِى كُلِّ سُنۢبُلَةٍ مِّا۟ئَةُ حَبَّةٍ. Seven per grain is the text's own
 *  branching factor, and it is what the navigation walks.
 *
 *  Run: npm run ingest:cosmos
 * ======================================================================== */
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSurah, analyze, parseCorpus, type SurahSource } from '../src/lib/corpus';
import { timeVectorOf, timeAxisOf, timeTensionOf, MODALITIES } from '../src/lib/time-module';
import type { Discovery, Word } from '../src/lib/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(DATA, 'cosmos');

const TARGET = 1000;
/** 2:261 — سَبْعَ سَنَابِلَ. The branching factor is the text's, not a tuning knob. */
const SANABIL = 7;

interface Candidate {
  s: number;
  a: number;
  text: string;
  vec: [number, number, number];
  distance: number;
  sig: string;
  time: number[];
  axis: number;
  tension: number;
  score: number;
  kind: string | null;
  note: string | null;
  roots: string[];
  con: string;
  words: number;
}

const log = (...x: unknown[]) => console.log('  ', ...x);

/** Deterministic hash → [0,1), so placement is stable across rebuilds. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

async function main() {
  console.log('\n  cosmos ingestion\n  ' + '-'.repeat(56));

  const meta = JSON.parse(
    await readFile(path.join(DATA, 'corpus', 'meta.json'), 'utf8'),
  ) as Record<number, SurahSource>;
  const sky = JSON.parse(await readFile(path.join(DATA, 'sky', 'sky.json'), 'utf8')) as {
    constellations: { id: string; ar: string; zodiac: boolean; centre: [number, number] }[];
  };
  const alam = JSON.parse(
    await readFile(path.join(DATA, 'index', 'aalam.json'), 'utf8'),
  ) as Record<string, { hits: { surah: number; ayah: number }[] }>;

  // Marker hits per locus, so a marked āyah is more likely to be placed.
  const marked = new Map<string, number>();
  for (const entry of Object.values(alam)) {
    for (const h of entry.hits) {
      const k = `${h.surah}:${h.ayah}`;
      marked.set(k, (marked.get(k) ?? 0) + 1);
    }
  }

  const constellations = sky.constellations.filter((c) => c.centre);
  const zodiac = constellations.filter((c) => c.zodiac);

  const candidates: Candidate[] = [];

  for (let id = 1; id <= 114; id++) {
    const rows = parseCorpus(await readFile(path.join(DATA, 'corpus', `${id}.txt`), 'utf8'));
    const surah = buildSurah(id, rows, meta[id]);
    const { discoveries, seams } = analyze(surah);

    const bestAt = new Map<number, Discovery>();
    for (const d of discoveries) {
      for (let n = d.ayahFrom; n <= d.ayahTo; n++) if (!bestAt.has(n)) bestAt.set(n, d);
    }
    const seamCount = new Map<number, number>();
    for (const s of seams) seamCount.set(s.ayah, (seamCount.get(s.ayah) ?? 0) + 1);

    for (const ay of surah.ayaat) {
      const span: Word[] = surah.words.slice(ay.from, ay.to);
      if (span.length < 3) continue; // فواتح and one-word āyāt carry no trajectory

      const segs = span.flatMap((w) =>
        w.segments.map((sg) => ({ tense: sg.tense, tag: sg.tag, lemma: sg.lemma })),
      );
      const time = timeVectorOf(segs);
      const axis = timeAxisOf(time);
      const tension = timeTensionOf(time);

      const d = bestAt.get(ay.n);
      const seamsHere = seamCount.get(ay.n) ?? 0;
      const markerHits = marked.get(`${id}:${ay.n}`) ?? 0;

      // What makes an āyah worth placing: the engine found something, the
      // attribution moves inside it, a construct is named, and time is doing
      // work. Length is deliberately not a factor.
      const score =
        (d ? d.score * 1.5 : 0) +
        Math.min(seamsHere, 6) * 0.16 +
        Math.min(markerHits, 4) * 0.32 +
        tension * 0.9 +
        ay.clock.bridge * 0.5;

      const roots = [
        ...new Set(span.flatMap((w) => w.segments.filter((s) => s.root && !s.clitic).map((s) => s.root!))),
      ];

      // Direction: a برج realm, chosen stably from the locus.
      const con = zodiac[Math.floor(hash01(`c${id}:${ay.n}`) * zodiac.length)]?.id ?? 'Ari';

      candidates.push({
        s: id,
        a: ay.n,
        text: ay.uthmani ?? ay.text,
        vec: [+ay.vec.p1.toFixed(3), +ay.vec.p2.toFixed(3), +ay.vec.p3.toFixed(3)],
        distance: +ay.distance.toFixed(3),
        sig: ay.sig,
        time,
        axis: +axis.toFixed(3),
        tension: +tension.toFixed(3),
        score: +score.toFixed(4),
        kind: d?.kind ?? null,
        note: d?.note ?? null,
        roots,
        con,
        words: span.length,
      });
    }
    if (id % 25 === 0) log(`scored through sūrah ${id} — ${candidates.length.toLocaleString()} candidates`);
  }

  log(`scored ${candidates.length.toLocaleString()} āyāt`);

  // A declared lemma that matches nothing is a typo, not a rare word: Arabic
  // diacritics have no canonical order, so two visually identical strings can
  // differ in bytes. Fail loudly rather than shipping a modality that is
  // silently always zero.
  const dead = MODALITIES.filter((m, k) => {
    if (!m.match.lemmas?.length) return false;
    return !candidates.some((c) => c.time[k] > 0);
  });
  if (dead.length) {
    throw new Error(
      `these modalities matched nothing in the corpus (check the lemma bytes): ${dead
        .map((m) => `${m.id} [${m.match.lemmas?.join(', ')}]`)
        .join('; ')}`,
    );
  }

  // Take the strongest, but spread them: no sūrah may swamp the sky.
  const perSurahCap = Math.ceil((TARGET / 114) * 3.2);
  const bySurah = new Map<number, number>();
  const chosen: Candidate[] = [];
  for (const c of [...candidates].sort((x, y) => y.score - x.score)) {
    if (chosen.length >= TARGET) break;
    const n = bySurah.get(c.s) ?? 0;
    if (n >= perSurahCap) continue;
    bySurah.set(c.s, n + 1);
    chosen.push(c);
  }
  log(`chose ${chosen.length} across ${bySurah.size} sūrahs (cap ${perSurahCap} per sūrah)`);

  // ── placement ─────────────────────────────────────────────────────────────
  const conById = new Map(constellations.map((c) => [c.id, c]));
  const RAD = Math.PI / 180;

  const nodes = chosen.map((c, i) => {
    const con = conById.get(c.con)!;
    const [ra, dec] = con.centre;
    // Scatter around the realm's centre so a برج reads as a region, not a point.
    const jr = (hash01(`r${c.s}:${c.a}`) - 0.5) * 26;
    const jd = (hash01(`d${c.s}:${c.a}`) - 0.5) * 22;
    const A = (ra + jr) * RAD;
    const D = (dec + jd) * RAD;

    // Radius is discourse distance: المناجاة close, الغيبة far.
    const r = 18 + c.distance * 78 + hash01(`z${c.s}:${c.a}`) * 6;

    return {
      i,
      s: c.s,
      a: c.a,
      name: meta[c.s].name,
      text: c.text,
      p: [
        +(r * Math.cos(D) * Math.cos(A)).toFixed(2),
        +(r * Math.sin(D)).toFixed(2),
        +(r * Math.cos(D) * Math.sin(A)).toFixed(2),
      ] as [number, number, number],
      v: c.vec,
      d: c.distance,
      sig: c.sig,
      tm: c.time,
      ax: c.axis,
      tn: c.tension,
      k: c.kind,
      note: c.note,
      con: c.con,
      conAr: con.ar,
      sb: [] as number[],
    };
  });

  // ── السنابل: seven branches from every grain ──────────────────────────────
  const rootsOf = new Map<number, Set<string>>();
  chosen.forEach((c, i) => rootsOf.set(i, new Set(c.roots)));

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    const ra = rootsOf.get(i)!;
    const scored: { j: number; w: number }[] = [];

    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const b = nodes[j];
      // Shared roots bind hardest; then a like isnād profile; then nearness in
      // time-axis. Same-sūrah neighbours are damped so branches actually travel.
      const rb = rootsOf.get(j)!;
      let shared = 0;
      for (const r of ra) if (rb.has(r)) shared++;
      const isnad =
        1 - (Math.abs(a.v[0] - b.v[0]) + Math.abs(a.v[1] - b.v[1]) + Math.abs(a.v[2] - b.v[2])) / 2;
      const time = 1 - Math.abs(a.ax - b.ax) / 2;
      const w =
        Math.min(shared, 6) * 0.5 + isnad * 1.1 + time * 0.6 + (a.s === b.s ? -0.55 : 0) +
        (a.k && a.k === b.k ? 0.35 : 0);
      scored.push({ j, w });
    }

    scored.sort((x, y) => y.w - x.w);
    a.sb = scored.slice(0, SANABIL).map((x) => x.j);
  }

  await mkdir(OUT, { recursive: true });
  await writeFile(
    path.join(OUT, 'nodes.json'),
    JSON.stringify({
      builtAt: new Date().toISOString(),
      count: nodes.length,
      sanabil: SANABIL,
      modalities: MODALITIES.map((m) => ({ id: m.id, label: m.label, code: m.code, hue: m.hue, axis: m.axis, gloss: m.gloss })),
      nodes,
    }),
  );

  const bytes = (await stat(path.join(OUT, 'nodes.json'))).size;
  const withKind = nodes.filter((n) => n.k).length;
  const modalityTotals = MODALITIES.map((m, k) => `${m.code}:${nodes.reduce((t, n) => t + (n.tm[k] > 0 ? 1 : 0), 0)}`);

  console.log('  ' + '-'.repeat(56));
  log(`nodes          ${nodes.length}`);
  log(`with a finding ${withKind}`);
  log(`branches       ${nodes.length * SANABIL} (${SANABIL} per node)`);
  log(`radius range   ${Math.min(...nodes.map((n) => Math.hypot(...n.p))).toFixed(0)} … ${Math.max(...nodes.map((n) => Math.hypot(...n.p))).toFixed(0)}`);
  log(`written        ${(bytes / 1024).toFixed(0)} KB`);
  console.log('\n   āyāt carrying each modality:');
  console.log('     ' + modalityTotals.join('  '));
  console.log('\n  done\n');
}

main().catch((e) => {
  console.error('\n  cosmos ingestion failed:', e);
  process.exit(1);
});
