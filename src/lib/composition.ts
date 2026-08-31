// ============================================================================
//  التأليف — compositions, their movements, and the assembler that packs one.
//
//  A composition is not a playlist of āyāt. It is a sequence of بُرُوج, each
//  built around one عَلَم, and each برج is packed so that a marker occurrence is
//  followed immediately by whatever the isnād engine found at that same locus.
//  That alternation — here is the construct, here is what the tongue does with
//  it — is what gives a برج its pace.
//
//  Nothing here is stored pre-rendered. A composition holds loci and framing;
//  the text, the words and the isnād come from the corpus at watch time, which
//  is what makes the player a فُرْقان rather than a recording.
// ============================================================================

export interface Station {
  surah: number;
  ayah: number;
  /** Word range to burn, as indices into the sūrah's word stream. */
  focus?: { from: number; to: number };
  /** The exact word where the attribution turns, if this station has one. */
  seam?: number;
  /** Arabic framing line shown beneath the āyah. */
  caption?: string;
  /** What put this station here. */
  source?: 'alam' | 'discovery' | 'associated' | 'manual';
  /** The discovery this station carries, when it carries one. */
  discoveryKind?: string;
  /** Seconds to dwell before the فَلَك advances. */
  dwell?: number;
}

/** A بُرْج — one movement of the composition. */
export interface Movement {
  id: string;
  title: string;
  /** The عَلَم this movement is built around, when it is built around one. */
  alam?: string;
  /** The lesson: what this برج is showing. */
  note?: string;
  stations: Station[];
}

export interface Composition {
  id: string;
  title: string;
  subtitle?: string;
  author?: string;
  /** Arabic. Shown on the gallery card and above the player. */
  intent?: string;
  movements: Movement[];
  /** Only published compositions appear in the gallery. */
  published: boolean;
  /** Default seconds per station; a station may override it. */
  dwell: number;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_DWELL = 9;

export function emptyComposition(id: string): Composition {
  const now = new Date().toISOString();
  return {
    id,
    title: 'تأليفٌ جديد',
    movements: [],
    published: false,
    dwell: DEFAULT_DWELL,
    createdAt: now,
    updatedAt: now,
  };
}

export function stationCount(c: Composition): number {
  return c.movements.reduce((n, m) => n + m.stations.length, 0);
}

/** Every station in reading order, tagged with the برج it belongs to. */
export function flatten(c: Composition): { station: Station; movement: Movement; mi: number; si: number }[] {
  const out: { station: Station; movement: Movement; mi: number; si: number }[] = [];
  c.movements.forEach((movement, mi) =>
    movement.stations.forEach((station, si) => out.push({ station, movement, mi, si })),
  );
  return out;
}

/** A short, stable, URL-safe id. */
export function newId(prefix = 'c'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}${rand}`;
}
