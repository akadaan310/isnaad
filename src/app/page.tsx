import { getSurahMetas } from '@/lib/data.server';
import { Studio } from '@/components/studio';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const metas = await getSurahMetas();
  return <Studio metas={metas} />;
}
