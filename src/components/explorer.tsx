'use client';
// ============================================================================
//  المستكشف — the way in.
//
//  Pick any of the 114 and play it. The الاستعاذة runs once per person and is
//  then remembered; afterwards it stays reachable but never blocks. The gate
//  is client-side because the whole point is that it is a threshold this
//  browser crossed, not a record kept about anyone.
// ============================================================================
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Play, Sparkles, Telescope, PenLine, GalleryVerticalEnd, Footprints } from 'lucide-react';
import type { SurahMeta } from '@/lib/types';
import { ISTIADHA_KEY } from '@/lib/istiadha';
import { PERSON_STYLE } from '@/lib/view';
import { arabicNumber, cn } from '@/lib/utils';
import { Istiadha } from './istiadha/sequence';
import { MiniContour } from './waveform';

export function Explorer({ metas }: { metas: SurahMeta[] }) {
  const router = useRouter();
  const [q, setQ] = React.useState('');
  // `null` = not yet read from storage; the gate must not flash before we know.
  const [done, setDone] = React.useState<boolean | null>(null);
  const [replay, setReplay] = React.useState(false);

  React.useEffect(() => {
    try {
      setDone(window.localStorage.getItem(ISTIADHA_KEY) === '1');
    } catch {
      // A private window cannot remember; offer the sequence but never trap.
      setDone(true);
    }
  }, []);

  const finish = () => {
    try {
      window.localStorage.setItem(ISTIADHA_KEY, '1');
    } catch {
      /* nothing to persist to; the session still proceeds */
    }
    setDone(true);
    setReplay(false);
  };

  const list = React.useMemo(() => {
    const needle = q.trim();
    if (!needle) return metas;
    return metas.filter(
      (m) =>
        m.name.includes(needle) ||
        m.transliteration.toLowerCase().includes(needle.toLowerCase()) ||
        String(m.id) === needle ||
        arabicNumber(m.id) === needle,
    );
  }, [metas, q]);

  if (done === null) return <div className="min-h-dvh" />;
  if (!done || replay) return <Istiadha onDone={finish} />;

  return (
    <div className="min-h-dvh px-5 py-8">
      <header className="mx-auto mb-8 max-w-5xl text-center">
        <h1 className="quran text-[2.5rem] leading-[1.9] text-gold">القرآن الغامر</h1>
        <p className="mx-auto mt-1 max-w-xl text-[0.8rem] leading-relaxed text-muted-foreground">
          اختَرْ سورةً واعرِضها في الفُرقان. النصُّ يُبنى عند العرض من المصحف، لا من تسجيل.
        </p>

        <nav className="mt-5 flex flex-wrap items-center justify-center gap-1.5 text-[0.72rem]">
          <button
            onClick={() => setReplay(true)}
            className="flex items-center gap-1 rounded-full border border-gold/35 bg-gold/10 px-3 py-1 text-gold transition-colors hover:bg-gold/20"
          >
            <Footprints className="h-3 w-3" />
            أعِد الاستعاذة
          </button>
          <Link href="/gallery" className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold">
            <GalleryVerticalEnd className="h-3 w-3" />
            المعرض
          </Link>
          <Link href="/compose" className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold">
            <PenLine className="h-3 w-3" />
            التأليف
          </Link>
          <Link href="/" className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold">
            <Telescope className="h-3 w-3" />
            مرصد الإسناد
          </Link>
        </nav>

        <div className="relative mx-auto mt-6 max-w-md">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && list.length) router.push(`/watch/surah/${list[0].id}`);
            }}
            placeholder="ابحث عن سورة…"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] pr-10 pl-3 text-[0.85rem] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-gold/40"
          />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((m) => (
          <Link
            key={m.id}
            href={`/watch/surah/${m.id}`}
            className="group rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 transition-all hover:border-gold/35 hover:bg-white/[0.055]"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="quran text-[1.35rem] leading-[1.9]">{m.name}</span>
              <span className="shrink-0 rounded bg-white/[0.06] px-1.5 text-[0.58rem] tabular-nums text-muted-foreground">
                {arabicNumber(m.id)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <MiniContour vec={m.vec} className="flex-1" />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[0.6rem] text-muted-foreground">
              <span>
                {m.type === 'makkiyyah' ? 'مكية' : 'مدنية'} · {arabicNumber(m.ayahCount)} آية
              </span>
              <span className="flex items-center gap-1 text-gold opacity-0 transition-opacity group-hover:opacity-100">
                <Play className="h-2.5 w-2.5" />
                اعرِض
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              {(Object.entries(m.discoveryCounts) as [string, number][])
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([k, n]) => (
                  <span key={k} className="flex items-center gap-0.5 text-[0.55rem] text-muted-foreground/70">
                    <Sparkles className="h-2 w-2" />
                    {arabicNumber(n)}
                  </span>
                ))}
            </div>
          </Link>
        ))}
        {!list.length && (
          <p className="col-span-full py-16 text-center text-[0.8rem] text-muted-foreground">
            لا سورة بهذا الوصف.
          </p>
        )}
      </main>

      <footer className="mx-auto mt-10 flex max-w-5xl items-center justify-center gap-3 text-[0.6rem] text-muted-foreground/70">
        {([1, 2, 3] as const).map((p) => (
          <span key={p} className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: PERSON_STYLE[p].hex }} />
            {PERSON_STYLE[p].label}
          </span>
        ))}
      </footer>
    </div>
  );
}
