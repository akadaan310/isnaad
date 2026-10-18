// ============================================================================
//  الرحلة الآلية — a seeded, replayable guided flight over the full universe.
//
//  A voyage is a pure function of (universe, relations, config). Give it the
//  same seed and the same data and it returns the same legs, the same reasons,
//  and the same camera samples, byte for byte — which is what makes a route
//  something you can name, send, bookmark and replay.
//
//  The route walks relations the engine computed (root, motif, discovery) and
//  muṣḥaf order. Each leg carries its reason verbatim. Nothing here estimates
//  or implies anything astronomical: the space is the universe transform in
//  placement.ts, and the camera only moves through it.
// ============================================================================
import { digestOf, rngFrom, weightedIndex } from './rng';
import type { Leg } from './relations';
import type { UniverseLinkKind } from './types';

export interface VoyageConfig {
  seed: string;
  /** Starting ordinal, or null to let the seed choose among attributed āyāt. */
  start: number | null;
  legs: number;
  /** Relative preference per family. Zero excludes a family entirely. */
  prefer: Record<UniverseLinkKind, number>;
  /** Seconds the camera holds at each āyah. */
  dwell: number;
  /** Seconds per leg of travel. */
  travel: number;
  /** How many recent stops are penalised, so the route does not double back. */
  memory: number;
}

export const DEFAULT_VOYAGE_CONFIG: VoyageConfig = {
  seed: 'الفاتحة',
  start: null,
  legs: 12,
  prefer: { tartib: 0.35, root: 1, motif: 0.8, discovery: 1.2 },
  dwell: 4,
  travel: 3.5,
  memory: 16,
};

export interface VoyageLeg {
  from: number;
  to: number;
  kind: UniverseLinkKind | 'start';
  evidence: string;
  /** Seconds from voyage start at which the camera arrives. */
  arriveAt: number;
}

export interface Voyage {
  config: VoyageConfig;
  legs: VoyageLeg[];
  duration: number;
  /** Digest of (config, legs). Equal digests mean equal routes. */
  digest: string;
  /** True when the walk ran out of unvisited relations and stopped early. */
  truncated: boolean;
}

export function planVoyage(
  n: number,
  adjacency: readonly (readonly Leg[])[],
  eligibleStart: (k: number) => boolean,
  config: VoyageConfig = DEFAULT_VOYAGE_CONFIG,
): Voyage {
  const rnd = rngFrom(`voyage|${config.seed}`);

  let start = config.start;
  if (start === null || start < 0 || start >= n) {
    // Draw until an eligible āyah comes up; bounded so a pathological filter
    // falls back to ordinal 0 instead of spinning.
    start = 0;
    for (let t = 0; t < 10000; t++) {
      const k = Math.floor(rnd() * n);
      if (eligibleStart(k)) {
        start = k;
        break;
      }
    }
  }

  const legs: VoyageLeg[] = [{ from: start, to: start, kind: 'start', evidence: 'مبتدأ الرحلة', arriveAt: 0 }];
  const recent: number[] = [start];
  let at = start;
  let clock = config.dwell;
  let truncated = false;

  for (let step = 0; step < config.legs; step++) {
    const options = adjacency[at] ?? [];
    const memory = new Set(recent.slice(-config.memory));
    const weights = options.map((l) => {
      const pref = config.prefer[l.kind] ?? 0;
      if (pref <= 0) return 0;
      const fresh = memory.has(l.to) ? 0.04 : 1;
      return pref * (0.25 + l.weight) * fresh;
    });
    const i = weightedIndex(weights, rnd());
    if (i < 0) {
      truncated = true;
      break;
    }
    const leg = options[i];
    clock += config.travel;
    legs.push({ from: at, to: leg.to, kind: leg.kind, evidence: leg.evidence, arriveAt: +clock.toFixed(3) });
    clock += config.dwell;
    at = leg.to;
    recent.push(at);
  }

  const duration = +clock.toFixed(3);
  return { config, legs, duration, digest: digestOf({ config, legs }), truncated };
}

// ── the camera along a voyage ───────────────────────────────────────────────

export interface CameraSample {
  t: number;
  /** Position. */
  p: [number, number, number];
  /** Look-at target. */
  look: [number, number, number];
  /** Leg index the sample belongs to. */
  leg: number;
  /** True while holding at an āyah. */
  dwelling: boolean;
}

/** Ease that starts and ends at rest — the motion-reduction mode skips it. */
const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

/**
 * Stand-off point for viewing an āyah: back along its own ray and slightly
 * above, so the āyah is in front of the camera and its sūrah band behind it.
 */
export function standoff(p: readonly number[], distance = 9): [number, number, number] {
  const r = Math.hypot(p[0], p[1], p[2]) || 1;
  const k = (r - distance) / r;
  return [p[0] * k, p[1] * k + distance * 0.25, p[2] * k];
}

/**
 * Camera pose at time t. Deterministic, allocation-light, and continuous: the
 * position and target are both C¹ across a dwell/travel boundary.
 */
export function cameraAt(
  voyage: Voyage,
  positions: ArrayLike<number>,
  t: number,
  reduceMotion = false,
): CameraSample {
  const pos = (k: number): [number, number, number] => [positions[k * 3], positions[k * 3 + 1], positions[k * 3 + 2]];
  const { legs, config } = voyage;
  const T = Math.max(0, Math.min(voyage.duration, t));

  // Find the leg whose travel window or dwell window holds T.
  for (let i = 1; i < legs.length; i++) {
    const arrive = legs[i].arriveAt;
    const depart = arrive - config.travel;
    if (T < depart) {
      const p = pos(legs[i - 1].to);
      return { t: T, p: standoff(p), look: p, leg: i - 1, dwelling: true };
    }
    if (T < arrive) {
      const x = (T - depart) / config.travel;
      const e = reduceMotion ? x : smoother(x);
      const a = pos(legs[i].from);
      const b = pos(legs[i].to);
      const sa = standoff(a);
      const sb = standoff(b);
      // Lift the path off the chord in proportion to its length, so a long leg
      // reads as travel rather than a cut; zero lift when motion is reduced.
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const lift = reduceMotion ? 0 : Math.sin(Math.PI * e) * Math.min(18, len * 0.18);
      const mid = [(sa[0] + sb[0]) / 2, (sa[1] + sb[1]) / 2, (sa[2] + sb[2]) / 2];
      const ml = Math.hypot(mid[0], mid[1], mid[2]) || 1;
      const p: [number, number, number] = [
        sa[0] + (sb[0] - sa[0]) * e - (mid[0] / ml) * lift,
        sa[1] + (sb[1] - sa[1]) * e - (mid[1] / ml) * lift,
        sa[2] + (sb[2] - sa[2]) * e - (mid[2] / ml) * lift,
      ];
      const look: [number, number, number] = [
        a[0] + (b[0] - a[0]) * e,
        a[1] + (b[1] - a[1]) * e,
        a[2] + (b[2] - a[2]) * e,
      ];
      return { t: T, p, look, leg: i, dwelling: false };
    }
  }
  const last = legs[legs.length - 1];
  const p = pos(last.to);
  return { t: T, p: standoff(p), look: p, leg: legs.length - 1, dwelling: true };
}

/** Sample a voyage at a fixed rate. The digest of this is the replay check. */
export function sampleVoyage(voyage: Voyage, positions: ArrayLike<number>, hz = 10, reduceMotion = false) {
  const out: CameraSample[] = [];
  const steps = Math.floor(voyage.duration * hz);
  for (let s = 0; s <= steps; s++) out.push(cameraAt(voyage, positions, s / hz, reduceMotion));
  return out;
}

// ── route codes ─────────────────────────────────────────────────────────────

/** A voyage is fully specified by its config; this is what gets shared. */
export function encodeVoyageConfig(c: VoyageConfig): string {
  const p = c.prefer;
  return [
    'v1',
    // encodeURIComponent leaves '~' alone, and '~' is the field separator.
    encodeURIComponent(c.seed).replace(/~/g, '%7E'),
    c.start ?? '',
    c.legs,
    [p.tartib, p.root, p.motif, p.discovery].join(','),
    c.dwell,
    c.travel,
    c.memory,
  ].join('~');
}

export function decodeVoyageConfig(code: string): VoyageConfig | null {
  const parts = code.split('~');
  if (parts[0] !== 'v1' || parts.length !== 8) return null;
  const num = (x: string, lo: number, hi: number) => {
    const v = Number(x);
    return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : NaN;
  };
  const pref = parts[4].split(',').map((x) => num(x, 0, 10));
  const cfg: VoyageConfig = {
    seed: decodeURIComponent(parts[1]).slice(0, 200),
    start: parts[2] === '' ? null : Math.trunc(num(parts[2], 0, 1e6)),
    legs: Math.trunc(num(parts[3], 1, 500)),
    prefer: { tartib: pref[0], root: pref[1], motif: pref[2], discovery: pref[3] },
    dwell: num(parts[5], 0.5, 120),
    travel: num(parts[6], 0.5, 120),
    memory: Math.trunc(num(parts[7], 0, 500)),
  };
  const nums = [cfg.legs, cfg.dwell, cfg.travel, cfg.memory, ...pref, cfg.start ?? 0];
  if (pref.length !== 4 || nums.some((x) => Number.isNaN(x))) return null;
  return cfg;
}
