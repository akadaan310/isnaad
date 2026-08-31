import 'server-only';
// ============================================================================
//  The برج assembler.
//
//  Given a عَلَم, build a movement out of it. The pacing rule is the whole
//  point: a marker occurrence is followed, where one exists, by the strongest
//  thing the isnād engine found at that same locus. So a برج does not read as a
//  concordance — it reads as "here is the construct" then immediately "and here
//  is what the tongue does with it", over and over.
//
//  Assembly is a starting point, not a verdict. Everything it produces is
//  editable in the composer.
// ============================================================================
import { loadSurah, getAlamIndex, getCorpusMeta } from '../data.server';
import { AALAM_BY_ID, type AlamSpec } from '../aalam';
import { DISCOVERY_LABEL } from './labels';
import type { Movement, Station } from '../composition';
import type { Discovery } from '../types';

/** Kinds worth interleaving, strongest evidence first. */
const INTERLEAVE_PRIORITY = [
  'jisr-al-naba',
  'istihdar',
  'raj-al-jidhr',
  'nasikh-mirror',
  'alsinat-al-khalq',
  'tabaqat-al-isnad',
  'ribat',
];

function bestDiscoveryAt(all: Discovery[], ayah: number): Discovery | undefined {
  const here = all.filter((d) => ayah >= d.ayahFrom && ayah <= d.ayahTo);
  if (!here.length) return undefined;
  return here.sort((a, b) => {
    const pa = INTERLEAVE_PRIORITY.indexOf(a.kind);
    const pb = INTERLEAVE_PRIORITY.indexOf(b.kind);
    if (pa !== pb) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
    return b.score - a.score;
  })[0];
}

export interface AssembleOptions {
  /** Cap the number of marker occurrences used. */
  limit: number;
  /** Follow each occurrence with what the engine found there. */
  interleave: boolean;
  /** Include the spec's curated associated loci at the end. */
  includeAssociated: boolean;
}

export const DEFAULT_ASSEMBLE: AssembleOptions = {
  limit: 12,
  interleave: true,
  includeAssociated: true,
};

export async function assembleMovement(
  alamId: string,
  opt: AssembleOptions = DEFAULT_ASSEMBLE,
): Promise<Movement | null> {
  const spec: AlamSpec | undefined = AALAM_BY_ID.get(alamId);
  if (!spec) return null;

  const index = await getAlamIndex();
  const entry = index[alamId];
  if (!entry) return null;

  const hits = entry.hits.slice(0, Math.max(1, opt.limit));
  const stations: Station[] = [];

  // Group by sūrah so each one is analysed once, then restore reading order.
  const bySurah = new Map<number, typeof hits>();
  for (const h of hits) {
    const arr = bySurah.get(h.surah) ?? [];
    arr.push(h);
    bySurah.set(h.surah, arr);
  }

  const analysed = new Map<number, { discoveries: Discovery[]; wordAyah: Map<number, number> }>();
  for (const surahId of bySurah.keys()) {
    const { surah, discoveries } = await loadSurah(surahId);
    const wordAyah = new Map<number, number>();
    for (const a of surah.ayaat) for (let i = a.from; i < a.to; i++) wordAyah.set(i, a.n);
    analysed.set(surahId, { discoveries, wordAyah });
  }

  const usedDiscoveries = new Set<string>();

  for (const h of hits) {
    const ctx = analysed.get(h.surah)!;

    stations.push({
      surah: h.surah,
      ayah: h.ayah,
      focus: { from: h.word, to: h.word },
      caption: `${spec.label} — «${h.form}»`,
      source: 'alam',
    });

    if (!opt.interleave) continue;

    const d = bestDiscoveryAt(ctx.discoveries, h.ayah);
    // Only add the engine's finding when it points somewhere new; repeating the
    // same āyah back to back is padding, not pace.
    if (!d || usedDiscoveries.has(d.id)) continue;
    if (d.ayahFrom === h.ayah && d.ayahTo === h.ayah && d.seam === undefined) continue;
    usedDiscoveries.add(d.id);

    stations.push({
      surah: d.surah,
      ayah: d.seam !== undefined ? (ctx.wordAyah.get(d.seam) ?? d.ayahFrom) : d.ayahFrom,
      focus: { from: d.from, to: d.to },
      seam: d.seam,
      caption: `${DISCOVERY_LABEL[d.kind] ?? d.kind} — ${d.note}`,
      source: 'discovery',
      discoveryKind: d.kind,
    });
  }

  if (opt.includeAssociated && spec.associated?.length) {
    const meta = await getCorpusMeta();
    for (const a of spec.associated) {
      const [s, n] = a.locus;
      if (!meta[s]) continue;
      stations.push({
        surah: s,
        ayah: n,
        caption: a.why,
        source: 'associated',
      });
    }
  }

  return {
    id: `m${alamId}`,
    title: spec.label,
    alam: alamId,
    note: spec.gloss,
    stations,
  };
}
