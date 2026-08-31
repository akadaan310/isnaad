import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getComposition } from '@/lib/compositions.server';
import { FurqanPlayer } from '@/components/furqan/player';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const c = await getComposition(params.id);
  if (!c) return { title: 'الفرقان' };
  return { title: `${c.title} — الفرقان`, description: c.intent ?? c.subtitle };
}

export default async function WatchPage({ params }: { params: { id: string } }) {
  const composition = await getComposition(params.id);
  if (!composition) notFound();
  return <FurqanPlayer composition={composition} />;
}
