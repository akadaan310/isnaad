import { NextResponse } from 'next/server';
import { loadSurah, optionsFromQuery, toWire } from '@/lib/data.server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1 || id > 114) {
    return NextResponse.json({ error: 'رقم السورة خارج المدى (1-114)' }, { status: 400 });
  }
  try {
    const url = new URL(req.url);
    const options = optionsFromQuery(url.searchParams);
    const analyzed = await loadSurah(id, options);

    // `only=discoveries` serialises the findings and nothing else. The analysis
    // is identical either way — this drops the words and their segments, which
    // are most of the payload and which the cosmos field does not read. Without
    // it, moving a threshold would pull a few megabytes per tick.
    if (url.searchParams.get('only') === 'discoveries') {
      return NextResponse.json({
        surah: id,
        name: analyzed.surah.name,
        ayaat: analyzed.surah.ayaat.length,
        options,
        discoveries: analyzed.discoveries,
      });
    }

    return NextResponse.json(toWire(analyzed));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'تعذّر تحميل السورة' },
      { status: 500 },
    );
  }
}
