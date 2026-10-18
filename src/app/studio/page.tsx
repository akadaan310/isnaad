import { getSurahMetas } from '@/lib/data.server';
import { Studio } from '@/components/studio';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'مرصد الإسناد — الاستوديو' };

/** `?s=50&a=2` opens on a locus, so the universe inspector can hand off here. */
export default async function StudioPage({ searchParams }: { searchParams: { s?: string; a?: string } }) {
  const metas = await getSurahMetas();
  const s = Number(searchParams.s);
  const a = Number(searchParams.a);
  const meta = metas.find((m) => m.id === s);
  const initial = meta && Number.isInteger(a) && a >= 1 && a <= meta.ayahCount ? { surah: s, ayah: a } : undefined;
  return <Studio metas={metas} initial={initial} />;
}
