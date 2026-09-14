// ============================================================================
//  The cosmos payload — what the WebGL field and the flight board both read.
// ============================================================================
import type { ModalityId } from '../time-module';

export interface CosmosNode {
  /** Index into the node array; also its identity in the سنابل graph. */
  i: number;
  s: number;
  a: number;
  name: string;
  text: string;
  /** Position in isnād space: direction is the برج realm, radius is distance. */
  p: [number, number, number];
  /** Isnād vector — the share of attribution at each person. */
  v: [number, number, number];
  /** 0 = المناجاة … 1 = الغيبة. */
  d: number;
  sig: string;
  /** Counts per modality, in MODALITIES order. */
  tm: number[];
  /** Where it sits on before↔after, −1 … +1. */
  ax: number;
  /** How much it *does* with time. */
  tn: number;
  /** Strongest discovery kind at this locus, if any. */
  k: string | null;
  note: string | null;
  con: string;
  conAr: string;
  /** السنابل — the seven branches. */
  sb: number[];
}

export interface CosmosPayload {
  count: number;
  sanabil: number;
  modalities: { id: ModalityId; label: string; code: string; hue: string; axis: number; gloss: string }[];
  nodes: CosmosNode[];
}

export interface SkyPayload {
  stars: [number, number, number][];
  constellations: { id: string; ar: string; zodiac: boolean; centre: [number, number]; lines: [number, number][][] }[];
}
