import { Cosmos } from '@/components/cosmos/cosmos';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'مرصد الإسناد — الكون',
  description: 'ألف آية موضوعةٌ في فضاء الإسناد، تُطاف بالسنابل ويُصعد فيها بالسلّم.',
};

export default function Page() {
  return <Cosmos />;
}
