'use client';
// ============================================================================
//  السماء — the ground the player stands on.
//
//  A slow star field with a سِراج at its centre whose reach follows the isnād
//  intensity, and a قَمَر مُنِير that only lights when the reflected pane is open.
//  Drawn on canvas rather than with hundreds of DOM nodes, because it runs
//  continuously underneath text that must stay perfectly still.
// ============================================================================
import * as React from 'react';

interface Star {
  x: number;
  y: number;
  r: number;
  /** Radians per frame, around the centre. */
  drift: number;
  phase: number;
  hue: string;
}

const HUES = ['#E8D7A8', '#FCD34D', '#7DD3FC', '#C084FC', '#FFFFFF'];

export function Sky({
  /** 0–1. Follows the سِراج control. */
  intensity,
  /** Whether the قمر منير is lit. */
  moon,
  /** Bumped on every station change, to pulse the field. */
  pulseKey,
}: {
  intensity: number;
  moon: boolean;
  pulseKey: number;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const stateRef = React.useRef({ intensity, moon, pulse: 0 });
  stateRef.current.intensity = intensity;
  stateRef.current.moon = moon;

  React.useEffect(() => {
    stateRef.current.pulse = 1;
  }, [pulseKey]);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stars: Star[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Density scales with area so a wide screen is not sparse.
      const count = Math.round(Math.min(260, (w * h) / 7000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.25,
        drift: (Math.random() - 0.5) * 0.00006,
        phase: Math.random() * Math.PI * 2,
        hue: HUES[Math.floor(Math.random() * HUES.length)],
      }));
    };

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let t = 0;
    const draw = () => {
      const s = stateRef.current;
      t += reduced ? 0 : 1;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h * 0.42;

      // السراج — the lamp, reaching as far as the isnād burn is turned up.
      const lampR = Math.max(w, h) * (0.28 + s.intensity * 0.4);
      const lamp = ctx.createRadialGradient(cx, cy, 0, cx, cy, lampR);
      lamp.addColorStop(0, `rgba(200,164,92,${0.05 + s.intensity * 0.09 + s.pulse * 0.05})`);
      lamp.addColorStop(0.5, `rgba(6,78,59,${0.05 + s.intensity * 0.05})`);
      lamp.addColorStop(1, 'rgba(15,23,42,0)');
      ctx.fillStyle = lamp;
      ctx.fillRect(0, 0, w, h);

      // القمر المنير — reflected light, only when the paired pane is open.
      if (s.moon) {
        const mx = w * 0.84;
        const my = h * 0.2;
        const moonGrad = ctx.createRadialGradient(mx, my, 0, mx, my, Math.max(w, h) * 0.22);
        moonGrad.addColorStop(0, 'rgba(226,232,240,0.13)');
        moonGrad.addColorStop(1, 'rgba(15,23,42,0)');
        ctx.fillStyle = moonGrad;
        ctx.fillRect(0, 0, w, h);
      }

      for (const st of stars) {
        // Rotate slowly about the lamp: the field turns, it does not scroll.
        const dx = st.x - cx;
        const dy = st.y - cy;
        const a = st.drift * (reduced ? 0 : 1);
        const nx = cx + dx * Math.cos(a) - dy * Math.sin(a);
        const ny = cy + dx * Math.sin(a) + dy * Math.cos(a);
        st.x = nx;
        st.y = ny;

        const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(st.phase + t * 0.004));
        ctx.globalAlpha = twinkle * (0.3 + s.intensity * 0.5) + s.pulse * 0.2;
        ctx.fillStyle = st.hue;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (s.pulse > 0) s.pulse = Math.max(0, s.pulse - 0.018);
      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
