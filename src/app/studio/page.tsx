import { getSurahMetas } from '@/lib/data.server';
import { Studio } from '@/components/studio';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'مرصد الإسناد — الاستوديو' };

export default async function StudioPage() {
  return <Studio metas={await getSurahMetas()} />;
}
