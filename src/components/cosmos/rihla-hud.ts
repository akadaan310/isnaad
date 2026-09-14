'use client';
// ============================================================================
//  اللوح — the head-up display, drawn as pixels rather than as elements.
//
//  The immersive mode has no DOM chrome, so everything the traveller reads is
//  painted here and sampled by an orthographic quad. Arabic is drawn with
//  Canvas2D `fillText`, which runs the browser's shaper, so the joins and the
//  Uthmani marks survive the trip into WebGL — a glyph atlas would not.
//
//  It is redrawn on change, never on the frame clock: a phone cannot afford a
//  full-plate upload sixty times a second, and none of this content moves.
// ============================================================================
import type { CosmosNode } from '@/lib/cosmos';
import type { Immersion } from '@/lib/cosmos/immersion';
import { arabicDecimal, arabicNumber } from '@/lib/utils';
import { MODALITIES } from '@/lib/time-module';
import { Plate, QURAN_FONT, UI_FONT, roundRect, setRtl, wrapArabic } from '@/lib/cosmos/textures';

const GOLD = '#C8A45C';
const DIM = 'rgba(148,163,184,0.85)';
const FAINT = 'rgba(148,163,184,0.5)';
const PERSON = ['#D97706', '#059669', '#0284C7'];

export interface HudState {
  node: CosmosNode | null;
  /** Why the journey arrived here — the engine's own account of the last leg. */
  reason: string;
  /** Legs travelled so far. The walk has no end; this is only how far in. */
  legs: number;
  /** 0…1 of the throttle range. */
  throttle: number;
  /** How far the next āyah is, in field units. */
  distance: number;
  /** Nodes placed, and āyāt in the muṣḥaf — the absence, kept visible. */
  placed: number;
  corpus: number;
  /** Seconds since the last arrival, for the flash. */
  sinceArrival: number;
  orientation: boolean;
  /** Retained so callers need not change; the realm has no modes. */
  choosing?: boolean;
  /** Whichever body lies under the reticle. */
  aimed?: Immersion | null;
  /** How far that body is, in field units. */
  aimedDistance?: number;
  /** 0 outside every body, 1 at the centre of one. */
  inside?: number;
}

export function drawHud(plate: Plate, s: HudState) {
  const { ctx, width: W, height: H } = plate;
  plate.clear();
  const pad = Math.max(14, Math.min(26, W * 0.045));
  const narrow = W < 560;

  // ── reticle: where the hand is pointing ──────────────────────────────────
  const cx = W / 2;
  const cy = H * 0.46;
  const r = narrow ? 15 : 20;
  ctx.strokeStyle = `rgba(200,164,92,${0.22 + s.throttle * 0.3})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r * 1.9, cy);
  ctx.lineTo(cx - r * 1.25, cy);
  ctx.moveTo(cx + r * 1.25, cy);
  ctx.lineTo(cx + r * 1.9, cy);
  ctx.stroke();

  // ── approach bar: the leg being flown ────────────────────────────────────
  if (s.node) {
    const near = Math.max(0, Math.min(1, 1 - s.distance / 90));
    ctx.strokeStyle = 'rgba(200,164,92,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, -Math.PI / 2, -Math.PI / 2 + near * Math.PI * 2);
    ctx.stroke();
  }

  // ── arrival flash ────────────────────────────────────────────────────────
  if (s.sinceArrival < 0.9) {
    const k = 1 - s.sinceArrival / 0.9;
    ctx.strokeStyle = `rgba(200,164,92,${k * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 10 + (1 - k) * 70, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ── the body being looked at, named quietly beneath the āyah ────────────
  if (s.aimed && (s.aimedDistance ?? Infinity) < 1600) {
    const a = s.aimed;
    const near = (s.aimedDistance ?? 0) < 145;

    // A body can now fill the sky, and unbacked text over its grid is
    // unreadable. A soft band, only as tall as the block it carries.
    const bandTop = H * 0.29 - (narrow ? 40 : 46);
    const bandH = narrow ? 82 : 96;
    const band = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandH);
    band.addColorStop(0, 'rgba(5,7,12,0)');
    band.addColorStop(0.4, 'rgba(5,7,12,0.7)');
    band.addColorStop(0.75, 'rgba(5,7,12,0.62)');
    band.addColorStop(1, 'rgba(5,7,12,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, bandTop, W, bandH);

    setRtl(ctx);
    ctx.textAlign = 'center';
    ctx.font = `400 ${narrow ? 15 : 18}px ${UI_FONT}`;
    ctx.fillStyle = near ? a.palette.hexes[0] : `${a.palette.hexes[0]}88`;
    ctx.fillText(a.zone.ar, cx, H * 0.29);

    ctx.font = `400 ${narrow ? 10 : 11}px ${UI_FONT}`;
    ctx.fillStyle = FAINT;
    ctx.fillText(
      near ? `${a.zone.en} · ${a.tempo.latin} · ${a.reciter.latin}` : a.zone.en,
      cx,
      H * 0.29 + (narrow ? 17 : 20),
    );

    // The measurement the colour came from, and whether the fitted law was
    // being interpolated there or carried past its range.
    ctx.direction = 'ltr';
    ctx.font = `400 ${narrow ? 9 : 10}px ${UI_FONT}`;
    ctx.fillStyle = a.zone.basis === 'extrapolated' ? 'rgba(252,165,165,0.6)' : 'rgba(100,116,139,0.75)';
    // Truncate on a word, never mid-word: "Far outsi ·" is a typo, not a
    // shortening. The plate's own width is the measure.
    const tail = ` · ${a.zone.basis}`;
    let gloss = a.zone.enGloss;
    if (ctx.measureText(gloss + tail).width > W - pad * 2) {
      let acc = '';
      for (const word of gloss.split(' ')) {
        if (ctx.measureText(`${acc} ${word}…${tail}`).width > W - pad * 2) break;
        acc = acc ? `${acc} ${word}` : word;
      }
      gloss = `${acc}…`;
    }
    ctx.fillText(gloss + tail, cx, H * 0.29 + (narrow ? 33 : 38));
    ctx.direction = 'rtl';
  }

  if (!s.node) {
    ctx.font = `400 ${narrow ? 15 : 18}px ${UI_FONT}`;
    ctx.fillStyle = DIM;
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';
    ctx.fillText('يُبنى الكون…', cx, cy + 70);
    plate.commit();
    return;
  }

  const n = s.node;

  // ── top strip: where you are ─────────────────────────────────────────────
  setRtl(ctx);
  let y = pad + (narrow ? 16 : 20);
  ctx.font = `400 ${narrow ? 21 : 26}px ${QURAN_FONT}`;
  ctx.fillStyle = GOLD;
  ctx.fillText(`${n.name} · ${arabicNumber(n.a)}`, W - pad, y);

  ctx.font = `400 ${narrow ? 12 : 14}px ${UI_FONT}`;
  ctx.fillStyle = FAINT;
  y += narrow ? 17 : 20;
  const codes = MODALITIES.filter((_, k) => n.tm[k] > 0).map((m) => m.code).join(' ');
  ctx.fillText(`${n.conAr} · ${n.sig || '—'}${codes ? ` · ${codes}` : ''}`, W - pad, y);

  // ── why the journey came here ────────────────────────────────────────────
  y += narrow ? 19 : 22;
  ctx.font = `400 ${narrow ? 12 : 14}px ${UI_FONT}`;
  ctx.fillStyle = 'rgba(167,139,250,0.9)';
  ctx.fillText(s.reason, W - pad, y);

  // ── the āyah, bottom, wrapped by the shaper ──────────────────────────────
  const size = narrow ? 20 : 26;
  ctx.font = `400 ${size}px ${QURAN_FONT}`;
  const lineH = size * 2.05;
  const maxLines = narrow ? 5 : 4;
  const lines = wrapArabic(ctx, n.text, W - pad * 2, maxLines);
  const blockH = lines.length * lineH;
  const barH = narrow ? 44 : 50;
  const bottom = H - pad;
  const top = bottom - barH - blockH - 14;

  // A ground behind the text: over a bright starfield, unbacked Uthmani is
  // unreadable, and readability is not a place to economise.
  const g = ctx.createLinearGradient(0, top - 24, 0, H);
  g.addColorStop(0, 'rgba(10,16,24,0)');
  g.addColorStop(0.35, 'rgba(10,16,24,0.82)');
  g.addColorStop(1, 'rgba(10,16,24,0.94)');
  ctx.fillStyle = g;
  ctx.fillRect(0, top - 24, W, H - top + 24);

  ctx.fillStyle = 'rgba(226,232,240,0.95)';
  ctx.font = `400 ${size}px ${QURAN_FONT}`;
  setRtl(ctx);
  lines.forEach((ln, i) => {
    ctx.fillText(ln.text, W - pad, top + (i + 1) * lineH - lineH * 0.32);
  });

  // ── isnād vector: the mix, not the argmax ────────────────────────────────
  const mass = n.v[0] + n.v[1] + n.v[2];
  const barY = bottom - barH + 6;
  // The thumb control sits bottom-left; the bar and the counts keep clear of it
  // rather than running underneath.
  const thumbClear = 62;
  const barW = W - pad * 2 - thumbClear;
  if (mass > 0) {
    let x = W - pad;
    ctx.globalAlpha = 0.95;
    for (let p = 0; p < 3; p++) {
      const w = (n.v[p] / mass) * barW;
      if (w <= 0) continue;
      ctx.fillStyle = PERSON[p];
      roundRect(ctx, x - w, barY, w, 4, 2);
      ctx.fill();
      x -= w;
    }
    ctx.globalAlpha = 1;

    ctx.font = `400 ${narrow ? 11 : 12}px ${UI_FONT}`;
    setRtl(ctx);
    let tx = W - pad;
    for (let p = 0; p < 3; p++) {
      const label = arabicDecimal(n.v[p] / mass, 2);
      ctx.fillStyle = n.v[p] > 0 ? PERSON[p] : 'rgba(100,116,139,0.5)';
      ctx.fillText(label, tx, barY + 20);
      tx -= ctx.measureText(label).width + 12;
    }
  }

  // ── the absence, and how far in ──────────────────────────────────────────
  ctx.font = `400 ${narrow ? 10 : 11}px ${UI_FONT}`;
  ctx.fillStyle = 'rgba(100,116,139,0.75)';
  ctx.textAlign = 'left';
  ctx.direction = 'rtl';
  ctx.fillText(
    `${arabicNumber(s.placed)}/${arabicNumber(s.corpus)} آية · ` +
      `${arabicNumber(s.legs)} منزلًا · ${arabicNumber(Math.round(s.throttle * 100))}٪`,
    pad + thumbClear,
    barY + 20,
  );

  plate.commit();
}
