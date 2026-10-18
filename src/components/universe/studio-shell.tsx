'use client';
// ============================================================================
//  الاستوديو — the full universe, open to anyone.
//
//  One field (6,236 āyāt), two lenses (isnād space, the catalogue sky), and the
//  original composite field kept at `/` as a historical artifact. Everything a
//  reader can do here is either reading (inspect, notes), flying (manual,
//  voyage, replay), or keeping (capture, record, hand off) — and the dock is
//  laid out in exactly those three groups.
// ============================================================================
import * as React from 'react';
import Link from 'next/link';
import {
  Compass, Home, Pause, Play, Square, Camera, Video, Circle, Download, Upload, Share2,
  Settings2, Gauge, BookmarkPlus, Search, X, NotebookPen, HelpCircle, Route, Telescope, Orbit,
} from 'lucide-react';
import type { SkyPayload } from '@/lib/cosmos';
import { FLAG, type UniverseManifest, type UniversePayload, type UniverseRelations } from '@/lib/universe/types';
import { indexRelations, type Leg } from '@/lib/universe/relations';
import { ordinalOf } from '@/lib/universe/build';
import {
  DEFAULT_VOYAGE_CONFIG,
  decodeVoyageConfig,
  encodeVoyageConfig,
  planVoyage,
  type Voyage,
  type VoyageConfig,
} from '@/lib/universe/voyage';
import { diagnose, float32Ulp, depthResolution, frameStats, verifyRecording, type Recording } from '@/lib/universe/recorder';
import { ACCESS_STATEMENT, decodeHandoff, encodeHandoff, makeHandoff, type HandoffState } from '@/lib/universe/handoff';
import { displayUthmani } from '@/lib/universe/display-text';
import { notesToMarkdown, parseNotes, type ResearchNote } from '@/lib/universe/research-notes';
import { DISCOVERY_STYLE } from '@/lib/view';
import { arabicNumber, cn } from '@/lib/utils';
import { arabicDecimal } from '@/lib/numerals';
import { UniverseScene, DEFAULT_FLIGHT, type FlightSettings, type Lens, type Telemetry, type UniverseHandle } from './universe-scene';
import { Minimap } from './minimap';
import { Tour, TOUR } from './tour';

type Panel = 'none' | 'voyage' | 'flight' | 'recorder' | 'handoff' | 'notes' | 'coverage';

const KIND_AR: Record<string, string> = { tartib: 'ترتيب المصحف', root: 'جذرٌ نادر مشترك', motif: 'كنتور مثاني', discovery: 'استنباط', start: 'مبتدأ' };
const PERSON_AR = ['المتكلم', 'المخاطب', 'الغائب'];

const store = {
  get(k: string): string | null {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* private mode: per-viewer convenience only */
    }
  },
};

function download(name: string, body: string | Blob, type = 'application/json') {
  const blob = typeof body === 'string' ? new Blob([body], { type }) : body;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function UniverseStudio() {
  const [universe, setUniverse] = React.useState<UniversePayload | null>(null);
  const [relations, setRelations] = React.useState<UniverseRelations | null>(null);
  const [manifest, setManifest] = React.useState<UniverseManifest | null>(null);
  const [sky, setSky] = React.useState<SkyPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [lens, setLens] = React.useState<Lens>('isnad');
  const [focus, setFocus] = React.useState<number | null>(null);
  const [settings, setSettings] = React.useState<FlightSettings>(DEFAULT_FLIGHT);
  const [panel, setPanel] = React.useState<Panel>('none');
  const [overlay, setOverlay] = React.useState(false);
  const [tele, setTele] = React.useState<Telemetry | null>(null);
  const [tourStep, setTourStep] = React.useState<number | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const [voyageCfg, setVoyageCfg] = React.useState<VoyageConfig>(DEFAULT_VOYAGE_CONFIG);
  const [voyage, setVoyage] = React.useState<Voyage | null>(null);
  const [voyagePlaying, setVoyagePlaying] = React.useState(false);
  const [leg, setLeg] = React.useState(0);
  const [bookmarks, setBookmarks] = React.useState<{ code: string; leg: number; label: string }[]>([]);

  const [text, setText] = React.useState<{ k: number; text: string; source: string } | null>(null);
  const [notes, setNotes] = React.useState<ResearchNote[]>([]);
  const [draft, setDraft] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [inspectorOpen, setInspectorOpen] = React.useState(true);

  const [recording, setRecording] = React.useState<Recording | null>(null);
  const [videoOn, setVideoOn] = React.useState(false);
  const [incoming, setIncoming] = React.useState<HandoffState | null>(null);
  const [handoffNote, setHandoffNote] = React.useState('');
  const [handoffLink, setHandoffLink] = React.useState<string | null>(null);

  const handle = React.useRef<UniverseHandle | null>(null);

  // ── data ──────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    let alive = true;
    const j = (u: string) => fetch(u).then((r) => r.json());
    void Promise.all([j('/api/universe'), j('/api/universe/relations'), j('/api/universe/manifest'), j('/api/sky')])
      .then(([u, r, m, s]) => {
        if (!alive) return;
        if (u.error) return setError(u.error);
        setUniverse(u);
        if (!r.error) setRelations(r);
        if (!m.error) setManifest(m);
        if (!s.error) setSky(s);
      })
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const adjacency = React.useMemo<Leg[][] | null>(
    () => (universe && relations ? indexRelations(relations, universe.count) : null),
    [universe, relations],
  );
  const ord = React.useCallback((s: number, a: number) => (universe ? ordinalOf(universe, s, a) : undefined), [universe]);

  // Per-viewer conveniences: tour seen, bookmarks, notes.
  React.useEffect(() => {
    if (!universe) return;
    setNotes(parseNotes(store.get('isnaad.notes')));
    try {
      setBookmarks(JSON.parse(store.get('isnaad.bookmarks') ?? '[]'));
    } catch {
      setBookmarks([]);
    }
    const params = new URLSearchParams(window.location.search);
    const v = params.get('voyage');
    if (v) {
      const cfg = decodeVoyageConfig(v);
      if (cfg) {
        // A shared route opens ready to fly; it never starts on its own.
        setVoyageCfg(cfg);
        setPanel('voyage');
      }
    }
    const h = window.location.hash.match(/[#&]h=([A-Za-z0-9_-]+)/);
    if (h) {
      const res = decodeHandoff(h[1], (s, a) => ordinalOf(universe, s, a));
      if (res.ok) setIncoming(res.handoff);
      else setToast(`تعذّر قراءة التسليم: ${res.reason}`);
    }
    if (!store.get('isnaad.tour') && !params.has('notour') && !h && !v) setTourStep(0);
  }, [universe]);

  React.useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Text of the focused āyah, from the corpus.
  React.useEffect(() => {
    if (!universe || focus === null) return;
    let alive = true;
    void fetch(`/api/universe/ayah?s=${universe.s[focus]}&a=${universe.a[focus]}`)
      .then((r) => r.json())
      .then((d) => alive && !d.error && setText({ k: focus, text: d.text, source: d.source }));
    return () => {
      alive = false;
    };
  }, [universe, focus]);

  const select = React.useCallback((k: number, fly = true) => {
    setFocus(k);
    setInspectorOpen(true);
    if (fly) handle.current?.flyTo(k);
  }, []);

  // ── voyage ────────────────────────────────────────────────────────────────
  const startVoyage = React.useCallback(
    (cfg: VoyageConfig, fromLeg = 0) => {
      if (!universe || !adjacency) return;
      const v = planVoyage(universe.count, adjacency, (k) => (universe.f[k] & FLAG.ATTRIBUTED) !== 0, cfg);
      setVoyage(v);
      setLeg(fromLeg);
      setVoyagePlaying(true);
      setLens('isnad');
      const t = fromLeg > 0 ? v.legs[Math.min(fromLeg, v.legs.length - 1)].arriveAt : 0;
      // The lens switch resets the camera on the next frame; start after it.
      requestAnimationFrame(() => requestAnimationFrame(() => handle.current?.playVoyage(v, t)));
    },
    [universe, adjacency],
  );

  const onLeg = React.useCallback(
    (i: number) => {
      setLeg(i);
      if (voyage) setFocus(voyage.legs[i]?.to ?? null);
      // On a phone the inspector would cover the caption and the flight.
      if (window.innerWidth < 640) setInspectorOpen(false);
    },
    [voyage],
  );

  // ── tour ──────────────────────────────────────────────────────────────────
  const runStep = React.useCallback(
    (i: number) => {
      setTourStep(i);
      if (!universe) return;
      const act = TOUR[i]?.act;
      setLens('isnad');
      if (act === 'home' || act === 'colours') {
        handle.current?.home();
        setFocus(null);
      }
      if (act === 'inspect') select(ordinalOf(universe, 11, 29)!);
      if (act === 'voyage') startVoyage({ ...DEFAULT_VOYAGE_CONFIG, seed: 'الجولة', legs: 3, dwell: 2, travel: 2.2 });
      if (act === 'fly' || act === 'honesty') {
        handle.current?.stopVoyage();
        setVoyagePlaying(false);
      }
    },
    [universe, select, startVoyage],
  );
  const closeTour = React.useCallback((finished: boolean) => {
    setTourStep(null);
    store.set('isnaad.tour', finished ? 'finished' : 'skipped');
  }, []);

  // ── keys ──────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === ' ' && voyage) {
        e.preventDefault();
        if (voyagePlaying) handle.current?.pauseVoyage();
        else handle.current?.resumeVoyage();
        setVoyagePlaying((p) => !p);
      }
      if (e.key === 'h') handle.current?.home();
      if (e.key === 'o') setOverlay((v) => !v);
      if (e.key === 'Escape') setPanel('none');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [voyage, voyagePlaying]);

  // ── search ────────────────────────────────────────────────────────────────
  const search = () => {
    if (!universe) return;
    const q = query.trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    let m = q.match(/^(\d+)\s*[:：\s]\s*(\d+)$/);
    let k: number | undefined;
    if (m) k = ordinalOf(universe, +m[1], +m[2]);
    else {
      m = q.match(/^(.+?)\s+(\d+)$/);
      const name = (m ? m[1] : q).replace(/^سورة\s+/, '');
      const s = universe.surahs.find((x) => x.name === name || x.name.replace(/^ال/, '') === name.replace(/^ال/, ''));
      if (s) k = s.first + (m ? Math.min(+m[2], s.count) - 1 : 0);
    }
    if (k === undefined) return setToast('لا يوجد موضعٌ بهذا الاسم أو الرقم');
    setLens('isnad');
    requestAnimationFrame(() => select(k!));
  };

  // ── keeping ───────────────────────────────────────────────────────────────
  const capture = () => {
    const url = handle.current?.capture();
    if (!url) return setToast('تعذّر الالتقاط');
    const a = document.createElement('a');
    a.href = url;
    a.download = `isnaad-${lens}-${focus !== null && universe ? `${universe.s[focus]}-${universe.a[focus]}` : 'field'}-${Date.now()}.png`;
    a.click();
    setToast('حُفظت اللقطة على جهازك');
  };

  const toggleVideo = async () => {
    if (!videoOn) {
      if (handle.current?.startVideo()) setVideoOn(true);
      else setToast('المتصفح لا يدعم تسجيل الفيديو من اللوحة');
      return;
    }
    const blob = await handle.current?.stopVideo();
    setVideoOn(false);
    if (blob) download(`isnaad-flight-${Date.now()}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`, blob);
  };

  const snapshotRecording = () => {
    const r = handle.current?.recorder()?.export() ?? null;
    setRecording(r);
    return r;
  };

  const makeLink = () => {
    if (!universe) return;
    const pose = handle.current?.pose() ?? null;
    const h = makeHandoff({
      locus: focus !== null ? { k: focus, surah: universe.s[focus], ayah: universe.a[focus] } : null,
      lens,
      voyage: voyage ? encodeVoyageConfig(voyage.config) : null,
      camera: pose,
      note: handoffNote,
      from: 'Abed',
      to: '7u',
    });
    const link = `${window.location.origin}/universe#h=${encodeHandoff(h)}`;
    setHandoffLink(link);
    return h;
  };

  const applyIncoming = (h: HandoffState) => {
    setLens(h.lens === 'celestial' ? 'celestial' : 'isnad');
    if (h.voyage) {
      const cfg = decodeVoyageConfig(h.voyage);
      if (cfg) setVoyageCfg(cfg);
    }
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (h.camera) handle.current?.setPose(h.camera.p, h.camera.look);
        if (h.locus) setFocus(h.locus.k);
      }),
    );
    setIncoming(null);
    history.replaceState(null, '', window.location.pathname + window.location.search);
  };

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center p-6 text-center text-muted-foreground">
        <p>{error}</p>
      </div>
    );
  }
  if (!universe) {
    return (
      <div className="flex h-dvh items-center justify-center text-muted-foreground" data-testid="loading">
        يُحمَّل الكون…
      </div>
    );
  }

  const k = focus;
  const flags = k !== null ? universe.f[k] : 0;
  const legsHere = k !== null && adjacency ? adjacency[k] : [];
  const currentLeg = voyage?.legs[leg];
  const counts = manifest?.counts;

  return (
    <div id="universe-root" className="fixed inset-0 overflow-hidden bg-[#070b16] text-foreground" data-testid="universe">
      <UniverseScene
        universe={universe}
        adjacency={adjacency}
        sky={sky}
        lens={lens}
        focus={focus}
        settings={settings}
        onPick={(i) => select(i, false)}
        onLeg={onLeg}
        onTelemetry={setTele}
        onVoyageEnd={() => setVoyagePlaying(false)}
        handleRef={handle}
      />

      {/* ── top bar ─────────────────────────────────────────────────────── */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto">
          <h1 className="text-lg text-gold sm:text-xl">مرصد الإسناد · الكون الكامل</h1>
          <p className="text-[11px] text-muted-foreground">
            {arabicNumber(universe.count)} آية · {arabicNumber(universe.surahs.length)} سورة · لا استثناء
          </p>
        </div>
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/70 bg-black/50 p-1 text-xs backdrop-blur" role="tablist" aria-label="العدسة">
          <button role="tab" aria-selected={lens === 'isnad'} className={cn('flex items-center gap-1 rounded-full px-3 py-1.5', lens === 'isnad' && 'bg-gold text-black')} onClick={() => setLens('isnad')}>
            <Orbit className="h-3.5 w-3.5" /> فضاء الإسناد
          </button>
          <button role="tab" aria-selected={lens === 'celestial'} className={cn('flex items-center gap-1 rounded-full px-3 py-1.5', lens === 'celestial' && 'bg-gold text-black')} onClick={() => setLens('celestial')}>
            <Telescope className="h-3.5 w-3.5" /> السماء
          </button>
          <Link href="/" className="rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground" title="الحقل الأصلي (ألف آية، البروج) محفوظًا كما كان">
            المركّب الأصلي
          </Link>
        </div>
      </header>

      {/* ── lens statement: always on, never optional ───────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[76px] z-10 flex justify-center px-3">
        <p className="max-w-xl rounded-md bg-black/40 px-3 py-1 text-center text-[10.5px] leading-5 text-muted-foreground" data-testid="lens-statement">
          {lens === 'isnad'
            ? universe.transform.disclaimer
            : 'عدسة السماء: ٥٬٠٤٤ نجمًا بإحداثياتها الاستوائية (المطلع المستقيم والميل). لا آيةَ مرسومةٌ هنا، ولا تحويلَ يربط هذا الفضاء بفضاء الإسناد.'}
        </p>
      </div>

      {/* ── search ──────────────────────────────────────────────────────── */}
      <form
        className="pointer-events-auto absolute end-3 top-[104px] z-20 flex w-56 items-center gap-1 rounded-full border border-border/70 bg-black/50 px-2 py-1 backdrop-blur sm:top-[86px]"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          aria-label="ابحث عن موضع"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="٢:٢٥٥ أو البقرة ٢٥٥"
          className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
        />
      </form>

      {/* ── inspector ───────────────────────────────────────────────────── */}
      {k !== null && lens === 'isnad' && (
        <aside
          className={cn(
            'pointer-events-auto absolute end-3 top-[146px] z-20 w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-border/70 bg-[#0b1120]/90 p-3 backdrop-blur',
            inspectorOpen ? 'max-h-[calc(100dvh-19rem)]' : 'max-h-14 overflow-hidden [&>*:not(:first-child)]:hidden',
          )}
          data-testid="inspector"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-base text-gold">
              {universe.surahs[universe.s[k] - 1].name} {arabicNumber(universe.a[k])}
            </h2>
            <div className="flex items-center gap-2">
              <button className="text-[11px] text-muted-foreground" aria-expanded={inspectorOpen} onClick={() => setInspectorOpen((v) => !v)}>
                {inspectorOpen ? 'اطوِ' : 'افتح'}
              </button>
              <button aria-label="إغلاق" onClick={() => setFocus(null)}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          <p className="font-quran text-xl leading-[2.4]" data-testid="ayah-text">
            {text?.k === k ? displayUthmani(text.text) : '…'}
          </p>
          <p className="mb-2 text-[10px] text-muted-foreground/70">النص: {text?.source ?? '—'}</p>

          <div className="mb-1 text-[11px] text-muted-foreground">استنباطٌ آليّ — ليس تفسيرًا</div>
          <ul className="space-y-1 text-xs" data-testid="extracted">
            {flags & FLAG.ATTRIBUTED ? (
              <li>
                الإسناد: {PERSON_AR.map((p, i) => `${p} ${arabicNumber(Math.round(universe.v[k * 3 + i] * 100))}٪`).join(' · ')} — المسافة{' '}
                {arabicDecimal(universe.d[k])}
              </li>
            ) : (
              <li>لا إسنادَ إلى شخص في هذه الآية — موضوعةٌ على الحلقة الخارجية</li>
            )}
            {universe.sig[k] && <li>الكنتور: {universe.sig[k]}</li>}
            <li>
              مواضع الالتفات: {arabicNumber(universe.sm[k])} · الاستنباطات: {arabicNumber(universe.dc[k])}
              {universe.dk[k] >= 0 && ` · أقواها: ${DISCOVERY_STYLE[universe.kinds[universe.dk[k]] as keyof typeof DISCOVERY_STYLE]?.label ?? universe.kinds[universe.dk[k]]}`}
            </li>
            <li className="text-muted-foreground">
              {arabicNumber(universe.w[k])} كلمة
              {flags & FLAG.SHORT ? ' · قصيرة (كان المرشّح القديم يُسقطها)' : ''}
              {flags & FLAG.LEGACY ? ' · من الألف الأصلية' : ''}
            </li>
          </ul>

          <div className="mt-3 text-[11px] text-muted-foreground">الروابط المحسوبة ({arabicNumber(legsHere.length)})</div>
          <ul className="mt-1 space-y-0.5 text-xs">
            {legsHere.slice(0, 24).map((l, i) => (
              <li key={i}>
                <button className="w-full rounded px-1 py-0.5 text-start hover:bg-white/5" onClick={() => select(l.to)}>
                  <span className="text-gold/90">{universe.surahs[universe.s[l.to] - 1].name} {arabicNumber(universe.a[l.to])}</span>
                  <span className="text-muted-foreground"> — {KIND_AR[l.kind]}: {l.evidence}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Link className="rounded-md border border-border px-2 py-1 hover:border-gold" href={`/studio?s=${universe.s[k]}&a=${universe.a[k]}`}>
              افتح في المرصد (الكلمات والإسناد)
            </Link>
            <button className="rounded-md border border-border px-2 py-1 hover:border-gold" onClick={() => setPanel('notes')}>
              <NotebookPen className="inline h-3 w-3" /> مذكّرة
            </button>
          </div>
        </aside>
      )}

      {/* ── voyage caption ──────────────────────────────────────────────── */}
      {voyage && currentLeg && lens === 'isnad' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[124px] z-10 flex justify-center px-3" aria-live="polite" data-testid="voyage-caption">
          <div className="rounded-lg bg-black/60 px-4 py-2 text-center text-sm backdrop-blur">
            <span className="text-gold">
              {universe.surahs[universe.s[currentLeg.to] - 1].name} {arabicNumber(universe.a[currentLeg.to])}
            </span>
            <span className="text-muted-foreground"> · {KIND_AR[currentLeg.kind]}{currentLeg.kind !== 'start' && currentLeg.kind !== 'tartib' ? `: ${currentLeg.evidence}` : ''}</span>
            <span className="ms-2 text-[10px] text-muted-foreground">
              {arabicNumber(leg)}/{arabicNumber(voyage.legs.length - 1)}
            </span>
          </div>
        </div>
      )}

      {/* ── scientific overlay ─────────────────────────────────────────── */}
      {overlay && tele && (
        <div className="pointer-events-auto absolute start-3 top-24 z-20 w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-border/70 bg-black/70 p-2 font-mono text-[10px] leading-4 text-sky-200/90 backdrop-blur" dir="ltr" data-testid="overlay">
          <div className="text-gold">scientific overlay — lens: {lens}</div>
          <div>space: {lens === 'isnad' ? universe.transform.id : 'equatorial RA/Dec, r=900'}</div>
          <div>world: {tele.world.map((x) => x.toFixed(3)).join(', ')}</div>
          <div>camera-rel: {tele.rel.map((x) => x.toFixed(3)).join(', ')}</div>
          <div>origin: {tele.origin.map((x) => x.toFixed(2)).join(', ')} · rebases {tele.rebases}</div>
          <div>|world| {Math.hypot(...tele.world).toFixed(2)} → f32 ulp {float32Ulp(Math.hypot(...tele.world)).toExponential(2)}</div>
          <div>near/far {tele.near}/{tele.far} · Δz@100 {depthResolution(100, tele.near, tele.far).toExponential(2)}</div>
          <div>fps {tele.fps.toFixed(0)} · frame {tele.frameMs.toFixed(1)} ms</div>
          <div>dpr {tele.dpr} · css {tele.css.join('×')} · buffer {tele.buffer.join('×')}</div>
          {lens === 'isnad' && tele.nearest >= 0 && (
            <div>
              nearest {universe.s[tele.nearest]}:{universe.a[tele.nearest]} @ {tele.nearestDist.toFixed(2)}u
            </div>
          )}
          {lens === 'isnad' && <div className="whitespace-pre-wrap">r: {universe.transform.radius}</div>}
          {voyage && <div>voyage {voyage.digest} t={tele.voyageT?.toFixed(2)}</div>}
          <div>data: universe.json sha256 {manifest?.sha256['universe.json'].slice(0, 12) ?? '—'}…</div>
          {tele.contextLost && <div className="text-red-400">WebGL context lost</div>}
        </div>
      )}

      {/* ── minimap ─────────────────────────────────────────────────────── */}
      {lens === 'isnad' && tele && (
        <div className="absolute bottom-[124px] start-3 z-10 hidden sm:block">
          <Minimap universe={universe} world={tele.world} focus={focus} onSurah={(first) => select(first)} />
        </div>
      )}

      {/* ── panels ──────────────────────────────────────────────────────── */}
      {panel !== 'none' && (
        <section className="pointer-events-auto absolute inset-x-3 bottom-20 z-30 mx-auto max-h-[60dvh] max-w-lg overflow-y-auto rounded-xl border border-border/70 bg-[#0b1120]/95 p-4 text-sm backdrop-blur" data-testid={`panel-${panel}`}>
          <button className="absolute end-3 top-3" aria-label="إغلاق" onClick={() => setPanel('none')}>
            <X className="h-4 w-4 text-muted-foreground" />
          </button>

          {panel === 'voyage' && (
            <div className="space-y-3">
              <h2 className="text-gold">الرحلة الآلية</h2>
              <p className="text-xs text-muted-foreground">
                المسار دالّةٌ ثابتة في البذرة: البذرة نفسها تعطي المسار نفسه، على كل جهاز. يسير على الروابط المحسوبة وحدها، وكلّ مرحلةٍ تذكر سببها.
              </p>
              <label className="block text-xs">
                البذرة
                <input
                  aria-label="البذرة"
                  className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1"
                  value={voyageCfg.seed}
                  onChange={(e) => setVoyageCfg({ ...voyageCfg, seed: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label>
                  المراحل {arabicNumber(voyageCfg.legs)}
                  <input type="range" min={1} max={60} value={voyageCfg.legs} onChange={(e) => setVoyageCfg({ ...voyageCfg, legs: +e.target.value })} className="w-full" />
                </label>
                <label>
                  المكث {voyageCfg.dwell}ث
                  <input type="range" min={1} max={15} step={0.5} value={voyageCfg.dwell} onChange={(e) => setVoyageCfg({ ...voyageCfg, dwell: +e.target.value })} className="w-full" />
                </label>
                {(['root', 'motif', 'discovery', 'tartib'] as const).map((kind) => (
                  <label key={kind}>
                    {KIND_AR[kind]} {voyageCfg.prefer[kind].toFixed(1)}
                    <input type="range" min={0} max={2} step={0.1} value={voyageCfg.prefer[kind]} onChange={(e) => setVoyageCfg({ ...voyageCfg, prefer: { ...voyageCfg.prefer, [kind]: +e.target.value } })} className="w-full" />
                  </label>
                ))}
                <label className="col-span-2">
                  البداية
                  <select
                    className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1"
                    value={voyageCfg.start === null ? 'seed' : 'focus'}
                    onChange={(e) => setVoyageCfg({ ...voyageCfg, start: e.target.value === 'focus' && focus !== null ? focus : null })}
                  >
                    <option value="seed">تختارها البذرة</option>
                    <option value="focus" disabled={focus === null}>الآية المحدّدة</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="flex items-center gap-1 rounded-md bg-gold px-3 py-1.5 text-black" onClick={() => startVoyage(voyageCfg)} data-testid="voyage-start">
                  <Play className="h-3.5 w-3.5" /> انطلق
                </button>
                {voyage && (
                  <>
                    <button className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5" onClick={() => { if (voyagePlaying) handle.current?.pauseVoyage(); else handle.current?.resumeVoyage(); setVoyagePlaying(!voyagePlaying); }}>
                      {voyagePlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {voyagePlaying ? 'أوقف' : 'تابع'}
                    </button>
                    <button className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5" onClick={() => { handle.current?.stopVoyage(); setVoyage(null); setVoyagePlaying(false); }}>
                      <Square className="h-3.5 w-3.5" /> أنهِ
                    </button>
                    <button
                      className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5"
                      onClick={() => {
                        const label = `${voyage.config.seed} · ${universe.surahs[universe.s[voyage.legs[leg].to] - 1].name} ${universe.a[voyage.legs[leg].to]}`;
                        const next = [...bookmarks, { code: encodeVoyageConfig(voyage.config), leg, label }].slice(-30);
                        setBookmarks(next);
                        store.set('isnaad.bookmarks', JSON.stringify(next));
                        setToast('حُفظت العلامة');
                      }}
                    >
                      <BookmarkPlus className="h-3.5 w-3.5" /> علامة
                    </button>
                  </>
                )}
              </div>
              {voyage && (
                <div className="rounded-md bg-black/30 p-2 font-mono text-[10px]" dir="ltr" data-testid="voyage-digest">
                  digest {voyage.digest} · {voyage.legs.length - 1} legs · {voyage.duration.toFixed(1)} s{voyage.truncated ? ' · truncated' : ''}
                  <br />
                  code {encodeVoyageConfig(voyage.config)}
                </div>
              )}
              {voyage && (
                <ol className="max-h-40 list-decimal overflow-y-auto ps-5 text-xs text-muted-foreground">
                  {voyage.legs.map((l, i) => (
                    <li key={i} className={cn(i === leg && 'text-gold')}>
                      {universe.surahs[universe.s[l.to] - 1].name} {arabicNumber(universe.a[l.to])} — {KIND_AR[l.kind]}
                      {l.kind !== 'start' && l.kind !== 'tartib' ? `: ${l.evidence}` : ''}
                    </li>
                  ))}
                </ol>
              )}
              {bookmarks.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground">العلامات</div>
                  <ul className="text-xs">
                    {bookmarks.map((b, i) => (
                      <li key={i}>
                        <button className="hover:text-gold" onClick={() => { const c = decodeVoyageConfig(b.code); if (c) { setVoyageCfg(c); startVoyage(c, b.leg); } }}>
                          {b.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {panel === 'flight' && (
            <div className="space-y-3 text-xs">
              <h2 className="text-sm text-gold">الطيران</h2>
              <div className="flex gap-2">
                {(['free', 'orbit'] as const).map((m) => (
                  <button key={m} className={cn('rounded-md border px-3 py-1', settings.mode === m ? 'border-gold text-gold' : 'border-border')} onClick={() => setSettings({ ...settings, mode: m })}>
                    {m === 'free' ? 'طيرانٌ حرّ' : 'مدارٌ حول الآية'}
                  </button>
                ))}
              </div>
              {(
                [
                  ['speed', 'السرعة', 2, 120, 1],
                  ['sensitivity', 'حساسية النظر', 0.2, 3, 0.1],
                  ['near', 'المستوى القريب', 0.01, 5, 0.01],
                  ['far', 'المستوى البعيد', 200, 20000, 100],
                  ['labels', 'عدد التسميات (LOD)', 0, 40, 1],
                  ['pointScale', 'حجم النقاط', 0.3, 3, 0.1],
                ] as const
              ).map(([key, label, min, max, step]) => (
                <label key={key} className="block">
                  {label}: {settings[key]}
                  <input type="range" min={min} max={max} step={step} value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: +e.target.value })} className="w-full" />
                </label>
              ))}
              {(
                [
                  ['reduceMotion', 'تقليل الحركة (بلا تسارع ولا انحناء)'],
                  ['collision', 'تجنّب الاصطدام بالآيات'],
                  ['invertY', 'عكس المحور العمودي'],
                  ['links', 'إظهار روابط الآية المحدّدة'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input type="checkbox" checked={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })} />
                  {label}
                </label>
              ))}
              <p className="text-muted-foreground">لوحة المفاتيح: W A S D / الأسهم، Q/E، Shift للسرعة، مسافة لإيقاف الرحلة، H للعودة، O للمؤشرات. اللمس: إصبعٌ للنظر، إصبعان للتقدّم. ذراع التحكّم: العصا اليسرى للحركة واليمنى للنظر.</p>
            </div>
          )}

          {panel === 'recorder' && (
            <div className="space-y-3 text-xs">
              <h2 className="text-sm text-gold">مسجّل الرحلة</h2>
              <p className="text-muted-foreground">يسجّل كلَّ إطار: موضع الكاميرا ودورانها، الآية المحدّدة، أبعاد اللوحة والمخزن، زمن الإطار، وأحداث السياق. يبقى على جهازك حتى تصدّره.</p>
              <div className="flex flex-wrap gap-2">
                <button className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5" onClick={() => snapshotRecording()}>
                  <Circle className="h-3.5 w-3.5 text-red-400" /> لقطة من السجل
                </button>
                <button className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5" onClick={() => { const r = snapshotRecording(); if (r) download(`isnaad-flight-${Date.now()}.json`, JSON.stringify(r)); }}>
                  <Download className="h-3.5 w-3.5" /> صدّر JSON
                </button>
                <label className="flex cursor-pointer items-center gap-1 rounded-md border border-border px-3 py-1.5">
                  <Upload className="h-3.5 w-3.5" /> أعِد تشغيل ملف
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const r = JSON.parse(await f.text()) as Recording;
                        if (!verifyRecording(r)) return setToast('الملف لا يطابق بصمته — لن يُعاد');
                        setRecording(r);
                        handle.current?.replay(r.frames);
                        setPanel('none');
                      } catch {
                        setToast('ملفٌ غير صالح');
                      }
                    }}
                  />
                </label>
                {recording && (
                  <button className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5" onClick={() => { handle.current?.replay(recording.frames); setPanel('none'); }}>
                    <Play className="h-3.5 w-3.5" /> أعِد الطيران
                  </button>
                )}
              </div>
              {recording && (
                <div className="rounded-md bg-black/30 p-2 font-mono text-[10px]" dir="ltr">
                  <div>
                    {recording.frames.length} frames · {recording.events.length} events · dropped {recording.dropped} · digest {recording.digest}
                  </div>
                  <div>
                    frame ms median {frameStats(recording.frames).median.toFixed(1)} · p95 {frameStats(recording.frames).p95.toFixed(1)} · device {recording.env.device}
                  </div>
                  <div>GPU {recording.env.gpu.renderer}</div>
                  <div className="mt-1 text-gold">diagnosis</div>
                  {diagnose(recording).map((f) => (
                    <div key={f.cls} className={f.supported ? 'text-red-300' : 'text-emerald-300/80'}>
                      {f.supported ? '✗' : '✓'} {f.cls}: {f.evidence}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {panel === 'notes' && (
            <div className="space-y-3 text-xs">
              <h2 className="text-sm text-gold">مذكّرات البحث</h2>
              {k !== null && (
                <div className="space-y-2">
                  <p className="font-quran text-base leading-9">{text?.k === k ? displayUthmani(text.text) : ''}</p>
                  <textarea
                    aria-label="مذكّرتك"
                    className="h-20 w-full rounded-md border border-border bg-transparent p-2"
                    placeholder="قراءتك — تُوسَم «قراءة» ولا تختلط بالاستنباط"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button
                    className="rounded-md bg-gold px-3 py-1.5 text-black"
                    onClick={() => {
                      const n: ResearchNote = {
                        id: `${Date.now()}`,
                        surah: universe.s[k],
                        ayah: universe.a[k],
                        text: text?.k === k ? text.text : '',
                        extracted: [
                          flags & FLAG.ATTRIBUTED
                            ? `الإسناد ${PERSON_AR.map((p, i) => `${p} ${Math.round(universe.v[k * 3 + i] * 100)}%`).join('، ')}؛ المسافة ${universe.d[k].toFixed(2)}`
                            : 'لا إسناد إلى شخص',
                          `الكنتور «${universe.sig[k]}»؛ الالتفات ${universe.sm[k]}؛ الاستنباطات ${universe.dc[k]}`,
                        ],
                        body: draft,
                        createdAt: new Date().toISOString(),
                      };
                      const next = [...notes, n];
                      setNotes(next);
                      store.set('isnaad.notes', JSON.stringify(next));
                      setDraft('');
                      setToast('حُفظت المذكّرة على هذا الجهاز');
                    }}
                  >
                    احفظ المذكّرة
                  </button>
                </div>
              )}
              <div className="text-muted-foreground">{arabicNumber(notes.length)} مذكّرة على هذا الجهاز</div>
              <div className="flex gap-2">
                <button className="rounded-md border border-border px-3 py-1.5" onClick={() => download(`isnaad-notes-${Date.now()}.md`, notesToMarkdown(notes), 'text/markdown')}>
                  صدّر Markdown
                </button>
                <button className="rounded-md border border-border px-3 py-1.5" onClick={() => download(`isnaad-notes-${Date.now()}.json`, JSON.stringify(notes, null, 2))}>
                  صدّر JSON
                </button>
              </div>
            </div>
          )}

          {panel === 'handoff' && (
            <div className="space-y-3 text-xs">
              <h2 className="text-sm text-gold">تسليمٌ إلى 7u</h2>
              <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 leading-6">{ACCESS_STATEMENT}</p>
              <p className="text-muted-foreground">
                يحمل التسليم: الآية المحدّدة، والعدسة، وموضع الكاميرا، ورمز الرحلة إن وُجدت، وملاحظتك. يُرمَّز في جزء الرابط بعد «#»، والمتصفح لا يرسل هذا الجزء إلى أي خادم. لا يعمل الرابط إلا عند من يستطيع فتح هذا الاستوديو.
              </p>
              <textarea aria-label="ملاحظة التسليم" className="h-16 w-full rounded-md border border-border bg-transparent p-2" placeholder="ملاحظة لـ 7u (اختيارية)" value={handoffNote} onChange={(e) => setHandoffNote(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <button className="flex items-center gap-1 rounded-md bg-gold px-3 py-1.5 text-black" onClick={() => makeLink()} data-testid="handoff-make">
                  <Share2 className="h-3.5 w-3.5" /> أنشئ الرابط
                </button>
                <button className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5" onClick={() => { const h = makeLink(); if (h) download(`isnaad-handoff-${Date.now()}.json`, JSON.stringify(h, null, 2)); }}>
                  <Download className="h-3.5 w-3.5" /> نزّل ملف التسليم
                </button>
                <button className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5" onClick={capture}>
                  <Camera className="h-3.5 w-3.5" /> لقطة لإرفاقها
                </button>
              </div>
              {handoffLink && (
                <div className="space-y-1">
                  <textarea readOnly dir="ltr" className="h-16 w-full rounded-md border border-border bg-black/30 p-2 font-mono text-[10px]" value={handoffLink} data-testid="handoff-link" />
                  <button className="rounded-md border border-border px-3 py-1" onClick={() => void navigator.clipboard?.writeText(handoffLink).then(() => setToast('نُسخ الرابط'))}>
                    انسخ
                  </button>
                  <p className="text-muted-foreground">النشر إلى PURL اختياري ويحتاج رمزًا تملكه أنت: انظر docs/studio/PURL.md. لا يُنشر شيءٌ تلقائيًا.</p>
                </div>
              )}
            </div>
          )}

          {panel === 'coverage' && (
            <div className="space-y-2 text-xs">
              <h2 className="text-sm text-gold">التغطية — أربعة أعداد لا تُجمع</h2>
              {counts ? (
                <table className="w-full" data-testid="coverage-table">
                  <tbody>
                    {(
                      [
                        ['آيات المصحف', counts.corpus],
                        ['حلّلها المحرّك', counts.analyzed],
                        ['فيها ظاهرةٌ مكتشفة (التفات أو استنباط)', counts.detected],
                        ['…منها باستنباط', counts.withDiscovery],
                        ['موضوعةٌ في الحقل', counts.placed],
                        ['بلا إسناد إلى شخص (على الحلقة الخارجية)', counts.unattributed],
                        ['أقلّ من ثلاث كلمات (أسقطها المرشّح القديم)', counts.short],
                        ['من الألف الأصلية', counts.legacyPreset],
                      ] as const
                    ).map(([label, n]) => (
                      <tr key={label} className="border-b border-border/40">
                        <td className="py-1">{label}</td>
                        <td className="py-1 text-end font-mono">{n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>—</p>
              )}
              {manifest && (
                <p className="text-muted-foreground">
                  الألف الأصلية أُعيد اشتقاقها من المحرّك نفسه: {manifest.legacy.reconstructed ? 'مطابقة تامة' : 'غير مطابقة'} ({arabicNumber(manifest.legacy.mismatches)} اختلاف).
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── incoming handoff ───────────────────────────────────────────── */}
      {incoming && (
        <div className="pointer-events-auto absolute inset-x-3 top-28 z-40 mx-auto max-w-md rounded-xl border border-gold/50 bg-[#0b1120]/95 p-4 text-sm" data-testid="incoming">
          <h2 className="text-gold">تسليمٌ من {incoming.from} إلى {incoming.to}</h2>
          {incoming.locus && (
            <p>
              الموضع: {universe.surahs[incoming.locus.surah - 1].name} {arabicNumber(incoming.locus.ayah)}
            </p>
          )}
          {incoming.note && <p className="mt-1 whitespace-pre-wrap text-foreground/90">«{incoming.note}»</p>}
          <p className="mt-2 text-[11px] text-muted-foreground">{incoming.access}</p>
          <div className="mt-3 flex gap-2">
            <button className="rounded-md bg-gold px-3 py-1.5 text-black" onClick={() => applyIncoming(incoming)}>
              اذهب إليه
            </button>
            <button className="rounded-md border border-border px-3 py-1.5" onClick={() => setIncoming(null)}>
              تجاهل
            </button>
          </div>
        </div>
      )}

      {tourStep !== null && <Tour step={tourStep} onStep={runStep} onClose={closeTour} />}

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-50 flex justify-center" role="status">
          <div className="rounded-md bg-black/80 px-4 py-2 text-sm">{toast}</div>
        </div>
      )}

      {/* ── dock: read · fly · keep ─────────────────────────────────────── */}
      <nav className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex justify-center p-3" aria-label="أدوات الاستوديو">
        <div className="flex max-w-full snap-x items-center gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-black/60 p-1.5 backdrop-blur [mask-image:linear-gradient(to_left,black_88%,transparent)] sm:[mask-image:none]">
          <DockButton icon={HelpCircle} label="الجولة" onClick={() => runStep(0)} />
          <DockButton icon={Gauge} label="التغطية" active={panel === 'coverage'} onClick={() => setPanel(panel === 'coverage' ? 'none' : 'coverage')} />
          <DockButton icon={NotebookPen} label="مذكّرات" active={panel === 'notes'} onClick={() => setPanel(panel === 'notes' ? 'none' : 'notes')} />
          <span className="mx-1 h-6 w-px bg-border" />
          <DockButton icon={Home} label="العودة" onClick={() => { handle.current?.home(); setFocus(null); }} />
          <DockButton icon={Route} label="رحلة" active={panel === 'voyage'} onClick={() => setPanel(panel === 'voyage' ? 'none' : 'voyage')} testId="dock-voyage" />
          {voyage && (
            <DockButton
              icon={voyagePlaying ? Pause : Play}
              label={voyagePlaying ? 'أوقف' : 'تابع'}
              onClick={() => { if (voyagePlaying) handle.current?.pauseVoyage(); else handle.current?.resumeVoyage(); setVoyagePlaying(!voyagePlaying); }}
            />
          )}
          <DockButton icon={Settings2} label="طيران" active={panel === 'flight'} onClick={() => setPanel(panel === 'flight' ? 'none' : 'flight')} />
          <DockButton icon={Compass} label="مؤشرات" active={overlay} onClick={() => setOverlay((v) => !v)} testId="dock-overlay" />
          <span className="mx-1 h-6 w-px bg-border" />
          <DockButton icon={Camera} label="لقطة" onClick={capture} />
          <DockButton icon={Video} label={videoOn ? 'أوقف' : 'فيديو'} active={videoOn} onClick={() => void toggleVideo()} />
          <DockButton icon={Circle} label="المسجّل" active={panel === 'recorder'} onClick={() => setPanel(panel === 'recorder' ? 'none' : 'recorder')} />
          <DockButton icon={Share2} label="تسليم" active={panel === 'handoff'} onClick={() => setPanel(panel === 'handoff' ? 'none' : 'handoff')} testId="dock-handoff" />
        </div>
      </nav>
    </div>
  );
}

function DockButton({
  icon: Icon,
  label,
  onClick,
  active,
  testId,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  active?: boolean;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'flex min-w-[3.25rem] shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] text-muted-foreground hover:text-foreground',
        active && 'bg-gold/15 text-gold',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
