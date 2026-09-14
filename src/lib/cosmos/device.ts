'use client';
// ============================================================================
//  قُدرةُ الجهاز — spend what the device actually has.
//
//  A phone is the primary target, and a phone is not a small desktop: it has a
//  thermal budget, a battery, and a screen whose device-pixel ratio will
//  happily ask for four times the fragments a laptop does. Every number here
//  is read from the device rather than guessed, and every one of them scales
//  something real.
// ============================================================================

export type Tier = 'low' | 'mid' | 'high';

export interface Capability {
  tier: Tier;
  touch: boolean;
  coarse: boolean;
  /** Device pixel ratio, capped — an uncapped 3× on a mid phone is a slideshow. */
  dpr: number;
  /** Stars drawn on the far shell. */
  stars: number;
  /** Strands drawn at once. */
  strandBudget: number;
  /** Samples along each strand curve. */
  curveSamples: number;
  /** Whether the device exposes an orientation sensor worth offering. */
  orientation: boolean;
  reducedMotion: boolean;
}

export function readCapability(): Capability {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const mem = (nav as unknown as { deviceMemory?: number })?.deviceMemory ?? 4;
  const cores = nav?.hardwareConcurrency ?? 4;
  const touch = typeof window !== 'undefined' && 'ontouchstart' in window;
  const coarse =
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  let tier: Tier = 'high';
  if (mem <= 2 || cores <= 4) tier = 'low';
  else if (mem <= 4 || cores <= 6) tier = 'mid';

  const raw = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const cap = tier === 'low' ? 1.5 : tier === 'mid' ? 2 : 2.5;

  return {
    tier,
    touch,
    coarse,
    dpr: Math.min(raw, cap),
    stars: tier === 'low' ? 1400 : tier === 'mid' ? 3000 : 5044,
    strandBudget: tier === 'low' ? 70 : tier === 'mid' ? 150 : 280,
    curveSamples: tier === 'low' ? 8 : tier === 'mid' ? 12 : 16,
    orientation:
      typeof window !== 'undefined' && typeof DeviceOrientationEvent !== 'undefined' && coarse,
    reducedMotion,
  };
}

/** iOS 13+ gates the orientation sensor behind an explicit grant. */
type OrientationCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export async function requestOrientation(): Promise<boolean> {
  if (typeof DeviceOrientationEvent === 'undefined') return false;
  const ctor = DeviceOrientationEvent as OrientationCtor;
  if (typeof ctor.requestPermission !== 'function') return true;
  try {
    return (await ctor.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/** Keep the screen awake while travelling. Released automatically on exit. */
export async function holdWakeLock(): Promise<{ release: () => void }> {
  const anyNav = navigator as unknown as {
    wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> };
  };
  try {
    const sentinel = await anyNav.wakeLock?.request('screen');
    return { release: () => void sentinel?.release().catch(() => undefined) };
  } catch {
    return { release: () => undefined };
  }
}

export function goFullscreen(el: HTMLElement) {
  const anyEl = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  void (anyEl.requestFullscreen?.({ navigationUI: 'hide' }) ??
    anyEl.webkitRequestFullscreen?.())?.catch?.(() => undefined);
}

/** A short pulse on arrival. Silently absent on iOS, which is fine. */
export function haptic(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // no-op
  }
}
