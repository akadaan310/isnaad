'use client';
// ============================================================================
//  الحروف على القماش — Arabic into WebGL, without breaking the joins.
//
//  A glyph atlas cannot render Uthmani. This project already shipped that bug
//  once: كَهْفِهِمْ came out as كَ فِهِ because the marks and the joins are decided
//  by the shaper, not by the codepoints. Any approach that positions glyphs
//  itself will reproduce it.
//
//  Canvas2D `fillText` runs the browser's own shaping engine — HarfBuzz on
//  Chrome and Firefox, CoreText on Safari — so text drawn there is shaped
//  exactly as the DOM would shape it. Uploading that canvas as a texture is
//  therefore the one way to put the muṣḥaf inside a WebGL scene and still be
//  reading the muṣḥaf.
//
//  The cost is that a plate is a bitmap: it must be redrawn when its content
//  changes, and on a phone that is expensive. Nothing here redraws on a frame
//  clock; callers redraw on change.
// ============================================================================
import * as THREE from 'three';

export const QURAN_FONT = '"Amiri Quran", serif';
export const UI_FONT = '"Noto Kufi Arabic", system-ui, sans-serif';

/**
 * The faces must be resident before the first draw. A canvas that draws with a
 * fallback bakes the fallback into a texture, and unlike the DOM it will never
 * reflow once the real face arrives.
 */
export async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`64px ${QURAN_FONT}`, 'بسم'),
      document.fonts.load(`24px ${UI_FONT}`, 'بسم'),
      document.fonts.load(`600 24px ${UI_FONT}`, 'بسم'),
    ]);
    await document.fonts.ready;
  } catch {
    // A refused font query is survivable; a missing canvas is not.
  }
}

/** A 2D canvas and the texture that mirrors it. */
export class Plate {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;
  /** CSS pixels, not device pixels — all drawing is done in these units. */
  width: number;
  height: number;
  private dpr: number;

  constructor(width: number, height: number, dpr = 2) {
    this.canvas = document.createElement('canvas');
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    const ctx = this.canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.ctx.scale(dpr, dpr);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    // A plate is drawn once per change and sampled from every frame; without
    // this three re-uploads it on every render.
    this.texture.generateMipmaps = false;
  }

  resize(width: number, height: number, dpr = this.dpr) {
    if (width === this.width && height === this.height && dpr === this.dpr) return;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  commit() {
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }
}

export interface WrapLine {
  text: string;
  width: number;
}

/**
 * Break Arabic text to a width, measuring with the shaper rather than counting
 * characters. Words are never split: a Uthmani word broken mid-join loses the
 * connection and lands its marks on the wrong base.
 */
export function wrapArabic(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 6,
): WrapLine[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: WrapLine[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
      continue;
    }
    lines.push({ text: current, width: ctx.measureText(current).width });
    current = word;
    if (lines.length === maxLines - 1) break;
  }
  if (current && lines.length < maxLines) {
    lines.push({ text: current, width: ctx.measureText(current).width });
  }
  return lines;
}

/** Right-to-left drawing state, set once per text block. */
export function setRtl(ctx: CanvasRenderingContext2D) {
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}
