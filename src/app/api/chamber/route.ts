import { NextResponse } from 'next/server';
import {
  getAyahIndex,
  getCorpusMeta,
  getMotifs,
  getRootIndex,
  loadSurah,
} from '@/lib/data.server';
import { CHAMBER_SEEDS, walkChamber } from '@/lib/engine/graph';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const stations = Math.min(Math.max(Number(url.searchParams.get('stations')) || 7, 3), 15);

  // Default to a seed where the text itself audits how much time has passed.
  const fallback = CHAMBER_SEEDS[Math.floor(Math.random() * CHAMBER_SEEDS.length)];
  const surah = Number(url.searchParams.get('surah')) || fallback.surah;
  const ayah = Number(url.searchParams.get('ayah')) || fallback.ayah;

  const [index, meta, motifs, roots] = await Promise.all([
    getAyahIndex(),
    getCorpusMeta(),
    getMotifs(),
    getRootIndex(),
  ]);

  // The walk asks for the roots of whichever ayah it is standing on, so the
  // sūrahs it touches are analysed lazily and memoised for the walk's lifetime.
  const rootCache = new Map<string, string[]>();
  const rootsOfAyah = (s: number, a: number): string[] => {
    const k = `${s}:${a}`;
    return rootCache.get(k) ?? [];
  };
  const prime = async (s: number, a: number) => {
    const k = `${s}:${a}`;
    if (rootCache.has(k)) return;
    const { surah: doc } = await loadSurah(s);
    for (const ay of doc.ayaat) {
      const set = new Set<string>();
      for (const w of doc.words.slice(ay.from, ay.to)) {
        for (const seg of w.segments) if (seg.root && !seg.clitic) set.add(seg.root);
      }
      rootCache.set(`${s}:${ay.n}`, [...set]);
    }
    void a;
  };

  // Walking is greedy, so priming the seed's sūrah plus a bounded look-ahead is
  // enough: any sūrah the walk actually reaches gets primed on the next pass.
  await prime(surah, ayah);
  let walk = walkChamber(
    { index, motifs, roots, rootsOfAyah, nameOf: (s) => meta[s]?.name ?? '', textOf: (s, a) => meta[s]?.uthmani[a - 1] ?? '' },
    { surah, ayah },
    stations,
  );
  for (const st of walk) await prime(st.surah, st.ayah);
  walk = walkChamber(
    { index, motifs, roots, rootsOfAyah, nameOf: (s) => meta[s]?.name ?? '', textOf: (s, a) => meta[s]?.uthmani[a - 1] ?? '' },
    { surah, ayah },
    stations,
  );

  return NextResponse.json({ seed: { surah, ayah }, seeds: CHAMBER_SEEDS, walk });
}
