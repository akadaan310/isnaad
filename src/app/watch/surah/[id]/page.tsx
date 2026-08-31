import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { surahComposition } from '@/lib/engine/surah-composition';
import { getCorpusMeta } from '@/lib/data.server';
import { FurqanPlayer } from '@/components/furqan/player';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const meta = await getCorpusMeta();
  const s = meta[Number(params.id)];
  return { title: s ? `${s.name} — الفرقان` : 'الفرقان' };
}

export default async function WatchSurahPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1 || id > 114) notFound();
  return <FurqanPlayer composition={await surahComposition(id)} />;
}
