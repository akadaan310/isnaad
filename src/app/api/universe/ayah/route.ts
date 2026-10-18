import { NextResponse } from 'next/server';
import { getCorpusMeta } from '@/lib/data.server';

export const dynamic = 'force-dynamic';

/**
 * The Uthmani text of one āyah, by locus, from data/corpus/meta.json — the one
 * copy of the muṣḥaf in the repository. Provenance travels with the text.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const s = Number(url.searchParams.get('s'));
  const a = Number(url.searchParams.get('a'));
  const meta = await getCorpusMeta();
  const surah = Number.isInteger(s) ? meta[s] : undefined;
  if (!surah || !Number.isInteger(a) || a < 1 || a > surah.uthmani.length) {
    return NextResponse.json({ error: 'موضعٌ غير موجود' }, { status: 404 });
  }
  return NextResponse.json(
    {
      surah: s,
      ayah: a,
      name: surah.name,
      text: surah.uthmani[a - 1],
      source: 'risan/quran-json (Uthmani, Tanzil lineage) via data/corpus/meta.json',
    },
    { headers: { 'cache-control': 'private, no-store' } },
  );
}
