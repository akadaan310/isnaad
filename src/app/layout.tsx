import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'مرصد الإسناد — Isnād Studio',
  description:
    'مرصدٌ لتتبّع الإسناد في القرآن الكريم: الالتفات، واستحضار الغائب، ورجع الجذر، وجسر النبأ، وألسنة الخلق.',
};

export const viewport: Viewport = {
  themeColor: '#0F172A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/*
          Fonts are self-hosted from /public/fonts rather than fetched from a
          CDN. Uthmani text carries marks - superscript alef, the small high
          seen, the Uthmani sukūn - that ordinary system Arabic fonts do not
          shape, and a fallback silently drops those glyphs: كَهْفِهِمْ renders as
          كَ فِهِ. That failure is invisible unless you can read the result, so
          the correct font must not depend on the network being up.
        */}
        <link
          rel="preload"
          href="/fonts/amiri-quran-arabic.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="font-arabic">{children}</body>
    </html>
  );
}
