'use client';
// ============================================================================
//  الفُرْقان — the immersive player.
//
//  Not a recording. Every station names a locus, and the āyah, its words and
//  its isnād are fetched from the corpus and rendered live — which is what lets
//  the controls be controls of the text rather than of a timeline.
//
//  The control surface is drawn from the constructs it operates on:
//
//    البُرُوج        the movements, as stations in the sky
//    مواقع النجوم   the positions inside a برج — the scrubber
//    الفَلَك         the circuit: stations advance on their own, and it orbits
//    السِّراج        how far the isnād burn reaches
//    القمر المنير   reflected light: the paired āyah beside this one
//    نَذِيرًا         sending it out
// ============================================================================
import * as React from 'react';
import Link from 'next/link';
import {
  Orbit, Sun, Moon, Share2, ChevronRight, ChevronLeft, Maximize2, Minimize2,
  X, Repeat, Loader2, Stars,
} from 'lucide-react';
import type { Composition, Station } from '@/lib/composition';
import { flatten } from '@/lib/composition';
import { DISCOVERY_STYLE, PERSON_STYLE, KHALQ_HEX } from '@/lib/view';
import { arabicNumber, cn } from '@/lib/utils';
import { Celestial, useSky, anchorFor } from './celestial';

interface RenderedWord {
  idx: number;
  text: string;
  person: 1 | 2 | 3 | null;
  role: string | null;
  tense: string | null;
  root?: string;
  depth: number;
  khalq?: { label: string; speech: boolean };
}

interface RenderedAyah {
  surah: number;
  ayah: number;
  name: string;
  uthmani: string;
  sig: string;
  vec: { p1: number; p2: number; p3: number };
  distance: number;
  clock: number;
  seams: number[];
  words: RenderedWord[];
}

type Rendered = Record<string, RenderedAyah>;

const key = (s: number, a: number) => `${s}:${a}`;

export function FurqanPlayer({ composition }: { composition: Composition }) {
  const stations = React.useMemo(() => flatten(composition), [composition]);

  const [pos, setPos] = React.useState(0);
  // الفَلَك runs from the start: the experience navigates itself, and the
  // reader takes over only if they want to.
  const [orbit, setOrbit] = React.useState(true);
  const [loop, setLoop] = React.useState(true);
  const [siraj, setSiraj] = React.useState(0.7);
  const [moon, setMoon] = React.useState(false);
  const [rendered, setRendered] = React.useState<Rendered>({});
  const [loading, setLoading] = React.useState(true);
  const [revealed, setRevealed] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const [full, setFull] = React.useState(false);
  const [figures, setFigures] = React.useState(true);
  const sky = useSky();

  const current = stations[pos];
  const dwellMs = ((current?.station.dwell ?? composition.dwell) || 9) * 1000;

  // ── fetch every locus the composition names, once ────────────────────────
  React.useEffect(() => {
    const loci = stations.map((s) => [s.station.surah, s.station.ayah] as [number, number]);
    if (!loci.length) {
      setLoading(false);
      return;
    }
    let live = true;
    fetch('/api/render', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ loci }),
    })
      .then((r) => r.json())
      .then((d: Rendered) => {
        if (!live) return;
        setRendered(d);
        setLoading(false);
      })
      .catch(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [stations]);

  const ayah = current ? rendered[key(current.station.surah, current.station.ayah)] : undefined;

  const go = React.useCallback(
    (next: number) => {
      if (!stations.length) return;
      const wrapped = loop
        ? ((next % stations.length) + stations.length) % stations.length
        : Math.max(0, Math.min(stations.length - 1, next));
      setPos(wrapped);
      setRevealed(0);
    },
    [stations.length, loop],
  );

  // ── the reveal: words arrive in reading order across the dwell ───────────
  React.useEffect(() => {
    if (!ayah) return;
    setRevealed(0);
    const n = ayah.words.length;
    if (!n) return;
    // Reveal over the first two thirds of the dwell, leaving the rest to rest.
    const step = Math.max(70, (dwellMs * 0.62) / n);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setRevealed(i);
      if (i >= n) clearInterval(t);
    }, step);
    return () => clearInterval(t);
  }, [ayah, dwellMs]);

  // ── الفَلَك: the circuit ──────────────────────────────────────────────────
  React.useEffect(() => {
    if (!orbit || !stations.length) return;
    const t = setTimeout(() => go(pos + 1), dwellMs);
    return () => clearTimeout(t);
  }, [orbit, pos, dwellMs, go, stations.length]);

  // ── keys ─────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          setOrbit((v) => !v);
          break;
        // RTL: ArrowLeft moves forward through the reading order.
        case 'ArrowLeft':
          go(pos + 1);
          break;
        case 'ArrowRight':
          go(pos - 1);
          break;
        case 'ArrowDown':
          jumpMovement(1);
          break;
        case 'ArrowUp':
          jumpMovement(-1);
          break;
        case 'm':
          setMoon((v) => !v);
          break;
        case 'f':
          toggleFull();
          break;
        case 'Escape':
          if (document.fullscreenElement) void document.exitFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const jumpMovement = (dir: number) => {
    if (!current) return;
    const target = current.mi + dir;
    const first = stations.findIndex((s) => s.mi === target);
    if (first >= 0) go(first);
  };

  const toggleFull = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      setFull(false);
    } else {
      void document.documentElement.requestFullscreen?.();
      setFull(true);
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the URL bar still has it */
    }
  };

  if (!stations.length) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background">
        <p className="quran text-2xl text-gold">{composition.title}</p>
        <p className="text-sm text-muted-foreground">لا مقامات في هذا التأليف بعد.</p>
        <Link href="/gallery" className="text-xs text-gold hover:underline">
          عودة إلى المعرض
        </Link>
      </div>
    );
  }

  const seamSet = new Set(ayah?.seams ?? []);
  const focus = current.station.focus;
  const anchorId = anchorFor(sky, current.mi, current.si);
  const constellationName =
    sky?.constellations.find((c) => c.id === anchorId)?.ar ?? null;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background">
      <Celestial
        data={sky}
        target={anchorFor(sky, current?.mi ?? 0, current?.si ?? 0)}
        intensity={siraj}
        figures={figures}
        pulseKey={pos}
      />
      {/* The text has to stay readable over a live sky. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 52% 38% at 50% 46%, rgba(15,23,42,0.82), rgba(15,23,42,0.24) 64%, transparent 84%)',
        }}
      />

      {/* ── the برج this station belongs to ── */}
      <header className="relative z-10 flex items-start justify-between gap-4 px-5 pt-4">
        <div className="min-w-0">
          <p className="truncate text-[0.7rem] text-muted-foreground">{composition.title}</p>
          <h1 className="quran quran-tight truncate text-[1.5rem] text-gold">
            {current.movement.title}
          </h1>
          {current.movement.note && (
            <p className="mt-0.5 max-w-2xl text-[0.68rem] leading-relaxed text-muted-foreground/85">
              {current.movement.note}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconBtn onClick={share} title="نذيرًا — انسخ الرابط">
            {copied ? <span className="text-[0.6rem] text-gold">نُسخ</span> : <Share2 className="h-4 w-4" />}
          </IconBtn>
          <IconBtn onClick={toggleFull} title="ملء الشاشة">
            {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </IconBtn>
          <Link href="/gallery" title="المعرض">
            <IconBtn><X className="h-4 w-4" /></IconBtn>
          </Link>
        </div>
      </header>

      {/* ── the āyah ── */}
      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-6">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gold" />
        ) : !ayah ? (
          <p className="text-sm text-muted-foreground">تعذّر إحضار هذه الآية.</p>
        ) : (
          <div className={cn('grid w-full max-w-6xl gap-6', moon && 'lg:grid-cols-[1.6fr_1fr]')}>
            <div>
              <p
                className="quran text-center leading-[2.15]"
                style={{ fontSize: 'clamp(1.7rem, 3.6vw, 3.1rem)' }}
              >
                {ayah.words.map((w, i) => {
                  const shown = i < revealed;
                  const inFocus = !!focus && w.idx >= focus.from && w.idx <= focus.to;
                  const isSeam = seamSet.has(w.idx) || current.station.seam === w.idx;
                  const hue = w.person ? PERSON_STYLE[w.person].hex : undefined;
                  return (
                    <span
                      key={w.idx}
                      className="transition-all duration-700"
                      style={{
                        opacity: shown ? 1 : 0.08,
                        filter: shown ? 'none' : 'blur(3px)',
                        color: inFocus ? '#FFF8E7' : undefined,
                        textShadow: inFocus ? '0 0 26px rgba(200,164,92,0.55)' : undefined,
                        textDecoration: hue && siraj > 0.05 ? 'underline' : undefined,
                        textDecorationColor: hue
                          ? `${hue}${Math.round(siraj * 255).toString(16).padStart(2, '0')}`
                          : undefined,
                        textDecorationThickness: '2px',
                        textUnderlineOffset: '0.32em',
                        background: w.khalq && siraj > 0.05 ? `${KHALQ_HEX}1a` : undefined,
                        borderRadius: '0.25rem',
                        padding: '0 0.08em',
                        boxShadow:
                          isSeam && shown ? 'inset 0 -0.42em 0 -0.34em rgba(200,164,92,0.9)' : undefined,
                      }}
                    >
                      {w.text}{' '}
                    </span>
                  );
                })}
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[0.7rem]">
                <span className="quran text-gold/90">
                  {ayah.name} · {arabicNumber(ayah.ayah)}
                </span>
                <span className="text-muted-foreground/60">|</span>
                <span className="font-mono tracking-[0.25em] text-muted-foreground">
                  {ayah.sig ? arabicNumber(Number(ayah.sig)) : '—'}
                </span>
                {current.station.discoveryKind && (
                  <span
                    className="rounded-full border px-2 py-px"
                    style={{
                      borderColor: `${DISCOVERY_STYLE[current.station.discoveryKind as keyof typeof DISCOVERY_STYLE]?.hex ?? '#C8A45C'}55`,
                      color: DISCOVERY_STYLE[current.station.discoveryKind as keyof typeof DISCOVERY_STYLE]?.hex ?? '#C8A45C',
                    }}
                  >
                    {DISCOVERY_STYLE[current.station.discoveryKind as keyof typeof DISCOVERY_STYLE]?.label ??
                      current.station.discoveryKind}
                  </span>
                )}
              </div>

              {current.station.caption && (
                <p className="mx-auto mt-3 max-w-3xl text-center text-[0.82rem] leading-relaxed text-foreground/70">
                  {current.station.caption}
                </p>
              )}
            </div>

            {/* القمر المنير — the reflected pane */}
            {moon && <ReflectedPane stations={stations} pos={pos} rendered={rendered} />}
          </div>
        )}
      </main>

      {/* ── الفرقان: the controls ── */}
      <Controls
        composition={composition}
        stations={stations}
        pos={pos}
        go={go}
        orbit={orbit}
        setOrbit={setOrbit}
        loop={loop}
        setLoop={setLoop}
        siraj={siraj}
        setSiraj={setSiraj}
        moon={moon}
        setMoon={setMoon}
        figures={figures}
        setFigures={setFigures}
        constellation={constellationName}
      />
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
        active
          ? 'border-gold/50 bg-gold/15 text-gold'
          : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/25 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

/** The station before this one, held beside it — reflected rather than emitted. */
function ReflectedPane({
  stations,
  pos,
  rendered,
}: {
  stations: ReturnType<typeof flatten>;
  pos: number;
  rendered: Rendered;
}) {
  const prev = stations[pos - 1] ?? stations[stations.length - 1];
  const a = prev ? rendered[key(prev.station.surah, prev.station.ayah)] : undefined;
  if (!a) return null;
  return (
    <aside className="hidden self-center rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-sm lg:block">
      <p className="mb-2 flex items-center gap-1.5 text-[0.62rem] text-muted-foreground">
        <Moon className="h-3 w-3" />
        القمر المنير — المقام الذي قبله
      </p>
      <p className="quran text-right text-[1.3rem] leading-[2] text-foreground/60">{a.uthmani}</p>
      <p className="mt-2 flex items-center justify-between text-[0.62rem] text-muted-foreground">
        <span className="quran">{a.name} · {arabicNumber(a.ayah)}</span>
        <span className="font-mono tracking-widest">{a.sig ? arabicNumber(Number(a.sig)) : '—'}</span>
      </p>
    </aside>
  );
}

function Controls({
  composition, stations, pos, go, orbit, setOrbit, loop, setLoop, siraj, setSiraj, moon, setMoon,
  figures, setFigures, constellation,
}: {
  composition: Composition;
  stations: ReturnType<typeof flatten>;
  pos: number;
  go: (n: number) => void;
  orbit: boolean;
  setOrbit: (f: (v: boolean) => boolean) => void;
  loop: boolean;
  setLoop: (f: (v: boolean) => boolean) => void;
  siraj: number;
  setSiraj: (v: number) => void;
  moon: boolean;
  setMoon: (f: (v: boolean) => boolean) => void;
  figures: boolean;
  setFigures: (f: (v: boolean) => boolean) => void;
  constellation: string | null;
}) {
  const current = stations[pos];
  const inMovement = stations.filter((s) => s.mi === current.mi);
  const firstOfMovement = stations.findIndex((s) => s.mi === current.mi);

  return (
    <footer className="relative z-10 border-t border-white/[0.06] bg-background/55 px-5 py-3 backdrop-blur-xl">
      {/* البروج — the movements */}
      <div className="mb-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="shrink-0 text-[0.6rem] text-gold/70">البروج</span>
        {constellation && (
          <span className="quran shrink-0 rounded-full border border-gold/25 bg-gold/[0.07] px-2 py-0.5 text-[0.85rem] text-gold/85">
            {constellation}
          </span>
        )}
        {composition.movements.map((m, mi) => {
          const at = stations.findIndex((s) => s.mi === mi);
          const active = current.mi === mi;
          return (
            <button
              key={m.id}
              onClick={() => at >= 0 && go(at)}
              title={m.note}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 text-[0.68rem] transition-all',
                active
                  ? 'border-gold/60 bg-gold/15 text-gold shadow-[0_0_18px_-4px_rgba(200,164,92,0.7)]'
                  : 'border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground/80',
              )}
            >
              <span className="quran">{m.title}</span>
            </button>
          );
        })}
      </div>

      {/* مواقع النجوم — positions inside this برج */}
      <div className="mb-2.5 flex items-center gap-2">
        <span className="shrink-0 text-[0.6rem] text-gold/70">مواقع النجوم</span>
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {inMovement.map((s, i) => {
            const idx = firstOfMovement + i;
            const active = idx === pos;
            const isDiscovery = s.station.source === 'discovery';
            return (
              <button
                key={`${s.station.surah}:${s.station.ayah}:${i}`}
                onClick={() => go(idx)}
                title={`${s.station.surah}:${s.station.ayah}${s.station.caption ? ` — ${s.station.caption}` : ''}`}
                className="group relative flex h-5 shrink-0 items-center px-0.5"
              >
                <span
                  className={cn(
                    'block rounded-full transition-all',
                    active ? 'h-2.5 w-2.5' : 'h-1.5 w-1.5 group-hover:h-2 group-hover:w-2',
                  )}
                  style={{
                    background: active ? '#FDE68A' : isDiscovery ? 'rgba(200,164,92,0.5)' : 'rgba(255,255,255,0.25)',
                    boxShadow: active ? '0 0 12px 2px rgba(253,230,138,0.7)' : undefined,
                  }}
                />
              </button>
            );
          })}
        </div>
        <span className="shrink-0 text-[0.62rem] tabular-nums text-muted-foreground">
          {arabicNumber(pos + 1)}⁄{arabicNumber(stations.length)}
        </span>
      </div>

      {/* transport */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <IconBtn onClick={() => go(pos - 1)} title="السابق">
            <ChevronRight className="h-4 w-4" />
          </IconBtn>
          <button
            onClick={() => setOrbit((v) => !v)}
            title="الفَلَك — كلٌّ في فلكٍ يسبحون (مسافة)"
            aria-pressed={orbit}
            className={cn(
              'flex h-9 items-center gap-2 rounded-full border px-4 text-[0.72rem] transition-all',
              orbit
                ? 'border-gold/60 bg-gold/15 text-gold'
                : 'border-white/12 bg-white/[0.04] text-foreground/80 hover:border-white/25',
            )}
          >
            <Orbit className={cn('h-4 w-4', orbit && 'animate-spin [animation-duration:6s]')} />
            الفَلَك
          </button>
          <IconBtn onClick={() => go(pos + 1)} title="التالي">
            <ChevronLeft className="h-4 w-4" />
          </IconBtn>
          <IconBtn onClick={() => setLoop((v) => !v)} title="دوران دائم" active={loop}>
            <Repeat className="h-4 w-4" />
          </IconBtn>
        </div>

        <div className="flex items-center gap-3">
          {/* السراج */}
          <div className="flex items-center gap-2" title="السِّراج — شدّة إظهار الإسناد">
            <Sun className="h-3.5 w-3.5 text-gold/80" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={siraj}
              onChange={(e) => setSiraj(Number(e.target.value))}
              aria-label="السراج"
              className="isnad-range h-1.5 w-28 cursor-pointer appearance-none rounded-full"
              style={{
                background: `linear-gradient(to left, #C8A45C 0%, #C8A45C ${siraj * 100}%, rgba(255,255,255,0.09) ${siraj * 100}%, rgba(255,255,255,0.09) 100%)`,
              }}
            />
          </div>
          <IconBtn onClick={() => setMoon((v) => !v)} title="القمر المنير — المقام المقابل" active={moon}>
            <Moon className="h-4 w-4" />
          </IconBtn>
          <IconBtn onClick={() => setFigures((v) => !v)} title="صُوَر البروج" active={figures}>
            <Stars className="h-4 w-4" />
          </IconBtn>
        </div>
      </div>
    </footer>
  );
}
