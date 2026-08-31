import { NextResponse } from 'next/server';
import { getAyahIndex, getCorpusMeta } from '@/lib/data.server';
import { findResonance } from '@/lib/engine/graph';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const surah = Number(url.searchParams.get('surah'));
  const ayah = Number(url.searchParams.get('ayah'));
  const limit = Math.min(Number(url.searchParams.get('limit')) || 24, 100);

  if (!Number.isInteger(surah) || !Number.isInteger(ayah)) {
    return NextResponse.json({ error: 'يلزم تحديد السورة والآية' }, { status: 400 });
  }

  const [index, meta] = await Promise.all([getAyahIndex(), getCorpusMeta()]);
  const { anchor, matches } = findResonance(index, surah, ayah, limit);
  if (!anchor) return NextResponse.json({ error: 'الآية غير موجودة' }, { status: 404 });

  return NextResponse.json({
    anchor: { surah, ayah, sig: anchor.sig, distance: anchor.d, name: meta[surah]?.name },
    matches: matches.map((m) => ({
      ...m,
      name: meta[m.surah]?.name ?? '',
      text: meta[m.surah]?.uthmani[m.ayah - 1] ?? '',
    })),
  });
}
