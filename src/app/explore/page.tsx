import { getSurahMetas } from '@/lib/data.server';
import { Explorer } from '@/components/explorer';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'القرآن الغامر — اختر سورة',
  description: 'اختر سورةً واعرِضها في الفُرقان، بعد الاستعاذة.',
};

export default async function ExplorePage() {
  return <Explorer metas={await getSurahMetas()} />;
}
