import { UniverseStudio } from '@/components/universe/studio-shell';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'مرصد الإسناد — الكون الكامل',
  description: 'ستّة آلاف ومئتان وستّ وثلاثون آية في فضاء الإسناد، بلا استثناء.',
  robots: { index: false, follow: false },
};

export default function UniversePage() {
  return <UniverseStudio />;
}
