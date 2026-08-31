'use client';
// ============================================================================
//  السماء — the real sky, and the camera that travels it.
//
//  Not decoration behind the text. This is the navigation surface: 5,044 stars
//  to magnitude six, the 89 IAU figures, and a camera that moves on its own.
//
//  The sky turns westward by itself at all times, the way it actually does.
//  When a station changes, the camera eases toward that station's constellation
//  rather than cutting to it, so the reader arrives somewhere instead of being
//  shown a new backdrop. Nothing here is scored, counted or won.
// ============================================================================
import * as React from 'react';

export interface SkyData {
  stars: [number, number, number][];
  named: { i: number; en: string; ar?: string; bayer?: string; con?: string }[];
  constellations: {
    id: string;
    ar: string;
    en: string;
    zodiac: boolean;
    centre: [number, number];
    lines: [number, number][][];
  }[];
}

const RAD = Math.PI / 180;

/** Shortest signed angular distance a→b in degrees, across the 0/360 seam. */
function deltaRa(a: number, b: number): number {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

interface Camera {
  ra: number;
  dec: number;
  /** Half-height of the view in degrees. Smaller is closer in. */
  fov: number;
}

export function Celestial({
  data,
  /** Constellation id to travel to. */
  target,
  /** 0–1, follows السراج: how bright the field burns. */
  intensity = 0.7,
  /** Draw the figure lines. */
  figures = true,
  /** Draw Arabic constellation names. */
  labels = true,
  /** Bumped to pulse the field on arrival. */
  pulseKey = 0,
  className,
}: {
  data: SkyData | null;
  target?: string | null;
  intensity?: number;
  figures?: boolean;
  labels?: boolean;
  pulseKey?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const cam = React.useRef<Camera>({ ra: 80, dec: 10, fov: 55 });
  const aim = React.useRef<Camera | null>(null);
  const pulse = React.useRef(0);
  const live = React.useRef({ data, intensity, figures, labels });
  live.current = { data, intensity, figures, labels };

  // Aim the camera whenever the destination changes.
  React.useEffect(() => {
    if (!data || !target) return;
    const c = data.constellations.find((x) => x.id === target);
    if (!c) return;
    aim.current = { ra: c.centre[0], dec: c.centre[1], fov: 42 };
    pulse.current = 1;
  }, [data, target]);

  React.useEffect(() => {
    pulse.current = 1;
  }, [pulseKey]);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, w * dpr);
      canvas.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const { data: d, intensity: burn, figures: figs, labels: labs } = live.current;
      ctx.clearRect(0, 0, w, h);
      if (!d) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const c = cam.current;

      // ── the camera moves, always ──────────────────────────────────────────
      if (!reduced) {
        // Sidereal drift: the sky turns westward whether or not anyone steers.
        c.ra = (c.ra + 0.004 + 360) % 360;
        if (aim.current) {
          const a = aim.current;
          // Ease, never cut. Arrival should be felt as arrival.
          c.ra = (c.ra + deltaRa(c.ra, a.ra) * 0.016 + 360) % 360;
          c.dec += (a.dec - c.dec) * 0.016;
          c.fov += (a.fov - c.fov) * 0.02;
        }
      }

      const scale = h / 2 / Math.tan((c.fov * RAD) / 2);
      const cosD0 = Math.cos(c.dec * RAD);
      const sinD0 = Math.sin(c.dec * RAD);

      /** Stereographic projection about the camera. null when behind. */
      const project = (ra: number, dec: number): [number, number] | null => {
        const dRa = (ra - c.ra) * RAD;
        const d = dec * RAD;
        const cosc = sinD0 * Math.sin(d) + cosD0 * Math.cos(d) * Math.cos(dRa);
        if (cosc < -0.2) return null;
        const k = 2 / (1 + cosc);
        const x = k * Math.cos(d) * Math.sin(dRa);
        const y = k * (cosD0 * Math.sin(d) - sinD0 * Math.cos(d) * Math.cos(dRa));
        return [w / 2 + x * scale * 0.5, h / 2 - y * scale * 0.5];
      };

      const glow = 0.35 + burn * 0.65 + pulse.current * 0.25;

      // ── figure lines ──────────────────────────────────────────────────────
      if (figs) {
        ctx.lineWidth = 1;
        for (const con of d.constellations) {
          const isTarget = con.id === target;
          ctx.strokeStyle = isTarget
            ? `rgba(200,164,92,${0.72 * glow})`
            : con.zodiac
              ? `rgba(200,164,92,${0.3 * glow})`
              : `rgba(125,211,252,${0.2 * glow})`;
          for (const seg of con.lines) {
            ctx.beginPath();
            let started = false;
            for (const [ra, dec] of seg) {
              const p = project(ra, dec);
              if (!p) {
                started = false;
                continue;
              }
              if (started) ctx.lineTo(p[0], p[1]);
              else {
                ctx.moveTo(p[0], p[1]);
                started = true;
              }
            }
            ctx.stroke();
          }
        }
      }

      // ── stars ─────────────────────────────────────────────────────────────
      for (const [ra, dec, mag] of d.stars) {
        const p = project(ra, dec);
        if (!p) continue;
        if (p[0] < -20 || p[0] > w + 20 || p[1] < -20 || p[1] > h + 20) continue;
        // Magnitude runs bright-to-faint downward: -1.4 is Sirius, 6 is the limit.
        const b = Math.max(0, (6.2 - mag) / 7.6);
        const r = 0.35 + b * b * 2.6;
        ctx.globalAlpha = Math.min(1, (0.18 + b * 1.15) * glow);
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
        ctx.fill();
        if (r > 1.9) {
          // A soft halo on the brightest, so they read as light not as dots.
          ctx.globalAlpha = Math.min(1, 0.13 * glow);
          ctx.beginPath();
          ctx.arc(p[0], p[1], r * 3.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // ── Arabic names ──────────────────────────────────────────────────────
      if (labs) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const con of d.constellations) {
          const p = project(con.centre[0], con.centre[1]);
          if (!p || p[0] < 40 || p[0] > w - 40 || p[1] < 24 || p[1] > h - 24) continue;
          const isTarget = con.id === target;
          ctx.font = `${isTarget ? 16 : 11}px var(--font-arabic), system-ui, sans-serif`;
          ctx.fillStyle = isTarget
            ? `rgba(232,215,168,${0.98 * glow})`
            : `rgba(148,163,184,${0.58 * glow})`;
          ctx.fillText(con.ar, p[0], p[1]);
        }

        // Named stars, only when close enough for the labels not to collide.
        if (c.fov < 50) {
          ctx.font = `10px var(--font-arabic), system-ui, sans-serif`;
          ctx.fillStyle = `rgba(252,211,77,${0.65 * glow})`;
          for (const n of d.named) {
            if (!n.ar) continue;
            const s = d.stars[n.i];
            if (!s) continue;
            const p = project(s[0], s[1]);
            if (!p || p[0] < 40 || p[0] > w - 40 || p[1] < 20 || p[1] > h - 20) continue;
            ctx.fillText(n.ar, p[0], p[1] - 9);
          }
        }
      }

      if (pulse.current > 0) pulse.current = Math.max(0, pulse.current - 0.012);
      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [target]);

  return <canvas ref={ref} aria-hidden className={className ?? 'absolute inset-0 h-full w-full'} />;
}

/** Load the sky once per page. */
export function useSky(): SkyData | null {
  const [data, setData] = React.useState<SkyData | null>(null);
  React.useEffect(() => {
    let live = true;
    void fetch('/api/sky')
      .then((r) => r.json())
      .then((d: SkyData) => live && setData(d))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return data;
}

/**
 * Which constellation a station is shown under.
 *
 * Movements walk البروج — the twelve zodiacal figures, which is what the word
 * names — in order, and stations inside a movement step through the figures
 * neighbouring it. So a composition traverses the sky rather than sitting in
 * front of a fixed backdrop, and the traversal is stable: the same station is
 * always under the same constellation.
 */
export function anchorFor(
  data: SkyData | null,
  movementIndex: number,
  stationIndex: number,
): string | null {
  if (!data?.constellations.length) return null;
  const zodiac = data.constellations.filter((c) => c.zodiac);
  if (!zodiac.length) return null;

  const burj = zodiac[movementIndex % zodiac.length];
  if (stationIndex === 0) return burj.id;

  // Step outward through the figures nearest this برج, by angular distance.
  const [ra0, dec0] = burj.centre;
  const near = [...data.constellations]
    .filter((c) => c.lines.length)
    .sort((a, b) => {
      const da = Math.hypot(deltaRa(ra0, a.centre[0]), a.centre[1] - dec0);
      const db = Math.hypot(deltaRa(ra0, b.centre[0]), b.centre[1] - dec0);
      return da - db;
    });
  return near[stationIndex % Math.min(near.length, 8)]?.id ?? burj.id;
}
