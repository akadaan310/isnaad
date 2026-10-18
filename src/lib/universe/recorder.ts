// ============================================================================
//  مُسجِّل الرحلة — the flight recorder.
//
//  A bounded ring of frames (camera pose, selection, canvas geometry, timing)
//  plus an event log (resize, context loss, numeric exceptions, user actions),
//  plus a fixed environment record (device, GPU, renderer parameters). It is
//  pure data: no three.js, no DOM. The scene feeds it; tests feed it directly.
//
//  Two uses:
//    replay     poseAt(recording, t) interpolates the recorded camera, so a
//               recording can be flown again and compared frame for frame.
//    diagnosis  diagnose(recording) checks the recorded state against the
//               failure classes a rendering glitch can belong to, and says
//               which ones the evidence supports — or that none do.
// ============================================================================
import { digestOf } from './rng';

export interface CanvasGeometry {
  /** Host element size in CSS px — what the canvas should occupy. */
  hostW: number;
  hostH: number;
  /** Canvas element's laid-out size in CSS px. */
  cssW: number;
  cssH: number;
  /** Drawing buffer size in device px. */
  bufW: number;
  bufH: number;
  /** Pixel ratio the renderer was given. */
  dpr: number;
  /** window.devicePixelRatio, uncapped. */
  deviceDpr: number;
}

export interface Frame {
  t: number;
  /** Camera position, world units. */
  p: [number, number, number];
  /** Camera quaternion x,y,z,w. */
  q: [number, number, number, number];
  fov: number;
  near: number;
  far: number;
  /** Ordinal under focus, or −1. */
  locus: number;
  /** Milliseconds since the previous frame. */
  dt: number;
  /** Floating-origin offset in force, if any. */
  origin: [number, number, number];
}

export type RecorderEventKind =
  | 'start'
  | 'resize'
  | 'context-lost'
  | 'context-restored'
  | 'non-finite'
  | 'error'
  | 'select'
  | 'checkpoint'
  | 'lens'
  | 'voyage'
  | 'rebase'
  | 'note';

export interface RecorderEvent {
  t: number;
  kind: RecorderEventKind;
  detail: Record<string, unknown>;
}

export interface Environment {
  userAgent: string;
  platform: string;
  /** "real" only when the user says so; automated runs are "simulated". */
  device: 'real' | 'simulated' | 'unknown';
  viewport: [number, number];
  gpu: { vendor: string; renderer: string; webgl: string; maxTexture: number; highpFragment: boolean };
  renderer: Record<string, unknown>;
  geometry: Record<string, unknown>;
}

export interface Recording {
  format: 'isnaad-flight/1';
  startedAt: string;
  env: Environment;
  frames: Frame[];
  events: RecorderEvent[];
  canvas: CanvasGeometry[];
  /** Frames dropped from the ring because it was full. */
  dropped: number;
  digest?: string;
}

export class FlightRecorder {
  private frames: Frame[] = [];
  private events: RecorderEvent[] = [];
  private canvas: CanvasGeometry[] = [];
  private dropped = 0;
  constructor(
    private env: Environment,
    private capacity = 3600,
    private startedAt = new Date().toISOString(),
  ) {
    this.event(0, 'start', {});
  }

  frame(f: Frame) {
    const bad =
      !f.p.every(Number.isFinite) || !f.q.every(Number.isFinite) || !Number.isFinite(f.fov) || !(f.near > 0) || !(f.far > f.near);
    if (bad) this.event(f.t, 'non-finite', { p: f.p, q: f.q, fov: f.fov, near: f.near, far: f.far });
    this.frames.push(f);
    if (this.frames.length > this.capacity) {
      this.frames.shift();
      this.dropped++;
    }
  }

  event(t: number, kind: RecorderEventKind, detail: Record<string, unknown>) {
    this.events.push({ t, kind, detail });
    if (this.events.length > this.capacity) this.events.shift();
  }

  geometry(t: number, g: CanvasGeometry) {
    const last = this.canvas[this.canvas.length - 1];
    if (last && JSON.stringify(last) === JSON.stringify(g)) return;
    this.canvas.push(g);
    this.event(t, 'resize', { ...g });
  }

  get length() {
    return this.frames.length;
  }

  export(): Recording {
    const r: Recording = {
      format: 'isnaad-flight/1',
      startedAt: this.startedAt,
      env: this.env,
      frames: this.frames.slice(),
      events: this.events.slice(),
      canvas: this.canvas.slice(),
      dropped: this.dropped,
    };
    r.digest = digestOf({ ...r, digest: undefined });
    return r;
  }
}

/** Integrity check for a recording read back from a file. */
export function verifyRecording(r: Recording): boolean {
  return r.format === 'isnaad-flight/1' && r.digest === digestOf({ ...r, digest: undefined });
}

// ── replay ──────────────────────────────────────────────────────────────────

/** Recorded camera at time t: linear in position, normalised lerp in rotation. */
export function poseAt(frames: readonly Frame[], t: number): { p: [number, number, number]; q: [number, number, number, number] } | null {
  if (!frames.length) return null;
  if (t <= frames[0].t) return { p: frames[0].p, q: frames[0].q };
  const last = frames[frames.length - 1];
  if (t >= last.t) return { p: last.p, q: last.q };
  let lo = 0;
  let hi = frames.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = frames[lo];
  const b = frames[hi];
  const x = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
  const p: [number, number, number] = [
    a.p[0] + (b.p[0] - a.p[0]) * x,
    a.p[1] + (b.p[1] - a.p[1]) * x,
    a.p[2] + (b.p[2] - a.p[2]) * x,
  ];
  // Take the short way round.
  const dot = a.q[0] * b.q[0] + a.q[1] * b.q[1] + a.q[2] * b.q[2] + a.q[3] * b.q[3];
  const s = dot < 0 ? -1 : 1;
  const q = [0, 1, 2, 3].map((i) => a.q[i] + (b.q[i] * s - a.q[i]) * x) as [number, number, number, number];
  const ql = Math.hypot(...q) || 1;
  return { p, q: q.map((c) => c / ql) as [number, number, number, number] };
}

/** Largest positional disagreement between two recordings at the same times. */
export function replayError(reference: readonly Frame[], replay: readonly Frame[]): number {
  let worst = 0;
  for (const f of replay) {
    const r = poseAt(reference, f.t);
    if (!r) continue;
    worst = Math.max(worst, Math.hypot(f.p[0] - r.p[0], f.p[1] - r.p[1], f.p[2] - r.p[2]));
  }
  return worst;
}

// ── numeric precision ───────────────────────────────────────────────────────

/** Spacing of float32 values near |x| — the resolution a vertex shader has there. */
export function float32Ulp(x: number): number {
  const a = Math.abs(x);
  if (a === 0) return 2 ** -149;
  return 2 ** (Math.floor(Math.log2(a)) - 23);
}

/**
 * World-space depth resolution at distance z for a perspective projection with
 * an integer depth buffer of `bits` bits. Standard result: Δz ≈ z²·(f−n)/(f·n·2^bits).
 */
export function depthResolution(z: number, near: number, far: number, bits = 24): number {
  return (z * z * (far - near)) / (far * near * 2 ** bits);
}

// ── diagnosis ───────────────────────────────────────────────────────────────

export type GlitchClass = 'precision' | 'shader' | 'clipping' | 'buffer' | 'context-loss' | 'compositing' | 'device';

export interface Finding {
  cls: GlitchClass;
  supported: boolean;
  evidence: string;
}

/**
 * Check a recording against each failure class. Each test is a measurement
 * over recorded values; "supported: false" means the recording contains
 * evidence against the class (or no evidence for it), not that it is
 * impossible on other hardware.
 */
export function diagnose(r: Recording, opts: { shaderErrors?: string[] } = {}): Finding[] {
  const out: Finding[] = [];

  // compositing: the canvas element is not laid out at its host's size.
  const mis = r.canvas.filter((g) => Math.abs(g.cssW - g.hostW) > 1 || Math.abs(g.cssH - g.hostH) > 1);
  out.push({
    cls: 'compositing',
    supported: mis.length > 0,
    evidence: mis.length
      ? `canvas laid out at ${mis[0].cssW}×${mis[0].cssH} css px inside a ${mis[0].hostW}×${mis[0].hostH} host (dpr ${mis[0].dpr}); only ${(
          ((Math.min(mis[0].hostW, mis[0].cssW) * Math.min(mis[0].hostH, mis[0].cssH)) / (mis[0].cssW * mis[0].cssH)) *
          100
        ).toFixed(0)}% of the frame is on screen`
      : `canvas css size matched host in all ${r.canvas.length} geometry records`,
  });

  // buffer: drawing buffer not equal to the host's size × dpr. Measured
  // against the host, not the element, so a buffer that is right for the
  // screen is not blamed for an element that is laid out wrong.
  const buf = r.canvas.filter(
    (g) => Math.abs(g.bufW - Math.round(g.hostW * g.dpr)) > 1 || Math.abs(g.bufH - Math.round(g.hostH * g.dpr)) > 1,
  );
  out.push({
    cls: 'buffer',
    supported: buf.length > 0,
    evidence: buf.length
      ? `drawing buffer ${buf[0].bufW}×${buf[0].bufH} ≠ host ${buf[0].hostW}×${buf[0].hostH} × dpr ${buf[0].dpr}`
      : 'drawing buffer = host size × dpr in every record',
  });

  const lost = r.events.filter((e) => e.kind === 'context-lost');
  out.push({
    cls: 'context-loss',
    supported: lost.length > 0,
    evidence: lost.length ? `${lost.length} webglcontextlost event(s), first at t=${lost[0].t.toFixed(2)}s` : 'no webglcontextlost events',
  });

  const nonFinite = r.events.filter((e) => e.kind === 'non-finite');
  let worstUlp = 0;
  let worstMag = 0;
  for (const f of r.frames) {
    const m = Math.max(...f.p.map(Math.abs));
    if (m > worstMag) {
      worstMag = m;
      worstUlp = float32Ulp(m);
    }
  }
  out.push({
    cls: 'precision',
    supported: nonFinite.length > 0 || worstUlp > 1e-3,
    evidence: `${nonFinite.length} non-finite pose(s); largest |coordinate| ${worstMag.toFixed(1)} → float32 spacing ${worstUlp.toExponential(2)} units`,
  });

  const clipped = r.frames.filter((f) => f.near <= 0 || f.far / f.near > 1e6);
  out.push({
    cls: 'clipping',
    supported: clipped.length > 0,
    evidence: clipped.length
      ? `${clipped.length} frame(s) with far/near > 1e6 or near ≤ 0`
      : r.frames.length
        ? `far/near ${(r.frames[0].far / r.frames[0].near).toFixed(0)}; depth resolution at 900u ≈ ${depthResolution(900, r.frames[0].near, r.frames[0].far).toFixed(3)}u`
        : 'no frames',
  });

  const shaderErrors = opts.shaderErrors ?? r.events.filter((e) => e.kind === 'error').map((e) => String(e.detail.message ?? ''));
  out.push({
    cls: 'shader',
    supported: shaderErrors.some((m) => /shader|glsl|program/i.test(m)),
    evidence: shaderErrors.length ? shaderErrors.slice(0, 3).join(' | ') : 'no shader or program errors logged',
  });

  out.push({
    cls: 'device',
    supported: false,
    evidence: `recorded on ${r.env.device} device; GPU "${r.env.gpu.renderer}". A device-specific cause needs the same recording from real hardware.`,
  });
  return out;
}

/** Frame-time statistics, in milliseconds. */
export function frameStats(frames: readonly Frame[]) {
  const dts = frames.map((f) => f.dt).filter((x) => x > 0).sort((a, b) => a - b);
  if (!dts.length) return { n: 0, median: 0, p95: 0, max: 0, fps: 0 };
  const q = (p: number) => dts[Math.min(dts.length - 1, Math.floor(p * dts.length))];
  const median = q(0.5);
  return { n: dts.length, median, p95: q(0.95), max: dts[dts.length - 1], fps: 1000 / median };
}
