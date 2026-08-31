import { NextResponse } from 'next/server';
import { getAlamIndex, getCorpusMeta } from '@/lib/data.server';
import { AALAM } from '@/lib/aalam';

export const dynamic = 'force-dynamic';

/** The marker registry joined to its mined occurrences, ready for the composer. */
export async function GET() {
  const [index, meta] = await Promise.all([getAlamIndex(), getCorpusMeta()]);
  return NextResponse.json(
    AALAM.map((spec) => {
      const entry = index[spec.id];
      return {
        id: spec.id,
        label: spec.label,
        gloss: spec.gloss,
        family: spec.family,
        hue: spec.hue,
        count: entry?.hits.length ?? 0,
        spread: entry?.spread ?? 0,
        associated: spec.associated?.length ?? 0,
        hits: (entry?.hits ?? []).map((h) => ({
          surah: h.surah,
          ayah: h.ayah,
          form: h.form,
          name: meta[h.surah]?.name ?? '',
        })),
      };
    }),
  );
}
