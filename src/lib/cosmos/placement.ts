// ============================================================================
//  المواضع — the geometry of placement.
//
//  Only one component of a node's position currently carries meaning: the
//  radius. It is discourse distance, mapped linearly, so flying inward *is*
//  moving toward المخاطب. Direction is, at present, the برج realm plus a
//  deterministic scatter — a label, not a computation (see `basis.ts` for the
//  derived alternative and the comparison it is held to).
//
//  These constants were inlined in scripts/ingest-cosmos.ts. They live here
//  because three places now have to agree on them: the ingest that writes
//  positions, the renderer that reads them, and رِباط — whose signed movement
//  along the proximity axis is a displacement along this exact radial scale.
// ============================================================================

/** Radius of المناجاة — distance 0, the nearest a discourse can stand. */
export const RADIAL_BASE = 18;
/** Radius added across the full proximity axis, 0 → 1. */
export const RADIAL_SPAN = 78;
/** Deterministic jitter so co-distant āyāt do not land on one shell. */
export const RADIAL_JITTER = 6;
/** Scatter about a constellation centre, in degrees of RA and Dec. */
export const REALM_SCATTER_RA = 26;
export const REALM_SCATTER_DEC = 22;

export type Vec3 = [number, number, number];

/** Discourse distance → radius. The inverse of `distanceAtRadius`. */
export function radiusOf(distance: number, jitter = 0): number {
  return RADIAL_BASE + distance * RADIAL_SPAN + jitter * RADIAL_JITTER;
}

/** Radius → discourse distance, ignoring jitter. */
export function distanceAtRadius(r: number): number {
  return (r - RADIAL_BASE) / RADIAL_SPAN;
}

export const lengthOf = (p: Vec3): number => Math.hypot(p[0], p[1], p[2]);

/**
 * The point on a node's own ray at a given discourse distance.
 *
 * This is the primitive the رِباط displacement is built from. Radius *is* the
 * proximity axis, so a person's position on that axis has an exact radius, and
 * a movement between two persons is an exact radial segment along whichever
 * ray the āyah sits on. Outward is ابتعادًا, inward is اقترابًا.
 *
 * Note what this deliberately does *not* do: add `حركة المحور` to the node's
 * own `d`. A node's distance is the āyah's aggregate over all its attributions;
 * the detector's delta is measured between two single person positions. Adding
 * them puts 238 of 282 رِباط displacements outside the axis entirely, which a
 * clamp would have quietly concealed.
 */
export function pointAtDistance(p: Vec3, distance: number): Vec3 {
  const r = lengthOf(p);
  if (!r) return [...p] as Vec3;
  const k = radiusOf(distance) / r;
  return [p[0] * k, p[1] * k, p[2] * k];
}
