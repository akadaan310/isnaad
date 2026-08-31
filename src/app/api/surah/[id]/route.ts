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
    const analyzed = await loadSurah(id, optionsFromQuery(url.searchParams));
    return NextResponse.json(toWire(analyzed));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'تعذّر تحميل السورة' },
      { status: 500 },
    );
  }
}
