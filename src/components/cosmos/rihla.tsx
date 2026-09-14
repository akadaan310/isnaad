'use client';
// ============================================================================
//  الرِّحلة — the vessel.
//
//  Canvas to the edges. The one piece of DOM that is not the canvas is the
//  gate: fullscreen, the motion sensor and the wake lock cannot be asked for
//  outside a real user gesture on a real element, and autoplay cannot be
//  unlocked without one either. It appears once and is gone.
//
//  The recitation is the clock. An āyah is held while it is recited, the
//  silence after it belongs to the tempo, and the vessel moves when the
//  reciter does — so تَرْتِيل is a slow flight and حَدْر an unbroken one.
// ============================================================================
import * as React from 'react';
import type { CosmosNode, CosmosPayload, SkyPayload } from '@/lib/cosmos';
import type { Strand } from '@/lib/cosmos/strands';
import { sunbulaStrands } from '@/lib/cosmos/strands';
import { unpackStrands, type PackedStrands } from '@/lib/cosmos/wire';
import {
  goFullscreen,
  haptic,
  holdWakeLock,
  readCapability,
  requestOrientation,
  type Capability,
} from '@/lib/cosmos/device';
import { type TempoId } from '@/lib/cosmos/recitation';
import type { Astrophysics } from '@/lib/cosmos/stellar';
import { ZONES, measureZone, immersionAt, type Immersion, type ZoneLight } from '@/lib/cosmos/immersion';
import { RihlaScene, type RihlaHandle } from './rihla-scene';
import { prefetchAyah, useRecitation } from './use-recitation';

export function Rihla() {
  const [payload, setPayload] = React.useState<CosmosPayload | null>(null);
  const [sky, setSky] = React.useState<SkyPayload | null>(null);
  const [wire, setWire] = React.useState<PackedStrands | null>(null);
  const [cap, setCap] = React.useState<Capability | null>(null);
  const [gated, setGated] = React.useState(true);
  const [at, setAt] = React.useState<number | null>(null);
  const [reason, setReason] = React.useState('مبتدأ الرحلة');
  const [legs, setLegs] = React.useState(0);
  const [gyro, setGyro] = React.useState(false);
  const [panel, setPanel] = React.useState(false);
  const [law, setLaw] = React.useState<Astrophysics | null>(null);
  const [immersion, setImmersion] = React.useState(0);

  const handle = React.useRef<RihlaHandle | null>(null);
  const wake = React.useRef<{ release: () => void } | null>(null);

  React.useEffect(() => setCap(readCapability()), []);

  React.useEffect(() => {
    let alive = true;
    void Promise.all([
      fetch('/api/cosmos').then((r) => r.json()),
      fetch('/api/sky').then((r) => r.json()),
      fetch('/api/cosmos/strands').then((r) => r.json()),
      fetch('/api/sky/astrophysics').then((r) => r.json()),
    ]).then(([c, s, w, a]) => {
      if (!alive) return;
      if (!c.error) setPayload(c);
      if (!s.error) setSky(s);
      if (!w.error) setWire(w);
      if (!a.error) setLaw(a);
    });
    return () => {
      alive = false;
    };
  }, []);

  const nodes = React.useMemo(() => payload?.nodes ?? [], [payload]);
  const strands = React.useMemo<Strand[]>(() => {
    if (!nodes.length) return [];
    return [...sunbulaStrands(nodes), ...(wire ? unpackStrands(wire) : [])];
  }, [nodes, wire]);

  // Measuring a zone generates 6,000 stars and does real photometry on them.
  // Six zones, once, and never again while the law is unchanged.
  const lights = React.useMemo<ZoneLight[]>(
    () => (law ? ZONES.map((z) => measureZone(law, z)) : []),
    [law],
  );
  const current = React.useMemo<Immersion | null>(
    () => (lights.length ? immersionAt(immersion, lights) : null),
    [lights, immersion],
  );
  // Handed to the scene so the bodies can be generated for any index at all —
  // the sequence has no end to fetch and no page to load.
  const pickImmersion = React.useMemo(
    () => (lights.length ? (i: number) => immersionAt(i, lights) : null),
    [lights],
  );

  const node: CosmosNode | null = at !== null ? nodes[at] ?? null : null;

  const advance = React.useCallback(() => handle.current?.advance(), []);
  const rec = useRecitation(node, advance);

  // Warm the next āyah's audio while this one is still sounding.
  React.useEffect(() => {
    if (!node) return;
    for (const j of node.sb.slice(0, 2)) {
      const n = nodes[j];
      if (n) prefetchAyah(rec.reciter, n.s, n.a);
    }
  }, [node, nodes, rec.reciter]);

  const choose = React.useCallback(
    (imm: Immersion) => {
      setImmersion(imm.index);
      rec.setTempo(imm.tempo.id as TempoId);
      rec.setReciter(imm.reciter);
      setPanel(false);
    },
    [rec],
  );

  const onArrive = React.useCallback((i: number, why: string) => {
    setAt(i);
    setReason(why);
    setLegs((n) => n + 1);
  }, []);

  // ── the gate ──────────────────────────────────────────────────────────────
  const enter = React.useCallback(async () => {
    rec.unlock();
    haptic([12, 40, 12]);
    const host = document.getElementById('rihla-root');
    if (host) goFullscreen(host);
    wake.current = await holdWakeLock();
    if (cap?.orientation) setGyro(await requestOrientation());
    setGated(false);
  }, [rec, cap]);

  React.useEffect(() => () => wake.current?.release(), []);

  // ── the gyroscope, when granted ───────────────────────────────────────────
  React.useEffect(() => {
    if (!gyro) return;
    let last: { b: number; g: number } | null = null;
    const on = (e: DeviceOrientationEvent) => {
      const b = e.beta ?? 0;
      const g = e.gamma ?? 0;
      if (last) handle.current?.steer((g - last.g) * 7, (b - last.b) * 7);
      last = { b, g };
    };
    window.addEventListener('deviceorientation', on);
    return () => window.removeEventListener('deviceorientation', on);
  }, [gyro]);

  // ── touch: drag steers, pinch throttles, tap locks on ─────────────────────
  const touch = React.useRef({
    id: -1, x: 0, y: 0, moved: 0, pinch: 0, throttle: 0.55, t0: 0,
  });

  const onPointerDown = (e: React.PointerEvent) => {
    if (touch.current.id !== -1) return;
    touch.current.id = e.pointerId;
    touch.current.x = e.clientX;
    touch.current.y = e.clientY;
    touch.current.moved = 0;
    touch.current.t0 = performance.now();
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerId !== touch.current.id) return;
    const dx = e.clientX - touch.current.x;
    const dy = e.clientY - touch.current.y;
    touch.current.moved += Math.abs(dx) + Math.abs(dy);
    handle.current?.steer(dx, dy);
    touch.current.x = e.clientX;
    touch.current.y = e.clientY;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerId !== touch.current.id) return;
    const quick = performance.now() - touch.current.t0 < 260;
    if (quick && touch.current.moved < 12) {
      handle.current?.lockAhead();
      haptic(8);
    }
    touch.current.id = -1;
  };

  // Pinch: the span between two fingers is the throttle.
  React.useEffect(() => {
    const pts = new Map<number, { x: number; y: number }>();
    const span = () => {
      const [a, b] = [...pts.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) touch.current.pinch = span();
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size !== 2 || !touch.current.pinch) return;
      const ratio = span() / touch.current.pinch;
      const next = Math.max(0, Math.min(1, touch.current.throttle * ratio));
      handle.current?.throttle(next);
    };
    const up = (e: PointerEvent) => {
      if (pts.size === 2) {
        const ratio = touch.current.pinch ? span() / touch.current.pinch : 1;
        touch.current.throttle = Math.max(0, Math.min(1, touch.current.throttle * ratio));
      }
      pts.delete(e.pointerId);
      touch.current.pinch = 0;
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  // Desktop courtesy: wheel throttles, space takes the leg.
  React.useEffect(() => {
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      touch.current.throttle = Math.max(
        0,
        Math.min(1, touch.current.throttle + (e.deltaY > 0 ? -0.06 : 0.06)),
      );
      handle.current?.throttle(touch.current.throttle);
    };
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handle.current?.advance();
      }
      if (e.key === 'f') handle.current?.lockAhead();
    };
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', key);
    };
  }, []);

  const ready = !!cap && nodes.length > 0;

  return (
    <div
      id="rihla-root"
      className="fixed inset-0 overflow-hidden bg-[#05070c] text-foreground"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ touchAction: 'none' }}
    >
      {ready && (
        <RihlaScene
          nodes={nodes}
          sky={sky}
          strands={strands}
          cap={cap!}
          holding={rec.state.playing || rec.state.resting}
          onArrive={onArrive}
          onChooseImmersion={choose}
          immersionAt={pickImmersion}
          activeImmersion={immersion}
          handleRef={handle}
          hud={{
            reason,
            legs,
            placed: nodes.length,
            corpus: 6236,
            orientation: gyro,
          }}
        />
      )}

      {/* ── the gate: one gesture, then gone ── */}
      {gated && (
        <button
          onClick={enter}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-[#05070c]/95 px-8 text-center backdrop-blur-sm"
        >
          <span className="quran text-[2.1rem] leading-[1.7] text-gold">وَالسَّمَاءِ ذَاتِ الْبُرُوجِ</span>
          <span className="max-w-xs text-[0.78rem] leading-relaxed text-muted-foreground">
            {ready
              ? 'أَلفُ آيةٍ في فضاء الإسناد. اسحب لتُوجّه، واقرِص للسرعة، والنقرُ يُثبِّت الوِجهة.'
              : 'يُبنى الكون…'}
          </span>
          <span className="rounded-full border border-gold/45 px-6 py-2 text-[0.82rem] text-gold">
            {ready ? 'ادخُل' : '…'}
          </span>
          <span className="max-w-xs text-[0.6rem] leading-relaxed text-muted-foreground/60">
            التلاوةُ تسجيلٌ لقارئٍ مُسمّى، لا استنباطَ محرّك.
          </span>
        </button>
      )}

      {/* ── the one control surface, reachable by thumb ── */}
      {!gated && (
        <>
          <button
            onClick={() => {
              const next = !panel;
              setPanel(next);
              handle.current?.setChoosing(next);
              haptic(12);
            }}
            aria-label="المُسمِع"
            className="absolute bottom-5 left-5 z-20 flex h-12 w-12 items-center justify-center rounded-full border bg-black/45 backdrop-blur-md"
            style={{ borderColor: current ? `${current.palette.hexes[0]}70` : '#C8A45C59' }}
          >
            <span
              className="quran text-[1.05rem]"
              style={{ color: current?.tempo.hue ?? '#C8A45C' }}
            >
              {current?.tempo.name.slice(0, 1) ?? 'ت'}
            </span>
          </button>

          {/* what is in force, and why the recitation sounds as it does */}
          {current && !panel && (
            <div className="pointer-events-none absolute bottom-6 left-20 right-4 z-20 text-left">
              <p className="text-[0.52rem] leading-snug text-muted-foreground/55">
                <span style={{ color: current.palette.hexes[0] }}>{current.zone.en}</span>
                {' · '}
                {current.tempo.latin}
                {' · '}
                {current.reciter.latin}
              </p>
              {rec.state.blocked && (
                <p className="text-[0.52rem] text-[#FCA5A5]">
                  المِسْ الشاشةَ لتبدأ التلاوة · tap once to allow audio
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
