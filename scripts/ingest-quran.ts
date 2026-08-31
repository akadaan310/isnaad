#!/usr/bin/env tsx
/* ===========================================================================
 *  ingest-quran.ts - build the corpus and the global indices under /data
 *
 *  Sources (both open, both fetched over plain HTTPS, both cached in .cache/):
 *    - mustafa0x/quran-morphology: the Quranic Arabic Corpus v0.4 morphology,
 *      Buckwalter resolved to Arabic. Word-by-word, segment-by-segment.
 *    - risan/quran-json: Uthmani text plus surah metadata, used for the
 *      mushaf rendering and the Arabic surah names.
 *
 *  What gets written:
 *    data/corpus/<n>.txt    the morphology rows for one surah, verbatim
 *    data/corpus/meta.json  surah names, types, and Uthmani ayah text
 *    data/index/*.json      the globally-mined layer: mathani motifs, the
 *                           per-ayah vector index, the strongest discoveries
 *
 *  Nothing derived is written per surah. Spines, seams, frames and discoveries
 *  are rebuilt from the rows on request - see src/lib/corpus.ts for why.
 *
 *  Usage:
 *    npm run ingest              # build /data, downloading sources if absent
 *    npm run ingest:refresh      # re-download the sources first
 *    npm run ingest -- --push-supabase
 * ======================================================================== */
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSurah, analyze, parseCorpus, type CorpusRow, type SurahSource } from '../src/lib/corpus';
import { contourOf } from '../src/lib/isnad';
import { DEFAULT_OPTIONS } from '../src/lib/engine/detectors';
import { mineMotifs, encodeContour, type ContourPosition } from '../src/lib/engine/motifs';
import { mineAlam } from '../src/lib/engine/aalam-miner';
import { AALAM, type AlamIndex } from '../src/lib/aalam';
import type { Discovery, SurahMeta } from '../src/lib/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache');
const DATA = path.join(ROOT, 'data');

const SOURCES = {
  morphology: {
    url: 'https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt',
    file: 'quran-morphology.txt',
  },
  text: {
    url: 'https://raw.githubusercontent.com/risan/quran-json/main/dist/quran.json',
    file: 'quran.json',
  },
};

const log = (...a: unknown[]) => console.log('  ', ...a);

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function fetchCached(url: string, file: string, refresh: boolean): Promise<string> {
  await mkdir(CACHE, { recursive: true });
  const dest = path.join(CACHE, file);
  if (!refresh && (await exists(dest))) {
    log(`cache hit   ${file}`);
    return readFile(dest, 'utf8');
  }
  log(`downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
  return readFile(dest, 'utf8');
}

interface SourceSurah {
  id: number;
  name: string;
  transliteration: string;
  type: string;
  total_verses: number;
  verses: { id: number; text: string }[];
}

async function main() {
  const args = process.argv.slice(2);
  const refresh = args.includes('--refresh');
  const push = args.includes('--push-supabase');

  console.log('\n  isnad observatory - ingestion\n  ' + '-'.repeat(56));

  const [morphRaw, textRaw] = await Promise.all([
    fetchCached(SOURCES.morphology.url, SOURCES.morphology.file, refresh),
    fetchCached(SOURCES.text.url, SOURCES.text.file, refresh),
  ]);

  const textJson = JSON.parse(textRaw) as Record<string, SourceSurah>;
  const sourceById = new Map<number, SourceSurah>();
  for (const k of Object.keys(textJson)) sourceById.set(textJson[k].id, textJson[k]);

  // -- split the morphology by surah, keeping the rows verbatim --------------
  const linesBySurah = new Map<number, string[]>();
  let lineNo = 0;
  let skipped = 0;
  for (const line of morphRaw.split('\n')) {
    lineNo++;
    if (!line.trim()) continue;
    const tab = line.indexOf('\t');
    const loc = tab < 0 ? line : line.slice(0, tab);
    const parts = loc.split(':');
    if (parts.length !== 4) {
      skipped++;
      console.warn(`   skipping malformed locator at line ${lineNo}: ${loc}`);
      continue;
    }
    const s = Number(parts[0]);
    if (!Number.isFinite(s) || s < 1 || s > 114) {
      skipped++;
      continue;
    }
    // Drop the surah number from the locator; the filename already carries it.
    const arr = linesBySurah.get(s) ?? [];
    arr.push(parts.slice(1).join(':') + line.slice(tab));
    linesBySurah.set(s, arr);
  }
  log(`parsed ${lineNo.toLocaleString()} morphology lines across ${linesBySurah.size} surahs${skipped ? ` (${skipped} skipped)` : ''}`);

  // Rebuild /data from scratch so a stale layout can never survive an ingest.
  await rm(path.join(DATA, 'surah'), { recursive: true, force: true });
  await rm(path.join(DATA, 'corpus'), { recursive: true, force: true });
  await mkdir(path.join(DATA, 'corpus'), { recursive: true });
  await mkdir(path.join(DATA, 'index'), { recursive: true });

  const meta: Record<number, SurahSource> = {};
  const metas: SurahMeta[] = [];
  const allDiscoveries: Discovery[] = [];
  const contourChunks: string[] = [];
  const contourPositions: ContourPosition[] = [];
  const ayahIndex: {
    s: number; a: number; sig: string; d: number;
    v: [number, number, number]; c: number; w: number; k: number;
  }[] = [];
  /** root -> every (surah, ayah) it occurs in. Feeds the chamber walk. */
  const rootIndex = new Map<string, Set<string>>();
  /** أعلام -> every occurrence. Feeds the composer and the gallery. */
  const alamIndex: AlamIndex = {};
  for (const spec of AALAM) alamIndex[spec.id] = { id: spec.id, hits: [], spread: 0 };

  let totalWords = 0;

  for (let id = 1; id <= 114; id++) {
    const lines = linesBySurah.get(id);
    const src = sourceById.get(id);
    if (!lines || !src) throw new Error(`missing source data for surah ${id}`);

    const body = lines.join('\n') + '\n';
    await writeFile(path.join(DATA, 'corpus', `${id}.txt`), body);

    const source: SurahSource = {
      id,
      name: src.name,
      transliteration: src.transliteration,
      type: src.type,
      uthmani: src.verses.map((v) => v.text),
    };
    meta[id] = source;

    const rows: CorpusRow[] = parseCorpus(body);
    const surah = buildSurah(id, rows, source);
    const { discoveries } = analyze(surah, DEFAULT_OPTIONS);

    for (const w of surah.words) {
      if (w.person === null) continue;
      contourPositions.push({ surah: id, ayah: w.ayah, wordIdx: w.idx });
    }

    for (const w of surah.words) {
      for (const seg of w.segments) {
        if (!seg.root || seg.clitic) continue;
        const set = rootIndex.get(seg.root) ?? new Set<string>();
        set.add(`${id}:${w.ayah}`);
        rootIndex.set(seg.root, set);
      }
    }
    for (const spec of AALAM) alamIndex[spec.id].hits.push(...mineAlam(spec, surah));

    contourChunks.push(encodeContour(contourOf(surah.words)));

    for (const a of surah.ayaat) {
      const span = surah.words.slice(a.from, a.to);
      ayahIndex.push({
        s: id,
        a: a.n,
        sig: a.sig,
        d: +a.distance.toFixed(3),
        v: [+a.vec.p1.toFixed(3), +a.vec.p2.toFixed(3), +a.vec.p3.toFixed(3)],
        c: +a.clock.bridge.toFixed(3),
        w: span.length,
        k: span.filter((x) => x.khalq).length,
      });
    }

    const { ayaat: _ayaat, words: _words, ...metaOnly } = surah;
    metas.push(metaOnly);
    allDiscoveries.push(...discoveries);
    totalWords += surah.words.length;

    if (id % 20 === 0 || id === 114) {
      log(`surah ${String(id).padStart(3)} - ${totalWords.toLocaleString()} words - ${allDiscoveries.length.toLocaleString()} discoveries`);
    }
  }

  // -- al-mathani ------------------------------------------------------------
  // Surah contours are concatenated; a motif straddling a boundary would be
  // spurious, so a sentinel symbol separates them and is filtered out after.
  const encoded = contourChunks.join(' ');
  const positionsWithGaps: ContourPosition[] = [];
  {
    let p = 0;
    for (let c = 0; c < contourChunks.length; c++) {
      for (let k = 0; k < contourChunks[c].length; k++) positionsWithGaps.push(contourPositions[p++]);
      if (c < contourChunks.length - 1) positionsWithGaps.push({ surah: -1, ayah: -1, wordIdx: -1 });
    }
  }
  log(`mining mathani over ${encoded.length.toLocaleString()} isnad symbols...`);
  const motifs = mineMotifs(encoded, positionsWithGaps).filter((m) =>
    m.occurrences.every((o) => o.surah > 0),
  );
  log(`mined ${motifs.length} repeated contours (${motifs.filter((m) => m.mirrorOf).length} with mirrors)`);

  const topDiscoveries = [...allDiscoveries].sort((a, b) => b.score - a.score).slice(0, 2500);

  const roots: Record<string, [number, number][]> = {};
  for (const [root, places] of rootIndex) {
    roots[root] = [...places].map((p) => p.split(':').map(Number) as [number, number]);
  }
  log(`indexed ${Object.keys(roots).length.toLocaleString()} roots`);

  for (const entry of Object.values(alamIndex)) {
    entry.spread = new Set(entry.hits.map((h) => h.surah)).size;
  }
  const alamTotal = Object.values(alamIndex).reduce((n, e) => n + e.hits.length, 0);
  log(`resolved ${AALAM.length} أعلام to ${alamTotal.toLocaleString()} occurrences`);

  await Promise.all([
    writeFile(path.join(DATA, 'corpus', 'meta.json'), JSON.stringify(meta)),
    writeFile(path.join(DATA, 'surahs.json'), JSON.stringify(metas)),
    writeFile(path.join(DATA, 'index', 'motifs.json'), JSON.stringify(motifs)),
    writeFile(path.join(DATA, 'index', 'ayaat.json'), JSON.stringify(ayahIndex)),
    writeFile(path.join(DATA, 'index', 'discoveries.json'), JSON.stringify(topDiscoveries)),
    writeFile(path.join(DATA, 'index', 'roots.json'), JSON.stringify(roots)),
    writeFile(path.join(DATA, 'index', 'aalam.json'), JSON.stringify(alamIndex)),
    writeFile(
      path.join(DATA, 'index', 'manifest.json'),
      JSON.stringify(
        {
          builtAt: new Date().toISOString(),
          surahs: metas.length,
          ayaat: ayahIndex.length,
          words: totalWords,
          segments: lineNo,
          isnadSymbols: encoded.length - (contourChunks.length - 1),
          discoveries: allDiscoveries.length,
          motifs: motifs.length,
          roots: Object.keys(roots).length,
          aalam: AALAM.length,
          aalamHits: alamTotal,
          sources: SOURCES,
          detectorOptions: DEFAULT_OPTIONS,
        },
        null,
        2,
      ),
    ),
  ]);

  const byKind: Record<string, number> = {};
  for (const d of allDiscoveries) byKind[d.kind] = (byKind[d.kind] ?? 0) + 1;

  console.log('  ' + '-'.repeat(56));
  log(`ayaat     ${ayahIndex.length.toLocaleString()}`);
  log(`words     ${totalWords.toLocaleString()}`);
  log(`segments  ${lineNo.toLocaleString()}`);
  console.log('\n   discoveries by kind:');
  for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${k.padEnd(20)} ${String(v).padStart(6)}`);
  }

  if (push) await pushToSupabase(metas);
  console.log('\n  done - /data is built\n');
}

async function pushToSupabase(metas: SurahMeta[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('\n  ! --push-supabase needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; skipping');
    return;
  }
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(url, key, { auth: { persistSession: false } });
  console.log('\n   pushing to Supabase...');

  const { error } = await db.from('surahs').upsert(
    metas.map((m) => ({
      id: m.id,
      name: m.name,
      transliteration: m.transliteration,
      revelation_type: m.type,
      ayah_count: m.ayahCount,
      word_count: m.wordCount,
      juz_start: m.juzRange[0],
      juz_end: m.juzRange[1],
      p1: m.vec.p1,
      p2: m.vec.p2,
      p3: m.vec.p3,
      distance: m.distance,
      max_depth: m.maxDepth,
    })),
  );
  if (error) throw new Error(`surahs upsert failed: ${error.message}`);
  log(`upserted ${metas.length} surahs`);

  const meta = JSON.parse(
    await readFile(path.join(DATA, 'corpus', 'meta.json'), 'utf8'),
  ) as Record<number, SurahSource>;

  for (let id = 1; id <= 114; id++) {
    const rows = parseCorpus(await readFile(path.join(DATA, 'corpus', `${id}.txt`), 'utf8'));
    const surah = buildSurah(id, rows, meta[id]);
    analyze(surah, DEFAULT_OPTIONS);
    const { error: e1 } = await db.from('ayaat').upsert(
      surah.ayaat.map((a) => ({
        surah_id: id,
        ayah: a.n,
        text_uthmani: a.uthmani ?? a.text,
        text_segmented: a.text,
        juz: a.juz,
        p1: a.vec.p1,
        p2: a.vec.p2,
        p3: a.vec.p3,
        distance: a.distance,
        signature: a.sig,
        dominant_person: a.dominant,
        clock_bridge: a.clock.bridge,
      })),
      { onConflict: 'surah_id,ayah' },
    );
    if (e1) throw new Error(`ayaat upsert failed at surah ${id}: ${e1.message}`);
    if (id % 20 === 0) log(`   ... through surah ${id}`);
  }
  log('ayaat pushed. Word-level rows stay in /data by design - see README.');
}

main().catch((e) => {
  console.error('\n  ingestion failed:', e);
  process.exit(1);
});
