import { NextResponse } from 'next/server';
import { getAlamIndex, getCorpusMeta, loadSurah } from '@/lib/data.server';
import { AALAM_BY_ID } from '@/lib/aalam';
import { PLATES, NUJUM } from '@/lib/istiadha';

export const dynamic = 'force-dynamic';

/**
 * Resolve every plate against the live index. Counts are never written into
 * the copy — they come from here, so a plate cannot claim "three loci" while
 * the corpus holds four.
 */
export async function GET() {
  const [index, meta] = await Promise.all([getAlamIndex(), getCorpusMeta()]);

  const textOf = (s: number, a: number) => meta[s]?.uthmani[a - 1] ?? '';
  const nameOf = (s: number) => meta[s]?.name ?? '';

  /** Collapse repeated loci: 3:112 carries حَبْل twice and is still one āyah. */
  const byLocus = <T extends { surah: number; ayah: number }>(rows: T[]): T[] => {
    const seen = new Set<string>();
    return rows.filter((r) => {
      const k = `${r.surah}:${r.ayah}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  const plates = PLATES.map((p) => {
    const entry = p.alam ? index[p.alam] : undefined;
    const spec = p.alam ? AALAM_BY_ID.get(p.alam) : undefined;
    const loci: [number, number][] = [
      ...(entry?.hits.map((h) => [h.surah, h.ayah] as [number, number]) ?? []),
      ...(p.extra ?? []),
    ];
    // Extras may repeat a mined locus, and a marker may hit one āyah twice.
    const unique = byLocus(loci.map(([s2, a2]) => ({ surah: s2, ayah: a2 }))).map(
      (r) => [r.surah, r.ayah] as [number, number],
    );

    return {
      ...p,
      label: spec?.label ?? p.title,
      hue: spec?.hue ?? '#C8A45C',
      // Two different numbers, never conflated: how many times the lafẓ itself
      // occurs, and how many further loci the plate reaches to alongside it.
      count: entry?.hits.length ?? unique.length,
      related: unique.length - (entry?.hits.length ?? unique.length),
      spread: entry?.spread ?? new Set(unique.map((l) => l[0])).size,
      loci: unique.map(([s, a]) => ({ surah: s, ayah: a, name: nameOf(s), text: textOf(s, a) })),
      featured: (p.feature ?? []).map(([s, a]) => ({
        surah: s,
        ayah: a,
        name: nameOf(s),
        text: textOf(s, a),
      })),
    };
  });

  const hibal = index[NUJUM.hibalAlam];
  const [ns, na] = NUJUM.ayah;
  const { surah } = await loadSurah(ns);
  const ayah = surah.ayaat.find((x) => x.n === na);

  return NextResponse.json({
    plates,
    nujum: {
      ...NUJUM,
      name: nameOf(ns),
      text: textOf(ns, na),
      // The words carry the isnād, so the reveal can colour the dual verb.
      words: ayah
        ? surah.words.slice(ayah.from, ayah.to).map((w) => ({
            text: w.text,
            person: w.person,
            num: w.num,
            khalq: w.khalq ? w.khalq.label : undefined,
          }))
        : [],
      hibal: byLocus(hibal?.hits ?? []).map((h) => ({
        surah: h.surah,
        ayah: h.ayah,
        name: nameOf(h.surah),
        text: textOf(h.surah, h.ayah),
      })),
    },
  });
}
