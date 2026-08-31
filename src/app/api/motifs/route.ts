import { NextResponse } from 'next/server';
import { getMotifs } from '@/lib/data.server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 60, 400);
  const surah = Number(url.searchParams.get('surah')) || 0;
  const minSpread = Number(url.searchParams.get('minSpread')) || 2;

  let motifs = await getMotifs();
  if (surah) motifs = motifs.filter((m) => m.occurrences.some((o) => o.surah === surah));
  motifs = motifs.filter((m) => m.spread >= minSpread);
  return NextResponse.json(motifs.slice(0, limit));
}
