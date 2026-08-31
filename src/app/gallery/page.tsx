import Link from 'next/link';
import { Play, Sparkles, PenLine } from 'lucide-react';
import { listCompositions } from '@/lib/compositions.server';
import { stationCount } from '@/lib/composition';
import { arabicNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'المعرض — تلاواتٌ مؤلَّفة',
  description: 'معرضُ تلاواتٍ قرآنيةٍ مؤلَّفة، تُعرض في الفرقان.',
};

export default async function GalleryPage() {
  const items = await listCompositions(true);

  return (
    <div className="min-h-dvh px-5 py-10">
      <header className="mx-auto mb-10 max-w-5xl text-center">
        <h1 className="quran text-[2.4rem] leading-tight text-gold">المعرض</h1>
        <p className="mx-auto mt-2 max-w-2xl text-[0.82rem] leading-relaxed text-muted-foreground">
          تلاواتٌ مؤلَّفة، كلُّ واحدةٍ مبنيّةٌ على عَلَمٍ من أعلام القرآن، تُعرض في الفُرقان — وليست
          تسجيلًا، بل نصًّا يُبنى عند العرض من المصحف نفسه.
        </p>
        <nav className="mt-5 flex items-center justify-center gap-2 text-[0.72rem]">
          <Link href="/" className="rounded-full border border-white/10 px-3 py-1 text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold">
            مرصد الإسناد
          </Link>
          <Link href="/compose" className="flex items-center gap-1 rounded-full border border-gold/35 bg-gold/10 px-3 py-1 text-gold transition-colors hover:bg-gold/20">
            <PenLine className="h-3 w-3" />
            التأليف
          </Link>
        </nav>
      </header>

      <main className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <Link
            key={c.id}
            href={`/watch/${c.id}`}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-all hover:border-gold/35 hover:bg-white/[0.05]"
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gold/10 blur-2xl transition-opacity group-hover:opacity-100 sm:opacity-0" />
            <h2 className="quran quran-tight relative text-[1.35rem] text-foreground/95">{c.title}</h2>
            {c.subtitle && <p className="relative mt-0.5 text-[0.7rem] text-muted-foreground">{c.subtitle}</p>}
            {c.intent && (
              <p className="relative mt-2 line-clamp-3 text-[0.72rem] leading-relaxed text-foreground/60">{c.intent}</p>
            )}
            <div className="relative mt-3 flex flex-wrap gap-1">
              {c.movements.slice(0, 4).map((m) => (
                <span key={m.id} className="quran rounded-full border border-white/10 px-2 py-px text-[0.75rem] text-muted-foreground">
                  {m.title}
                </span>
              ))}
              {c.movements.length > 4 && (
                <span className="rounded-full px-1 py-px text-[0.62rem] text-muted-foreground">
                  +{arabicNumber(c.movements.length - 4)}
                </span>
              )}
            </div>
            <div className="relative mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2 text-[0.64rem] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {arabicNumber(c.movements.length)} بروج · {arabicNumber(stationCount(c))} مقامًا
              </span>
              <span className="flex items-center gap-1 text-gold opacity-70 transition-opacity group-hover:opacity-100">
                <Play className="h-3 w-3" />
                اعرِض
              </span>
            </div>
          </Link>
        ))}

        {!items.length && (
          <div className="col-span-full rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
            <p className="text-[0.82rem] text-muted-foreground">لم يُنشَر بعدُ تأليف.</p>
            <Link href="/compose" className="mt-3 inline-flex items-center gap-1 text-[0.75rem] text-gold hover:underline">
              <PenLine className="h-3 w-3" />
              ابدأ التأليف
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
