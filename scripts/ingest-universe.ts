#!/usr/bin/env tsx
/* ===========================================================================
 *  ingest-universe.ts — every āyah, placed. No target, no cap, no filter.
 *
 *  Writes:
 *    data/universe/universe.json   6,236 rows, columnar (see lib/universe/types)
 *    data/universe/relations.json  computed relations over all 6,236
 *    data/universe/manifest.json   counts, sha256 of each file, legacy check
 *
 *  And proves, in the same pass, that the legacy 1,000-āyah preset is still
 *  reconstructible: the original selection rule is re-run over the same
 *  engine output and compared, locus by locus and in order, with the committed
 *  data/cosmos/nodes.json. A mismatch fails the ingest.
 *
 *  Run: npm run ingest:universe
 * ======================================================================== */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyze, buildSurah, parseCorpus, type SurahSource } from '../src/lib/corpus';
import { timeVectorOf, timeTensionOf } from '../src/lib/time-module';
import type { Discovery, Motif, Word } from '../src/lib/types';
import type { RootIndex } from '../src/lib/engine/graph';
import { legacyScore, selectLegacy, LEGACY_PRESET, legacyCap } from '../src/lib/cosmos/legacy-preset';
import { buildUniverse, measureUniverse, ordinalOf, type AyahRow } from '../src/lib/universe/build';
import { buildRelations } from '../src/lib/universe/relations';
import type { UniverseManifest } from '../src/lib/universe/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(DATA, 'universe');

const log = (...x: unknown[]) => console.log('  ', ...x);
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

async function main() {
  console.log('\n  universe ingestion — all 6,236\n  ' + '-'.repeat(56));
  const t0 = performance.now();

  const meta = JSON.parse(await readFile(path.join(DATA, 'corpus', 'meta.json'), 'utf8')) as Record<number, SurahSource>;
  const alam = JSON.parse(await readFile(path.join(DATA, 'index', 'aalam.json'), 'utf8')) as Record<
    string,
    { hits: { surah: number; ayah: number }[] }
  >;
  const legacyNodes = JSON.parse(await readFile(path.join(DATA, 'cosmos', 'nodes.json'), 'utf8')) as {
    nodes: { i: number; s: number; a: number }[];
  };
  const roots = JSON.parse(await readFile(path.join(DATA, 'index', 'roots.json'), 'utf8')) as RootIndex;
  const motifs = JSON.parse(await readFile(path.join(DATA, 'index', 'motifs.json'), 'utf8')) as Motif[];

  const marked = new Map<string, number>();
  for (const entry of Object.values(alam)) {
    for (const h of entry.hits) marked.set(`${h.surah}:${h.ayah}`, (marked.get(`${h.surah}:${h.ayah}`) ?? 0) + 1);
  }
  const legacyAt = new Map(legacyNodes.nodes.map((n) => [`${n.s}:${n.a}`, n.i]));

  const rows: AyahRow[] = [];
  const legacyCandidates: { s: number; a: number; score: number; words: number }[] = [];
  const allDiscoveries: Discovery[] = [];

  for (let id = 1; id <= 114; id++) {
    const body = await readFile(path.join(DATA, 'corpus', `${id}.txt`), 'utf8');
    const surah = buildSurah(id, parseCorpus(body), meta[id]);
    const { discoveries, seams } = analyze(surah);
    allDiscoveries.push(...discoveries);

    // As ingest-cosmos.ts did it: the *first* discovery covering an āyah.
    const firstAt = new Map<number, Discovery>();
    // And, for the universe, the strongest and the count.
    const strongest = new Map<number, Discovery>();
    const count = new Map<number, number>();
    for (const d of discoveries) {
      for (let n = d.ayahFrom; n <= d.ayahTo; n++) {
        if (!firstAt.has(n)) firstAt.set(n, d);
        const s = strongest.get(n);
        if (!s || d.score > s.score) strongest.set(n, d);
        count.set(n, (count.get(n) ?? 0) + 1);
      }
    }
    const seamCount = new Map<number, number>();
    for (const s of seams) seamCount.set(s.ayah, (seamCount.get(s.ayah) ?? 0) + 1);

    for (const ay of surah.ayaat) {
      const span: Word[] = surah.words.slice(ay.from, ay.to);
      const segs = span.flatMap((w) => w.segments.map((sg) => ({ tense: sg.tense, tag: sg.tag, lemma: sg.lemma })));
      const tension = timeTensionOf(timeVectorOf(segs));
      const key = `${id}:${ay.n}`;

      legacyCandidates.push({
        s: id,
        a: ay.n,
        words: span.length,
        score: legacyScore({
          discoveryScore: firstAt.get(ay.n)?.score ?? null,
          seams: seamCount.get(ay.n) ?? 0,
          markerHits: marked.get(key) ?? 0,
          tension,
          bridge: ay.clock.bridge,
        }),
      });

      rows.push({
        s: id,
        a: ay.n,
        name: meta[id].name,
        v: [ay.vec.p1, ay.vec.p2, ay.vec.p3],
        d: ay.distance,
        sig: ay.sig,
        words: span.length,
        discoveries: count.get(ay.n) ?? 0,
        kind: strongest.get(ay.n)?.kind ?? null,
        seams: seamCount.get(ay.n) ?? 0,
        marked: marked.has(key),
        legacy: legacyAt.get(key) ?? -1,
        analyzed: true,
      });
    }
    if (id % 38 === 0) log(`analysed through sūrah ${id} — ${rows.length.toLocaleString()} āyāt`);
  }

  // ── the legacy preset, re-derived ───────────────────────────────────────
  const reselected = selectLegacy(legacyCandidates, LEGACY_PRESET);
  let mismatches = 0;
  reselected.forEach((c, i) => {
    const n = legacyNodes.nodes[i];
    if (!n || n.s !== c.s || n.a !== c.a) mismatches++;
  });
  mismatches += Math.abs(legacyNodes.nodes.length - reselected.length);
  log(`legacy preset re-derived: ${reselected.length} chosen, cap ${legacyCap()} per sūrah, ${mismatches} mismatches`);
  if (mismatches) throw new Error(`legacy preset no longer reconstructs (${mismatches} mismatches)`);

  // ── the universe ──────────────────────────────────────────────────────────
  const universe = buildUniverse(rows);
  const ord = (s: number, a: number) => ordinalOf(universe, s, a);
  const relations = buildRelations(universe.count, ord, roots, motifs, allDiscoveries);
  const counts = measureUniverse(universe, rows.filter((r) => r.analyzed).length);

  await mkdir(OUT, { recursive: true });
  const uJson = JSON.stringify(universe);
  const rJson = JSON.stringify(relations);
  await writeFile(path.join(OUT, 'universe.json'), uJson);
  await writeFile(path.join(OUT, 'relations.json'), rJson);

  const manifest: UniverseManifest = {
    builtAt: new Date().toISOString(),
    version: universe.version,
    counts,
    sha256: { 'universe.json': sha(uJson), 'relations.json': sha(rJson) },
    legacy: {
      reconstructed: mismatches === 0,
      count: reselected.length,
      mismatches,
      note: 'legacy-highlight-1000: score-ranked, ≤29 per sūrah, ≥3 words. Kept as a named preset; not used by full-universe mode.',
    },
    sources: ['data/corpus/*.txt', 'data/corpus/meta.json', 'data/index/roots.json', 'data/index/motifs.json', 'data/index/aalam.json', 'data/cosmos/nodes.json'],
  };
  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  const byKind = relations.kinds.map((k, i) => `${k}:${relations.links.filter((l) => l[2] === i).length}`);
  console.log('  ' + '-'.repeat(56));
  log(`corpus ${counts.corpus} · analysed ${counts.analyzed} · detected ${counts.detected} (discovery ${counts.withDiscovery}) · placed ${counts.placed}`);
  log(`discoveries in the full sweep ${allDiscoveries.length}`);
  log(`unattributed ${counts.unattributed} · short ${counts.short} · legacy preset ${counts.legacyPreset}`);
  log(`relations ${relations.links.length} (${byKind.join('  ')})`);
  log(`universe.json ${(uJson.length / 1024).toFixed(0)} KB · relations.json ${(rJson.length / 1024).toFixed(0)} KB`);
  log(`${((performance.now() - t0) / 1000).toFixed(1)} s\n`);
}

main().catch((e) => {
  console.error('\n  universe ingestion failed:', e);
  process.exit(1);
});
