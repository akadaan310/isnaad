'use client';
// ============================================================================
//  The studio shell: three panes, one piece of state.
// ============================================================================
import * as React from 'react';
import Link from 'next/link';
import {
  Radar, Loader2, BookOpen, Layers, Quote, Eye, Columns2, X, PanelRightClose, PanelLeftClose,
  GalleryVerticalEnd, PenLine,
} from 'lucide-react';
import type { Ayah, Discovery, Surah, SurahMeta, Word } from '@/lib/types';
import type { Frame } from '@/lib/engine/frames';
import type { Seam } from '@/lib/isnad';
import { DISCOVERY_STYLE, PERSON_STYLE } from '@/lib/view';
import { arabicNumber, cn } from '@/lib/utils';
import { Button, Toggle } from './ui';
import { Navigator, type Filters } from './navigator';
import { Reader, type Overlay } from './reader';
import { Waveform } from './waveform';
import { Matrix, type MatrixTab } from './matrix';

/** What /api/surah/[id] returns: the sūrah plus everything derived from it. */
interface WireSurah extends Surah {
  frames: Frame[];
  seams: Seam[];
  discoveries: Discovery[];
}

export function Studio({ metas }: { metas: SurahMeta[] }) {
  // Opens on Hud 29, the passage the engine's istihdar detector was designed
  // from, so the studio demonstrates itself on first paint.
  const [surahId, setSurahId] = React.useState(11);
  const [data, setData] = React.useState<WireSurah | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [activeAyah, setActiveAyah] = React.useState(29);
  const [selectedWord, setSelectedWord] = React.useState<number | null>(null);
  const [overlay, setOverlay] = React.useState<Overlay>('isnad');
  const [mushafText, setMushafText] = React.useState(false);
  const [tab, setTab] = React.useState<MatrixTab>('discoveries');
  const [juz, setJuz] = React.useState<number | null>(null);
  const [span, setSpan] = React.useState<{ from: number; to: number; seam?: number } | null>(null);
  const [selectedDiscovery, setSelectedDiscovery] = React.useState<string | null>(null);
  const [compare, setCompare] = React.useState<{ surah: number; ayah: number } | null>(null);
  const [compareDoc, setCompareDoc] = React.useState<WireSurah | null>(null);
  const [showNav, setShowNav] = React.useState(true);
  const [showMatrix, setShowMatrix] = React.useState(true);

  const [filters, setFilters] = React.useState<Filters>({
    showSeams: true,
    showKhalq: false,
    onlyMunajah: false,
    distance: [0, 1],
  });

  const readerRef = React.useRef<HTMLDivElement>(null);
  /** Which āyah to reveal once the next sūrah payload lands. */
  const pendingAyah = React.useRef(29);

  // ── load the active sūrah ────────────────────────────────────────────────
  React.useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    fetch(`/api/surah/${surahId}`)
      .then((r) => (r.ok ? r.json() : r.json().then((e) => Promise.reject(new Error(e.error)))))
      .then((d: WireSurah) => {
        if (!live) return;
        setData(d);
        setLoading(false);
        // The reader only exists after this paint, so defer the scroll to it.
        requestAnimationFrame(() =>
          document
            .getElementById(`ayah-${pendingAyah.current}`)
            ?.scrollIntoView({ block: 'center' }),
        );
      })
      .catch((e: Error) => {
        if (!live) return;
        setError(e.message || 'تعذّر تحميل السورة');
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [surahId]);

  React.useEffect(() => {
    if (!compare) {
      setCompareDoc(null);
      return;
    }
    let live = true;
    fetch(`/api/surah/${compare.surah}`)
      .then((r) => r.json())
      .then((d: WireSurah) => live && setCompareDoc(d));
    return () => {
      live = false;
    };
  }, [compare]);

  const seamAt = React.useMemo(
    () => new Set((data?.seams ?? []).map((s) => s.at)),
    [data],
  );

  const scrollToAyah = React.useCallback((n: number) => {
    setActiveAyah(n);
    requestAnimationFrame(() => {
      document.getElementById(`ayah-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  const openAyah = React.useCallback(
    (s: number, a: number) => {
      if (s === surahId) {
        scrollToAyah(a);
      } else {
        pendingAyah.current = a;
        setSurahId(s);
        setActiveAyah(a);
        setSpan(null);
        setSelectedDiscovery(null);
      }
    },
    [surahId, scrollToAyah],
  );

  const focusDiscovery = React.useCallback(
    (d: Discovery) => {
      if (selectedDiscovery === d.id) {
        setSelectedDiscovery(null);
        setSpan(null);
        return;
      }
      setSelectedDiscovery(d.id);
      setSpan({ from: d.from, to: d.to, seam: d.seam });
      scrollToAyah(d.ayahFrom);
    },
    [selectedDiscovery, scrollToAyah],
  );

  const pickWord = React.useCallback(
    (idx: number) => {
      if (!data) return;
      setSelectedWord(idx);
      scrollToAyah(data.words[idx]?.ayah ?? 1);
    },
    [data, scrollToAyah],
  );

  const inRange = React.useCallback(
    (a: Ayah) => {
      const [lo, hi] = filters.distance;
      if (a.distance < lo - 0.001 || a.distance > hi + 0.001) return false;
      if (filters.onlyMunajah && a.dominant !== 2) return false;
      return true;
    },
    [filters],
  );

  const effectiveOverlay: Overlay = filters.showKhalq ? 'khalq' : overlay;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar
        surah={data}
        overlay={overlay}
        setOverlay={setOverlay}
        mushafText={mushafText}
        setMushafText={setMushafText}
        showNav={showNav}
        setShowNav={setShowNav}
        showMatrix={showMatrix}
        setShowMatrix={setShowMatrix}
      />

      <div className="flex min-h-0 flex-1 gap-3 p-3">
        {/* ── Pane 1 ── */}
        {showNav && (
          <aside className="hidden w-[19rem] shrink-0 rounded-2xl glass p-3 lg:block">
            <Navigator
              metas={metas}
              current={surahId}
              onSelect={(id) => {
                pendingAyah.current = 1;
                setSurahId(id);
                setActiveAyah(1);
                setSpan(null);
                setSelectedDiscovery(null);
                setSelectedWord(null);
              }}
              filters={filters}
              setFilters={setFilters}
              juz={juz}
              setJuz={setJuz}
            />
          </aside>
        )}

        {/* ── Pane 2 ── */}
        <main className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-h-0 flex-1 gap-3">
            <div className="flex min-w-0 flex-1 flex-col rounded-2xl glass">
              {loading && <Centered><Loader2 className="h-4 w-4 animate-spin" /> يُبنى الإسناد…</Centered>}
              {error && <Centered><span className="text-destructive">{error}</span></Centered>}
              {data && !loading && (
                <>
                  <SurahHeader surah={data} activeAyah={activeAyah} />
                  <div ref={readerRef} className="min-h-0 flex-1 overflow-y-auto thin-scroll px-3 pb-3">
                    <Reader
                      ayaat={data.ayaat}
                      words={data.words}
                      seamAt={seamAt}
                      overlay={effectiveOverlay}
                      showSeams={filters.showSeams}
                      inRange={inRange}
                      span={span}
                      activeAyah={activeAyah}
                      selected={selectedWord}
                      onSelectWord={setSelectedWord}
                      onActivateAyah={setActiveAyah}
                      mushafText={mushafText}
                    />
                  </div>
                </>
              )}
            </div>

            {/* المثاني — the dual reader */}
            {compare && (
              <div className="flex w-[22rem] shrink-0 flex-col rounded-2xl glass">
                <header className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2">
                  <span className="pane-title">
                    <Columns2 className="h-3.5 w-3.5" />
                    القرين
                  </span>
                  <button onClick={() => setCompare(null)} aria-label="إغلاق">
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto thin-scroll p-3">
                  {compareDoc ? (
                    <CompareView doc={compareDoc} ayah={compare.ayah} overlay={effectiveOverlay} />
                  ) : (
                    <Centered><Loader2 className="h-4 w-4 animate-spin" /></Centered>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* رادار الالتفات */}
          {data && !loading && (
            <div className="shrink-0 rounded-2xl glass p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="pane-title">
                  <Radar className="h-3.5 w-3.5" />
                  رادار الالتفات
                </span>
                <span className="text-[0.62rem] text-muted-foreground">
                  {arabicNumber(data.seams.length)} موضع تحوّل · انقر الموجة لتقف على الكلمة
                </span>
              </div>
              <Waveform
                words={data.words}
                seams={data.seams}
                focus={selectedWord}
                span={span}
                onPick={pickWord}
                ayahOf={(i) => data.words[i]?.ayah ?? 1}
              />
            </div>
          )}
        </main>

        {/* ── Pane 3 ── */}
        {showMatrix && data && !loading && (
          <aside className="hidden w-[23rem] shrink-0 rounded-2xl glass p-3 xl:block">
            <Matrix
              surah={data}
              discoveries={data.discoveries}
              frames={data.frames}
              activeAyah={activeAyah}
              tab={tab}
              setTab={setTab}
              onFocusDiscovery={focusDiscovery}
              onOpenAyah={openAyah}
              onCompare={(s, a) => setCompare({ surah: s, ayah: a })}
              selectedDiscovery={selectedDiscovery}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 text-[0.78rem] text-muted-foreground">
      {children}
    </div>
  );
}

function TopBar({
  surah, overlay, setOverlay, mushafText, setMushafText,
  showNav, setShowNav, showMatrix, setShowMatrix,
}: {
  surah: Surah | null;
  overlay: Overlay;
  setOverlay: (o: Overlay) => void;
  mushafText: boolean;
  setMushafText: (v: boolean) => void;
  showNav: boolean;
  setShowNav: (v: boolean) => void;
  showMatrix: boolean;
  setShowMatrix: (v: boolean) => void;
}) {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="quran text-[1.35rem] leading-none text-gold">مرصد الإسناد</span>
        <span className="hidden text-[0.62rem] text-muted-foreground lg:inline">
          الالتفات · الاستحضار · رجع الجذر · جسر النبأ
        </span>
        <nav className="flex items-center gap-1">
          <Link href="/gallery" title="معرض التلاوات المؤلَّفة">
            <Button size="xs" variant="ghost">
              <GalleryVerticalEnd className="h-3 w-3" />
              المعرض
            </Button>
          </Link>
          <Link href="/compose" title="تأليف تلاوة">
            <Button size="xs" variant="ghost">
              <PenLine className="h-3 w-3" />
              التأليف
            </Button>
          </Link>
        </nav>
      </div>

      <div className="mx-auto flex items-center gap-1.5">
        {([1, 2, 3] as const).map((p) => (
          <span
            key={p}
            title={PERSON_STYLE[p].gloss}
            className="flex items-center gap-1 rounded-full border border-white/[0.08] px-2 py-0.5 text-[0.64rem]"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: PERSON_STYLE[p].hex }} />
            <span style={{ color: PERSON_STYLE[p].soft }}>{PERSON_STYLE[p].label}</span>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <Toggle active={overlay === 'isnad'} onToggle={() => setOverlay(overlay === 'isnad' ? 'none' : 'isnad')} tone="gold">
          <Eye className="h-3 w-3" />
          الإسناد
        </Toggle>
        <Toggle active={overlay === 'depth'} onToggle={() => setOverlay(overlay === 'depth' ? 'isnad' : 'depth')} tone="gold">
          <Quote className="h-3 w-3" />
          الطبقات
        </Toggle>
        <Toggle active={mushafText} onToggle={() => setMushafText(!mushafText)} tone="gold" title="نصّ المصحف متّصلًا، بلا تلوين الكلم">
          <BookOpen className="h-3 w-3" />
          المصحف
        </Toggle>
        <span className="mx-1 hidden h-4 w-px bg-white/10 lg:block" />
        <Button size="icon" variant="ghost" onClick={() => setShowNav(!showNav)} title="الفهرس" className="hidden lg:inline-flex">
          <PanelRightClose className={cn('h-3.5 w-3.5', !showNav && 'opacity-40')} />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setShowMatrix(!showMatrix)} title="المصفوفة" className="hidden xl:inline-flex">
          <PanelLeftClose className={cn('h-3.5 w-3.5', !showMatrix && 'opacity-40')} />
        </Button>
      </div>
    </header>
  );
}

function SurahHeader({ surah, activeAyah }: { surah: Surah; activeAyah: number }) {
  const counts = Object.entries(surah.discoveryCounts).sort((a, b) => b[1] - a[1]);
  return (
    <header className="shrink-0 border-b border-white/[0.06] px-4 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h1 className="quran quran-tight text-[1.7rem]">{surah.name}</h1>
          <span className="text-[0.66rem] text-muted-foreground">
            {surah.type === 'makkiyyah' ? 'مكية' : 'مدنية'} · {arabicNumber(surah.ayahCount)} آية ·{' '}
            {arabicNumber(surah.wordCount)} كلمة
          </span>
        </div>
        <span className="shrink-0 text-[0.66rem] tabular-nums text-gold">
          آية {arabicNumber(activeAyah)}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {counts.slice(0, 5).map(([k, n]) => {
          const st = DISCOVERY_STYLE[k as keyof typeof DISCOVERY_STYLE];
          return (
            <span
              key={k}
              title={st?.hint}
              className="flex items-center gap-1 text-[0.6rem] text-muted-foreground"
            >
              <span className="h-1 w-1 rounded-full" style={{ background: st?.hex }} />
              {st?.short ?? k}
              <b className="tabular-nums text-foreground/70">{arabicNumber(n)}</b>
            </span>
          );
        })}
        <div className="mr-1 flex h-1 min-w-16 flex-1 overflow-hidden rounded-full bg-white/5">
          {([1, 2, 3] as const).map((p) => (
            <div
              key={p}
              style={{
                width: `${(p === 1 ? surah.vec.p1 : p === 2 ? surah.vec.p2 : surah.vec.p3) * 100}%`,
                background: PERSON_STYLE[p].hex,
              }}
            />
          ))}
        </div>
      </div>
    </header>
  );
}

/** The right-hand pane of the dual reader: one āyah with its context. */
function CompareView({ doc, ayah, overlay }: { doc: WireSurah; ayah: number; overlay: Overlay }) {
  const target = doc.ayaat.find((a) => a.n === ayah);
  if (!target) return <Centered>الآية غير موجودة</Centered>;
  const around = doc.ayaat.filter((a) => Math.abs(a.n - ayah) <= 1);

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="quran text-[1.3rem]">{doc.name}</span>
        <span className="text-[0.62rem] text-muted-foreground">
          مسافة الخطاب {arabicNumber(Math.round(target.distance * 100))}٪ · كنتور{' '}
          <b className="font-mono tracking-widest text-gold">{target.sig}</b>
        </span>
      </div>
      {around.map((a) => (
        <div
          key={a.n}
          className={cn('rounded-lg px-2 py-2', a.n === ayah ? 'bg-white/[0.05] ring-1 ring-gold/20' : 'opacity-45')}
        >
          <span className="mb-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white/[0.07] px-1 text-[0.55rem] tabular-nums text-muted-foreground">
            {arabicNumber(a.n)}
          </span>
          <p className="quran text-right text-[1.35rem]">
            {doc.words.slice(a.from, a.to).map((w: Word) => (
              <span
                key={w.idx}
                className="px-[0.1em]"
                style={
                  overlay === 'isnad' && w.person
                    ? {
                        textDecoration: 'underline',
                        textDecorationColor: PERSON_STYLE[w.person].hex,
                        textDecorationThickness: '2px',
                        textUnderlineOffset: '0.3em',
                      }
                    : undefined
                }
              >
                {w.text}{' '}
              </span>
            ))}
          </p>
        </div>
      ))}
      <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2">
        <Layers className="h-3 w-3 shrink-0 text-gold" />
        <p className="text-[0.62rem] leading-relaxed text-muted-foreground">
          قابِل كنتور الإسناد ههنا بكنتور الآية في اللوح الأيمن: المطابقةُ مثانٍ، والانقلابُ تبادلٌ
          بين المتكلم والغائب في المقعد نفسه.
        </p>
      </div>
    </div>
  );
}
