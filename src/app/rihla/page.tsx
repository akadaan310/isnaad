import { Rihla } from '@/components/cosmos/rihla';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'الرِّحلة — سفرٌ في فضاء الإسناد',
  description: 'ألفُ آيةٍ في فضاء الإسناد، تُتلى آيةً آية، والرحلةُ تمضي بمقام التلاوة.',
};

export default function RihlaPage() {
  return <Rihla />;
}
