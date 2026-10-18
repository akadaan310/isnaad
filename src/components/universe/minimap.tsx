'use client';
// ============================================================================
//  الخريطة المصغّرة — where you are, in the two quantities that place you.
//
//  The universe has exactly two placement axes, so the minimap draws exactly
//  two: a muṣḥaf strip (direction = order; 114 bands, width ∝ āyāt) and a
//  proximity gauge (radius = discourse distance, with the unattributed shell
//  marked apart). A top-down projection would show a shape the data does not
//  carry; these show the coordinates themselves.
// ============================================================================
import * as React from 'react';
import type { UniversePayload } from '@/lib/universe/types';
import { distanceAtUniverseRadius, ordinalOfDirection } from '@/lib/universe/placement';

export function Minimap({
  universe,
  world,
  focus,
  onSurah,
}: {
  universe: UniversePayload;
  world: [number, number, number];
  focus: number | null;
  onSurah: (first: number) => void;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const r = Math.hypot(world[0], world[1], world[2]);
  const k = r > 1e-6 ? Math.max(0, Math.min(universe.count - 1, ordinalOfDirection(world[1] / r, universe.count))) : 0;
  const d = distanceAtUniverseRadius(r);

  React.useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    const g = c.getContext('2d');
    if (!g) return;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);
    // RTL: the muṣḥaf runs right to left along the strip.
    const x = (ord: number) => w - (ord / universe.count) * w;
    universe.surahs.forEach((s, i) => {
      g.fillStyle = i % 2 ? 'rgba(148,163,184,0.18)' : 'rgba(148,163,184,0.32)';
      g.fillRect(x(s.first + s.count), 0, x(s.first) - x(s.first + s.count), 10);
    });
    g.fillStyle = '#C8A45C';
    g.fillRect(x(k) - 1, 0, 2, 14);
    if (focus !== null) {
      g.fillStyle = '#F8FAFC';
      g.beginPath();
      g.arc(x(focus), 5, 3, 0, Math.PI * 2);
      g.fill();
    }
    // Proximity gauge: 0 (المخاطب, near) → 1 (الغائب, far), then the shell.
    const gy = 22;
    const gw = w * 0.8;
    g.fillStyle = 'rgba(148,163,184,0.25)';
    g.fillRect(w - gw, gy, gw, 4);
    g.fillStyle = 'rgba(100,116,139,0.6)';
    g.fillRect(0, gy, w * 0.12, 4);
    const pd = d < 0 ? null : Math.max(-0.1, Math.min(1.25, d));
    g.fillStyle = '#C8A45C';
    if (pd === null) g.fillRect(w * 0.06 - 1, gy - 3, 2, 10);
    else g.fillRect(w - pd * gw - 1, gy - 3, 2, 10);
  }, [universe, k, d, focus]);

  const s = universe.surahs.find((x) => k >= x.first && k < x.first + x.count);

  return (
    <div className="pointer-events-auto w-56 rounded-lg border border-border/60 bg-black/50 p-2 text-[10px] text-muted-foreground backdrop-blur">
      <canvas
        ref={ref}
        className="h-8 w-full cursor-pointer"
        aria-label="الخريطة المصغّرة: شريط المصحف ومقياس القرب"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ord = Math.floor(((rect.right - e.clientX) / rect.width) * universe.count);
          const hit = universe.surahs.find((x) => ord >= x.first && ord < x.first + x.count);
          if (hit) onSurah(hit.first);
        }}
      />
      <div className="mt-1 flex justify-between">
        <span>اتجاهك: {s ? `${s.name}` : '—'}</span>
        <span>{r < 1e-6 ? 'المركز' : d < 0 || r > 100 ? 'خارج المحور' : `قرب ${d.toFixed(2)}`}</span>
      </div>
    </div>
  );
}
