'use client';
// ============================================================================
//  الرِّحلة — the realm.
//
//  No menu, no panel, no button. The only DOM is the element the canvases
//  mount into; everything the traveller sees is drawn by WebGL, and everything
//  they read is painted into a 2D canvas over it because that is the one way
//  Uthmani keeps its joins (see lib/cosmos/textures.ts).
//
//  There is nothing to choose from because choosing is flying. Immersion bodies
//  stand in the world on a spatial hash — unbounded in number, fixed where they
//  are — and coming within reach of one adopts it: its zone's measured
//  starlight, its tempo, its reciter. Navigation is the whole interface.
//
//  Audio is optional and never asked for. Browsers refuse autoplay without a
//  gesture, so the first touch — which is also how the traveller steers — is
//  what unlocks it, along with fullscreen and the wake lock. Nothing is
//  demanded up front and nothing is blocked if it never comes.
// ============================================================================
import * as React from 'react';
import type { CosmosNode, CosmosPayload, SkyPayload } from '@/lib/cosmos';
import type { Strand } from '@/lib/cosmos/strands';
import { sunbulaStrands } from '@/lib/cosmos/strands';
import { unpackStrands, type PackedStrands } from '@/lib/cosmos/wire';
import {
  goFullscreen,
  holdWakeLock,
  readCapability,
  requestOrientation,
  type Capability,
} from '@/lib/cosmos/device';
import type { Astrophysics } from '@/lib/cosmos/stellar';
import {
  ZONES,
  measureZone,
  immersionAt,
  type Immersion,
  type ZoneLight,
} from '@/lib/cosmos/immersion';
import { type TempoId } from '@/lib/cosmos/recitation';
import { RihlaScene, type RihlaHandle } from './rihla-scene';
import { prefetchAyah, useRecitation } from './use-recitation';

export function Rihla() {
  const [payload, setPayload] = React.useState<CosmosPayload | null>(null);
  const [sky, setSky] = React.useState<SkyPayload | null>(null);
  const [wire, setWire] = React.useState<PackedStrands | null>(null);
  const [law, setLaw] = React.useState<Astrophysics | null>(null);
  const [cap, setCap] = React.useState<Capability | null>(null);
  const [at, setAt] = React.useState<number | null>(null);
  const [reason, setReason] = React.useState('مبتدأ الرحلة');
  const [legs, setLegs] = React.useState(0);
  const [immersion, setImmersion] = React.useState(0);

  const handle = React.useRef<RihlaHandle | null>(null);
  const wake = React.useRef<{ release: () => void } | null>(null);
  const engaged = React.useRef(false);

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
  const strands = React.useMemo<Strand[]>(
    () => (nodes.length ? [...sunbulaStrands(nodes), ...(wire ? unpackStrands(wire) : [])] : []),
    [nodes, wire],
  );

  // Six zones measured once: 6,000 stars generated per zone from the fitted
  // Gaia laws, then real photometry on them. Never recomputed while the law
  // holds, which is always.
  const lights = React.useMemo<ZoneLight[]>(
    () => (law ? ZONES.map((z) => measureZone(law, z)) : []),
    [law],
  );
  const pickImmersion = React.useMemo(
    () => (lights.length ? (i: number) => immersionAt(i, lights) : null),
    [lights],
  );

  const node: CosmosNode | null = at !== null ? nodes[at] ?? null : null;
  const advance = React.useCallback(() => handle.current?.advance(), []);
  const rec = useRecitation(node, advance);

  React.useEffect(() => {
    if (!node) return;
    for (const j of node.sb.slice(0, 2)) {
      const n = nodes[j];
      if (n) prefetchAyah(rec.reciter, n.s, n.a);
    }
  }, [node, nodes, rec.reciter]);

  const onArrive = React.useCallback((i: number, why: string) => {
    setAt(i);
    setReason(why);
    setLegs((n) => n + 1);
  }, []);

  // Coming within reach of a body adopts it. This is the only way an immersion
  // is ever chosen, and it is indistinguishable from travelling.
  const adopt = React.useCallback(
    (imm: Immersion) => {
      setImmersion(imm.index);
      rec.setTempo(imm.tempo.id as TempoId);
      rec.setReciter(imm.reciter);
    },
    [rec],
  );

  /** The first touch buys what browsers will only grant inside a gesture. */
  const engage = React.useCallback(() => {
    if (engaged.current) return;
    engaged.current = true;
    rec.unlock();
    rec.setEnabled(true);
    const host = document.getElementById('rihla-root');
    if (host) goFullscreen(host);
    void holdWakeLock().then((w) => (wake.current = w));
    if (cap?.orientation) void requestOrientation();
  }, [rec, cap]);

  React.useEffect(() => () => wake.current?.release(), []);

  // ── the hand ──────────────────────────────────────────────────────────────
  const touch = React.useRef({ id: -1, x: 0, y: 0, moved: 0, t0: 0, throttle: 0.55, pinch: 0 });

  const down = (e: React.PointerEvent) => {
    engage();
    if (touch.current.id !== -1) return;
    Object.assign(touch.current, {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: 0,
      t0: performance.now(),
    });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (e.pointerId !== touch.current.id) return;
    const dx = e.clientX - touch.current.x;
    const dy = e.clientY - touch.current.y;
    touch.current.moved += Math.abs(dx) + Math.abs(dy);
    handle.current?.steer(dx, dy);
    touch.current.x = e.clientX;
    touch.current.y = e.clientY;
  };
  const up = (e: React.PointerEvent) => {
    if (e.pointerId !== touch.current.id) return;
    if (performance.now() - touch.current.t0 < 260 && touch.current.moved < 12) {
      handle.current?.lockAhead();
    }
    touch.current.id = -1;
  };

  // Pinch is the throttle. Two fingers, and the span between them is the speed.
  React.useEffect(() => {
    const pts = new Map<number, { x: number; y: number }>();
    const span = () => {
      const [a, b] = [...pts.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const pd = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) touch.current.pinch = span();
    };
    const pm = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size !== 2 || !touch.current.pinch) return;
      handle.current?.throttle(
        Math.max(0, Math.min(1, touch.current.throttle * (span() / touch.current.pinch))),
      );
    };
    const pu = (e: PointerEvent) => {
      if (pts.size === 2 && touch.current.pinch) {
        touch.current.throttle = Math.max(
          0,
          Math.min(1, touch.current.throttle * (span() / touch.current.pinch)),
        );
      }
      pts.delete(e.pointerId);
      touch.current.pinch = 0;
    };
    window.addEventListener('pointerdown', pd);
    window.addEventListener('pointermove', pm);
    window.addEventListener('pointerup', pu);
    window.addEventListener('pointercancel', pu);
    return () => {
      window.removeEventListener('pointerdown', pd);
      window.removeEventListener('pointermove', pm);
      window.removeEventListener('pointerup', pu);
      window.removeEventListener('pointercancel', pu);
    };
  }, []);

  // Desktop courtesy: the wheel is the throttle, space takes the leg.
  React.useEffect(() => {
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      engage();
      touch.current.throttle = Math.max(
        0,
        Math.min(1, touch.current.throttle + (e.deltaY > 0 ? -0.06 : 0.06)),
      );
      handle.current?.throttle(touch.current.throttle);
    };
    const key = (e: KeyboardEvent) => {
      engage();
      if (e.code === 'Space') {
        e.preventDefault();
        handle.current?.advance();
      }
    };
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', key);
    };
  }, [engage]);

  return (
    <div
      id="rihla-root"
      className="fixed inset-0 overflow-hidden bg-[#05070c]"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      style={{ touchAction: 'none' }}
    >
      {cap && nodes.length > 0 && (
        <RihlaScene
          nodes={nodes}
          sky={sky}
          strands={strands}
          cap={cap}
          holding={rec.state.playing || rec.state.resting}
          onArrive={onArrive}
          onChooseImmersion={adopt}
          immersionAt={pickImmersion}
          activeImmersion={immersion}
          zoneHexes={lights.map((l) => l.keyHex)}
          handleRef={handle}
          hud={{ reason, legs, placed: nodes.length, corpus: 6236, orientation: false }}
        />
      )}
    </div>
  );
}
