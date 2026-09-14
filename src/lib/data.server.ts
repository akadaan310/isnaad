import 'server-only';
// ============================================================================
//  The request path: read /data, rebuild, cache.
//
//  Sūrahs are rebuilt from their morphology rows rather than read pre-baked
//  (see src/lib/corpus.ts). Al-Baqarah, the longest, costs ~80ms; everything
//  else is far less, and each analysis is memoised per detector-option set so
//  the cost is paid once per configuration.
// ============================================================================
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  analyze,
  buildSurah,
  parseCorpus,
  type AnalyzedSurah,
  type SurahSource,
} from './corpus';
import { DEFAULT_OPTIONS, type DetectorOptions } from './engine/detectors';
import type { AyahIndexRow, RootIndex } from './engine/graph';
import type { AlamIndex } from './aalam';
import type { Discovery, Motif, SurahMeta } from './types';
import type { CosmosPayload } from './cosmos/types';

const DATA = path.join(process.cwd(), 'data');

/** Bounded so a long-lived dev server cannot hold all 114 sūrahs at once. */
const MAX_CACHED = 12;
const surahCache = new Map<string, AnalyzedSurah>();

async function readJson<T>(...segments: string[]): Promise<T> {
  return JSON.parse(await readFile(path.join(DATA, ...segments), 'utf8')) as T;
}

/** Module-level singletons: each index is read once per server process. */
function once<T>(loader: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => (p ??= loader());
}

export const getSurahMetas = once(() => readJson<SurahMeta[]>('surahs.json'));
export const getCorpusMeta = once(() => readJson<Record<number, SurahSource>>('corpus', 'meta.json'));
export const getAyahIndex = once(() => readJson<AyahIndexRow[]>('index', 'ayaat.json'));
export const getMotifs = once(() => readJson<Motif[]>('index', 'motifs.json'));
export const getRootIndex = once(() => readJson<RootIndex>('index', 'roots.json'));
export const getTopDiscoveries = once(() => readJson<Discovery[]>('index', 'discoveries.json'));
export const getCosmos = once(() => readJson<CosmosPayload>('cosmos', 'nodes.json'));
export const getManifest = once(() => readJson<Record<string, unknown>>('index', 'manifest.json'));
export const getAlamIndex = once(() => readJson<AlamIndex>('index', 'aalam.json'));

function optionsKey(o: DetectorOptions): string {
  return `${o.stitchWindow}.${o.echoWindow}.${o.minAbsenceRun}.${o.minNarrativeRun}.${o.minScore}`;
}

export async function loadSurah(
  id: number,
  opt: DetectorOptions = DEFAULT_OPTIONS,
): Promise<AnalyzedSurah> {
  if (!Number.isInteger(id) || id < 1 || id > 114) {
    throw new Error(`surah out of range: ${id}`);
  }
  const cacheKey = `${id}|${optionsKey(opt)}`;
  const hit = surahCache.get(cacheKey);
  if (hit) {
    // Refresh recency so the eviction below stays roughly LRU.
    surahCache.delete(cacheKey);
    surahCache.set(cacheKey, hit);
    return hit;
  }

  const [meta, body] = await Promise.all([
    getCorpusMeta(),
    readFile(path.join(DATA, 'corpus', `${id}.txt`), 'utf8'),
  ]);
  const source = meta[id];
  if (!source) throw new Error(`no corpus metadata for surah ${id}`);

  const analyzed = analyze(buildSurah(id, parseCorpus(body), source), opt);

  surahCache.set(cacheKey, analyzed);
  while (surahCache.size > MAX_CACHED) {
    const oldest = surahCache.keys().next().value;
    if (oldest === undefined) break;
    surahCache.delete(oldest);
  }
  return analyzed;
}

/** Read detector options off a query string, clamped to sane bounds. */
export function optionsFromQuery(params: URLSearchParams): DetectorOptions {
  const num = (name: string, fallback: number, lo: number, hi: number) => {
    const raw = params.get(name);
    if (raw === null) return fallback;
    const v = Number(raw);
    return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
  };
  return {
    stitchWindow: num('stitchWindow', DEFAULT_OPTIONS.stitchWindow, 2, 40),
    echoWindow: num('echoWindow', DEFAULT_OPTIONS.echoWindow, 4, 80),
    minAbsenceRun: num('minAbsenceRun', DEFAULT_OPTIONS.minAbsenceRun, 1, 12),
    minNarrativeRun: num('minNarrativeRun', DEFAULT_OPTIONS.minNarrativeRun, 1, 20),
    minScore: num('minScore', DEFAULT_OPTIONS.minScore, 0, 0.95),
  };
}

/**
 * The client renders from parsed fields, never from raw feature strings, so
 * `feats` is dropped on the way out - it is roughly an eighth of the payload
 * and nothing on the client reads it.
 */
export function toWire(a: AnalyzedSurah) {
  return {
    ...a.surah,
    words: a.surah.words.map((w) => ({
      ...w,
      segments: w.segments.map(({ feats: _feats, ...rest }) => rest),
    })),
    frames: a.frames,
    seams: a.seams,
    discoveries: a.discoveries,
  };
}

export type WireSurah = ReturnType<typeof toWire>;
