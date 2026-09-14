'use client';
// ============================================================================
//  الكون — the shell.
//
//  Navigation is the text's own:
//
//    السنابل   seven branches from whichever grain you stand on, after 2:261.
//              Pressing one flies there, and seven more open from it. There is
//              no end to the walk, which is the point.
//    السُّلَّم   the ladder — أَمْ لَهُمْ سُلَّمٌ يَسْتَمِعُونَ فِيهِ. Climbing rescales
//              discourse distance, so the same field opens or closes around you.
//    الإسناد    the camera itself. المتكلم seats you at the āyah looking out;
//              المخاطب places it before you; الغائب watches from outside.
// ============================================================================
import * as React from 'react';
import Link from 'next/link';
import {
  Loader2, Clock, Telescope, Layers, Eye, Sparkles, ChevronsUp,
  ChevronsDown, GalleryVerticalEnd, Shuffle, Sun, Spline, Rocket,
} from 'lucide-react';
import type { CosmosNode, CosmosPayload, SkyPayload } from '@/lib/cosmos';
import { PERSON_STYLE } from '@/lib/view';
import { arabicNumber, cn } from '@/lib/utils';
import { CosmosScene, type Pov, type SceneHandle } from './scene';
import { TimeBoard, routeFilter, type RouteState } from './fmc';
import {
  useStrandField,
  DEFAULT_CUT,
  DEFAULT_STRAND_OPTIONS,
  type CutState,
  type StrandOptions,
} from './use-strands';
import { StrandLegend } from './strand-panel';
import { GrainCard } from './grain-card';
import { DetectorCut } from './detector-cut';
import { BasisControl } from './basis-control';
import {
  constellationBasis,
  contourBasis,
  isnadBasis,
  measureBasis,
  type BasisId,
} from '@/lib/cosmos/basis';
import type { Vec3 } from '@/lib/cosmos/placement';

const POVS: { id: Pov; label: string; hint: string; hue: string }[] = [
  { id: 'free', label: 'طَلِيق', hint: 'تطير كما تشاء — WASD وسحبٌ بالفأرة', hue: '#C8A45C' },
  { id: 'mutakallim', label: 'المُتَكَلِّم', hint: 'تجلس حيث تكلَّمت الآية، وتنظر إلى خارجها', hue: '#D97706' },
  { id: 'mukhatab', label: 'المُخَاطَب', hint: 'تقف أمامها، وهي تخاطبك', hue: '#059669' },
  { id: 'ghaib', label: 'الغَائِب', hint: 'تراها من خارجها وأنت غيرُ حاضرٍ فيها', hue: '#0284C7' },
];

export function Cosmos() {
  const [payload, setPayload] = React.useState<CosmosPayload | null>(null);
  const [sky, setSky] = React.useState<SkyPayload | null>(null);
  const [focus, setFocus] = React.useState<number | null>(null);
  const [pov, setPov] = React.useState<Pov>('free');
  const [sullam, setSullam] = React.useState(1);
  const [burn, setBurn] = React.useState(0.72);
  const [figures, setFigures] = React.useState(true);
  const [boardOpen, setBoardOpen] = React.useState(false);
  const [route, setRoute] = React.useState<RouteState>({ legs: [], strict: false });
  const [trail, setTrail] = React.useState<number[]>([]);
  const [strandOpt, setStrandOpt] = React.useState<StrandOptions>(DEFAULT_STRAND_OPTIONS);
  const [cut, setCut] = React.useState<CutState>(DEFAULT_CUT);
  const [legendOpen, setLegendOpen] = React.useState(true);
  // البروج is the default and nothing moves until the reader moves it: the
  // point of the control is the comparison, not a silent re-placement.
  const [basisId, setBasisId] = React.useState<BasisId>('constellation');
  const [basisBlend, setBasisBlend] = React.useState(1);
  const [spectral, setSpectral] = React.useState<{ directions: Vec3[]; locality: number } | null>(null);
  const [spectralLoading, setSpectralLoading] = React.useState(false);

  const sceneRef = React.useRef<SceneHandle | null>(null);
  const flightRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    let live = true;
    void Promise.all([
      fetch('/api/cosmos').then((r) => r.json()),
      fetch('/api/sky').then((r) => r.json()),
    ]).then(([c, s]) => {
      if (!live) return;
      if (!c.error) setPayload(c);
      if (!s.error) setSky(s);
    });
    return () => {
      live = false;
    };
  }, []);

  // Memoised: a fresh `[]` on every render would re-run the route filter and,
  // worse, tear down and rebuild the whole WebGL scene.
  const nodes = React.useMemo(() => payload?.nodes ?? [], [payload]);
  const visible = React.useMemo(() => (nodes.length ? routeFilter(nodes, route) : null), [nodes, route]);
  const node = focus !== null ? nodes[focus] : null;

  // The relations the engine already found, joined to the placed āyāt. The
  // hook decides which few hundred of ~10,300 a frame may show; the scene
  // draws exactly what it is handed.
  const field = useStrandField(nodes, focus, visible, strandOpt, cut);

  // The spectral basis needs the leading eigenvectors of a 1,000 × 1,000
  // adjacency, so it comes from the server; the other two are O(n) and are
  // built here the moment they are asked for.
  React.useEffect(() => {
    if (basisId !== 'spectral' || spectral || spectralLoading) return;
    setSpectralLoading(true);
    void fetch('/api/cosmos/basis')
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setSpectral({ directions: d.directions, locality: d.locality });
      })
      .catch(() => undefined)
      .finally(() => setSpectralLoading(false));
  }, [basisId, spectral, spectralLoading]);

  const basisDirections = React.useMemo<Vec3[] | null>(() => {
    if (!nodes.length || basisId === 'constellation') return null;
    if (basisId === 'isnad') return isnadBasis(nodes).directions;
    if (basisId === 'contour') return contourBasis(nodes).directions;
    return spectral?.directions ?? null;
  }, [nodes, basisId, spectral]);

  // Measured against the relations that owe nothing to placement, which is the
  // only honest test: السنابل were themselves built from isnād and time.
  const locality = React.useMemo(() => {
    if (!nodes.length || !field.ready) return null;
    if (basisId === 'spectral') return spectral?.locality ?? null;
    const independent = field.all.filter((s) => s.kind !== 'sunbula');
    if (!independent.length) return null;
    const b =
      basisId === 'isnad'
        ? isnadBasis(nodes)
        : basisId === 'contour'
          ? contourBasis(nodes)
          : constellationBasis(nodes);
    return measureBasis(nodes, independent, b).locality;
  }, [nodes, basisId, field.ready, field.all, spectral]);

  const goTo = React.useCallback(
    (i: number) => {
      setFocus(i);
      setTrail((t) => [i, ...t.filter((x) => x !== i)].slice(0, 12));
      sceneRef.current?.flyTo(i);
    },
    [],
  );

  // Cancel any programmed flight the moment the reader steers themselves.
  const stopFlight = React.useCallback(() => {
    if (flightRef.current !== null) {
      window.clearTimeout(flightRef.current);
      flightRef.current = null;
    }
  }, []);

  const pick = React.useCallback(
    (i: number) => {
      stopFlight();
      goTo(i);
    },
    [goTo, stopFlight],
  );

  /** Fly a programmed route, one leg at a time. */
  const flyRoute = React.useCallback(
    (seq: number[]) => {
      stopFlight();
      if (!seq.length) return;
      setBoardOpen(false);
      let k = 0;
      const step = () => {
        if (k >= seq.length) {
          flightRef.current = null;
          return;
        }
        goTo(seq[k++]);
        flightRef.current = window.setTimeout(step, 5200);
      };
      step();
    },
    [goTo, stopFlight],
  );

  React.useEffect(() => () => stopFlight(), [stopFlight]);

  // Keys that belong to the shell rather than to the flight controls.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 't') setBoardOpen((v) => !v);
      if (e.key === 'g') setFigures((v) => !v);
      if (e.key >= '1' && e.key <= '7' && node) {
        const j = node.sb[Number(e.key) - 1];
        if (j !== undefined) pick(j);
      }
      if (e.key === 'r' && nodes.length) pick(Math.floor(Math.random() * nodes.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [node, nodes.length, pick]);

  if (!payload) {
    return (
      <div className="flex h-dvh items-center justify-center gap-2 bg-background text-[0.78rem] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-gold" />
        يُبنى الكون…
      </div>
    );
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-[#0b1120]">
      <CosmosScene
        nodes={nodes}
        sky={sky}
        focus={focus}
        pov={pov}
        sullam={sullam}
        burn={burn}
        visible={visible}
        showFigures={figures}
        strands={field.selected}
        ribat={field.ribat}
        basis={basisDirections}
        basisBlend={basisBlend}
        onPick={pick}
        sceneRef={sceneRef}
      />

      {/* ── head ── */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4">
        <div className="pointer-events-auto">
          <h1 className="quran quran-tight text-[1.5rem] text-gold">مَرْصَدُ الإسناد</h1>
          <p className="text-[0.62rem] text-muted-foreground">
            {arabicNumber(payload.count)} آية في فضاء الإسناد ·{' '}
            {visible ? `${arabicNumber(visible.size)} ضمن المسار` : 'الحقل كامل'}
            {field.ready ? ` · ${arabicNumber(field.selected.length)} خيطًا مرسومًا` : ''}
          </p>
        </div>
        <nav className="pointer-events-auto flex flex-wrap items-center gap-1">
          <Chip onClick={() => setBoardOpen((v) => !v)} active={boardOpen} icon={<Clock className="h-3 w-3" />}>
            لوح الزمن
          </Chip>
          <Chip onClick={() => setFigures((v) => !v)} active={figures} icon={<Sparkles className="h-3 w-3" />}>
            الصُّوَر
          </Chip>
          <Chip onClick={() => setLegendOpen((v) => !v)} active={legendOpen} icon={<Spline className="h-3 w-3" />}>
            الخيوط
          </Chip>
          <Chip onClick={() => pick(Math.floor(Math.random() * nodes.length))} icon={<Shuffle className="h-3 w-3" />}>
            انطلِق
          </Chip>
          <Link href="/rihla"><Chip icon={<Rocket className="h-3 w-3" />}>الرِّحلة</Chip></Link>
          <Link href="/explore"><Chip icon={<Telescope className="h-3 w-3" />}>السور</Chip></Link>
          <Link href="/gallery"><Chip icon={<GalleryVerticalEnd className="h-3 w-3" />}>المعرض</Chip></Link>
          <Link href="/studio"><Chip icon={<Layers className="h-3 w-3" />}>المرصد</Chip></Link>
        </nav>
      </header>

      {/* ── POV: the isnād is the camera ── */}
      <div className="pointer-events-auto absolute right-4 top-24 z-20 max-h-[calc(100dvh-8rem)] w-48 space-y-1 overflow-y-auto thin-scroll pl-1">
        <p className="mb-1 flex items-center gap-1 text-[0.58rem] tracking-wider text-gold/70">
          <Eye className="h-3 w-3" />
          مقعدُ النظر
        </p>
        {POVS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPov(p.id)}
            title={p.hint}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg border px-2 py-1 text-right transition-all',
              pov === p.id ? 'bg-white/[0.07]' : 'border-white/[0.07] bg-black/25 hover:bg-white/[0.05]',
            )}
            style={pov === p.id ? { borderColor: `${p.hue}88` } : undefined}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.hue }} />
            <span className="quran flex-1 text-[0.95rem]" style={{ color: pov === p.id ? p.hue : undefined }}>
              {p.label}
            </span>
          </button>
        ))}
        {pov !== 'free' && !node && (
          <p className="text-[0.55rem] leading-snug text-muted-foreground/70">
            اختر آيةً ليأخذ المقعدُ موضعَه.
          </p>
        )}
        {legendOpen && field.ready && (
          <div className="space-y-2 pt-2">
            <BasisControl
              basis={basisId}
              setBasis={setBasisId}
              blend={basisBlend}
              setBlend={setBasisBlend}
              locality={locality}
              loading={spectralLoading}
            />
            <StrandLegend
              opt={strandOpt}
              setOpt={setStrandOpt}
              counts={field.counts}
              drawn={field.selected.length}
              total={field.all.length}
              coverage={field.coverage}
            />
            <DetectorCut
              cut={cut}
              setCut={setCut}
              coverage={field.coverage}
              cutAway={field.cutAway}
              derivation={field.derivation}
            />
          </div>
        )}
      </div>

      {/* ── السُّلَّم ── */}
      <div className="pointer-events-auto absolute left-4 top-24 z-20 flex w-12 flex-col items-center gap-2 rounded-xl border border-white/[0.07] bg-black/35 py-2 backdrop-blur-sm">
        <ChevronsUp className="h-3.5 w-3.5 text-gold/70" />
        <input
          type="range"
          min={0.35}
          max={2.4}
          step={0.05}
          value={sullam}
          onChange={(e) => setSullam(Number(e.target.value))}
          aria-label="السلم"
          title="السُّلَّم — أم لهم سلمٌ يستمعون فيه"
          className="isnad-range h-24 w-1.5 cursor-pointer appearance-none rounded-full"
          style={{
            writingMode: 'vertical-lr',
            direction: 'rtl',
            background: `linear-gradient(to top, #C8A45C 0%, #C8A45C ${((sullam - 0.35) / 2.05) * 100}%, rgba(255,255,255,0.09) ${((sullam - 0.35) / 2.05) * 100}%, rgba(255,255,255,0.09) 100%)`,
          }}
        />
        <ChevronsDown className="h-3.5 w-3.5 text-gold/70" />
        <span className="quran text-[0.72rem] text-gold/80">سُلَّم</span>
      </div>

      {/* ── السراج ── */}
      <div className="pointer-events-auto absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full border border-white/[0.07] bg-black/40 px-3 py-1.5 backdrop-blur-sm">
        <Sun className="h-3.5 w-3.5 text-gold/80" />
        <input
          type="range"
          min={0.15}
          max={1}
          step={0.05}
          value={burn}
          onChange={(e) => setBurn(Number(e.target.value))}
          aria-label="السراج"
          className="isnad-range h-1.5 w-24 cursor-pointer appearance-none rounded-full"
          style={{
            background: `linear-gradient(to left, #C8A45C 0%, #C8A45C ${((burn - 0.15) / 0.85) * 100}%, rgba(255,255,255,0.09) ${((burn - 0.15) / 0.85) * 100}%, rgba(255,255,255,0.09) 100%)`,
          }}
        />
      </div>

      {/* ── the grain you are on ── */}
      {/*
          The field is the main view. The card opens at a glance and each count
          is a door; nothing is listed until it is asked for.
      */}
      {node && (
        <GrainCard
          node={node}
          nodes={nodes}
          strands={field.atFocus}
          ribat={field.ribat}
          derivation={field.derivation}
          visible={visible}
          onPick={pick}
        />
      )}

      {/* ── trail ── */}
      {trail.length > 1 && (
        <div className="pointer-events-auto absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-0.5 xl:flex">
          {trail.slice(0, 9).map((i, k) => (
            <button
              key={`${i}-${k}`}
              onClick={() => pick(i)}
              className={cn(
                'quran rounded px-1.5 py-0.5 text-right text-[0.75rem] transition-colors',
                k === 0 ? 'text-gold' : 'text-muted-foreground/50 hover:text-foreground/80',
              )}
              style={{ opacity: 1 - k * 0.1 }}
            >
              {nodes[i].name} {arabicNumber(nodes[i].a)}
            </button>
          ))}
        </div>
      )}

      <TimeBoard
        open={boardOpen}
        onClose={() => setBoardOpen(false)}
        nodes={nodes}
        route={route}
        setRoute={setRoute}
        onFly={flyRoute}
        focus={node}
      />

      {/* Legend only while nothing is selected: the grain card takes this space. */}
      <div className={cn(
        'pointer-events-none absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-3 text-[0.55rem] text-muted-foreground/60',
        node ? 'lg:hidden' : 'lg:flex',
      )}>
        {([1, 2, 3] as const).map((p) => (
          <span key={p} className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: PERSON_STYLE[p].hex }} />
            {PERSON_STYLE[p].label}
          </span>
        ))}
        <span className="opacity-40">·</span>
        <span>WASD للطيران · سحبٌ للنظر · ١–٧ للسنابل · T للوح · R انطلاقة</span>
      </div>
    </div>
  );
}

function Chip({
  children, onClick, active, icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.68rem] transition-colors',
        active
          ? 'border-gold/50 bg-gold/15 text-gold'
          : 'border-white/10 bg-black/30 text-muted-foreground hover:border-gold/35 hover:text-gold',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
