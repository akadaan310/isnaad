import { listCompositions } from '@/lib/compositions.server';
import { Composer } from '@/components/composer';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'التأليف — مرصد الإسناد' };

export default async function ComposePage() {
  const items = await listCompositions(false);
  return <Composer initial={items} />;
}
