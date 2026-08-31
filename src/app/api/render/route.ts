import { NextResponse } from 'next/server';
import { loadSurah, getCorpusMeta } from '@/lib/data.server';

export const dynamic = 'force-dynamic';

/**
 * Render just the āyāt a composition asks for. The player never pulls a whole
 * sūrah: a composition of twenty stations across fifteen sūrahs would be tens
 * of megabytes that way, and it needs a few hundred words.
 */
export async function POST(req: Request) {
  let body: { loci?: [number, number][] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'صيغة الطلب غير صالحة' }, { status: 400 });
  }

  const loci = Array.isArray(body.loci) ? body.loci.slice(0, 400) : [];
  const valid = loci.filter(
    (l) => Array.isArray(l) && Number.isInteger(l[0]) && l[0] >= 1 && l[0] <= 114 && Number.isInteger(l[1]) && l[1] >= 1,
  );

  const meta = await getCorpusMeta();
  const bySurah = new Map<number, Set<number>>();
  for (const [s, a] of valid) {
    const set = bySurah.get(s) ?? new Set<number>();
    set.add(a);
    bySurah.set(s, set);
  }

  const out: Record<string, unknown> = {};
  for (const [surahId, ayat] of bySurah) {
    const { surah, seams } = await loadSurah(surahId);
    for (const n of ayat) {
      const a = surah.ayaat.find((x) => x.n === n);
      if (!a) continue;
      out[`${surahId}:${n}`] = {
        surah: surahId,
        ayah: n,
        name: meta[surahId]?.name ?? '',
        uthmani: a.uthmani ?? a.text,
        sig: a.sig,
        vec: a.vec,
        distance: a.distance,
        clock: a.clock.bridge,
        seams: seams.filter((s) => s.at >= a.from && s.at < a.to).map((s) => s.at),
        words: surah.words.slice(a.from, a.to).map((w) => ({
          idx: w.idx,
          text: w.text,
          person: w.person,
          role: w.role,
          tense: w.tense,
          root: w.root,
          depth: w.depth,
          khalq: w.khalq ? { label: w.khalq.label, speech: w.khalq.speech } : undefined,
        })),
      };
    }
  }
  return NextResponse.json(out);
}
