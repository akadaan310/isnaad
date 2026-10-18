// ============================================================================
//  مواضع الكون الكامل — where every āyah goes, and why.
//
//  Two components, each carrying one stated quantity:
//
//    radius     discourse distance, by exactly the affine map the legacy field
//               uses (RADIAL_BASE + d·RADIAL_SPAN), so inward still means toward
//               المخاطب and the two fields agree on that axis to the decimal.
//    direction  muṣḥaf order. A continuous spiral from the north pole (الفاتحة)
//               to the south pole (الناس), with equal area per āyah. Consecutive
//               āyāt are neighbours; a sūrah is a band; nothing is hashed.
//
//  Neither is astronomy. The star catalog lives in its own space (equatorial
//  RA/Dec at radius 900) and is drawn only by the celestial lens. Any picture
//  that shows both is a visual juxtaposition, and the transform record below
//  says so in the payload itself so that no screen can omit it.
//
//  One deliberate departure from the legacy field: an āyah with no person mass
//  is *not* given distance 0.5. distanceOf() returns 0.5 for zero mass, which
//  silently seats 352 āyāt on the المتكلم shell. Here they sit on a separate,
//  labelled shell outside the axis, and their distance is −1.
// ============================================================================
import { RADIAL_BASE, RADIAL_SPAN } from '../cosmos/placement';
import type { UniverseTransform } from './types';

/** Outside the axis (which ends at 18+78 = 96), with clear air between. */
export const UNATTRIBUTED_RADIUS = RADIAL_BASE + RADIAL_SPAN + 14;

/** Radial jitter amplitude. Zero: positions are a pure function of the data. */
export const UNIVERSE_JITTER = 0;

export function spiralConstant(n: number): number {
  return Math.sqrt(n * Math.PI);
}

/**
 * Unit direction for ordinal k of n on the equal-area spiral.
 * z runs 1 → −1 linearly in k (equal area per step, Archimedes' hat-box
 * theorem); azimuth winds with the polar angle so consecutive points touch.
 */
export function spiralDirection(k: number, n: number): [number, number, number] {
  const z = 1 - (2 * (k + 0.5)) / n;
  const theta = Math.acos(Math.max(-1, Math.min(1, z)));
  const phi = theta * spiralConstant(n);
  const s = Math.sin(theta);
  // y is up in three.js, so the spiral's pole axis is y.
  return [s * Math.cos(phi), z, s * Math.sin(phi)];
}

/** Discourse distance → radius, or the unattributed shell for d < 0. */
export function universeRadius(d: number): number {
  if (!(d >= 0)) return UNATTRIBUTED_RADIUS;
  return RADIAL_BASE + Math.min(1, d) * RADIAL_SPAN;
}

export function placeOrdinal(k: number, n: number, d: number): [number, number, number] {
  const u = spiralDirection(k, n);
  const r = universeRadius(d);
  return [u[0] * r, u[1] * r, u[2] * r];
}

/** Inverse of the radius map, for the overlay and the tests. */
export function distanceAtUniverseRadius(r: number): number {
  if (Math.abs(r - UNATTRIBUTED_RADIUS) < 1e-6) return -1;
  return (r - RADIAL_BASE) / RADIAL_SPAN;
}

/** Recover the ordinal from a direction: z is linear in k. */
export function ordinalOfDirection(y: number, n: number): number {
  return Math.round(((1 - y) * n) / 2 - 0.5) + 0;
}

export function universeTransform(n: number): UniverseTransform {
  return {
    id: 'mushaf-spiral/discourse-radius',
    direction:
      'ordinal k in muṣḥaf order → equal-area spherical spiral: y = 1 − 2(k+½)/N, azimuth = acos(y)·√(Nπ)',
    radius: `r = ${RADIAL_BASE} + d·${RADIAL_SPAN} for discourse distance d ∈ [0,1]; r = ${UNATTRIBUTED_RADIUS} when the āyah has no person mass`,
    radialBase: RADIAL_BASE,
    radialSpan: RADIAL_SPAN,
    unattributedRadius: UNATTRIBUTED_RADIUS,
    spiralTurns: spiralConstant(n),
    disclaimer:
      'ترميزٌ بصريّ: الاتجاه ترتيبُ المصحف، ونصف القطر مسافةُ الخطاب. ليس موقعًا فلكيًّا، ولا يدلّ على صلةٍ فيزيائية بالنجوم.',
  };
}
