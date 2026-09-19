import { Iltiqa } from '@/components/cosmos/iltiqa';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'مرصد الإسناد — الالتقاء',
  description:
    'تنقّلٌ على العلاقات المحسوبة: أنت هنا، ثم ما تتفق عليه عائلاتٌ مستقلّة من العلاقة، ثم شاهدُ كلٍّ منها عند الوصول.',
};

/**
 * `?surah=&ayah=` enters the surface at a known āyah — which is how الكون hands
 * a reader over without either surface growing an index. With no query the
 * anchor is computed; see `computedOrigin`.
 */
export default function Page({
  searchParams,
}: {
  searchParams: { surah?: string; ayah?: string };
}) {
  const surah = Number(searchParams.surah);
  const ayah = Number(searchParams.ayah);
  const start =
    Number.isInteger(surah) && Number.isInteger(ayah) && surah > 0 && ayah > 0
      ? { surah, ayah }
      : undefined;
  return <Iltiqa start={start} />;
}
