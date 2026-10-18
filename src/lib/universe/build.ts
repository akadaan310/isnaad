// ============================================================================
//  Building the full-universe payload from per-āyah rows. Pure: the ingest
//  script reads files and runs the engine; this decides nothing but layout.
// ============================================================================
import { FLAG, UNIVERSE_VERSION, type UniverseCoverage, type UniversePayload } from './types';
import { placeOrdinal, universeTransform } from './placement';

export interface AyahRow {
  s: number;
  a: number;
  name: string;
  /** Person shares p1,p2,p3. */
  v: [number, number, number];
  /** distanceOf(v) as the engine reports it (0.5 for zero mass). */
  d: number;
  sig: string;
  words: number;
  discoveries: number;
  /** Strongest discovery kind at the āyah, or null. */
  kind: string | null;
  seams: number;
  marked: boolean;
  /** Index in the legacy preset, or −1. */
  legacy: number;
  analyzed: boolean;
}

export function buildUniverse(rows: readonly AyahRow[]): UniversePayload {
  const n = rows.length;
  const kinds: string[] = [];
  const kindIdx = (k: string | null) => {
    if (!k) return -1;
    let i = kinds.indexOf(k);
    if (i < 0) i = kinds.push(k) - 1;
    return i;
  };

  const out: UniversePayload = {
    version: UNIVERSE_VERSION,
    count: n,
    transform: universeTransform(n),
    surahs: [],
    s: [], a: [], p: [], d: [], v: [], sig: [], w: [], dc: [], dk: [], sm: [], f: [], legacy: [],
    kinds,
  };

  rows.forEach((r, k) => {
    const mass = r.v[0] + r.v[1] + r.v[2];
    const attributed = mass > 0;
    // The engine's 0.5 for zero mass is a default, not a measurement.
    const d = attributed ? r.d : -1;
    const p = placeOrdinal(k, n, d);

    const last = out.surahs[out.surahs.length - 1];
    if (!last || last.id !== r.s) out.surahs.push({ id: r.s, name: r.name, first: k, count: 1 });
    else last.count++;

    let f = 0;
    if (attributed) f |= FLAG.ATTRIBUTED;
    if (r.discoveries > 0) f |= FLAG.DISCOVERY;
    if (r.seams > 0) f |= FLAG.SEAM;
    if (r.legacy >= 0) f |= FLAG.LEGACY;
    if (r.words < 3) f |= FLAG.SHORT;
    if (r.marked) f |= FLAG.MARKED;

    out.s.push(r.s);
    out.a.push(r.a);
    out.p.push(+p[0].toFixed(3), +p[1].toFixed(3), +p[2].toFixed(3));
    out.d.push(+d.toFixed(4));
    out.v.push(+r.v[0].toFixed(3), +r.v[1].toFixed(3), +r.v[2].toFixed(3));
    out.sig.push(r.sig);
    out.w.push(r.words);
    out.dc.push(r.discoveries);
    out.dk.push(kindIdx(r.kind));
    out.sm.push(r.seams);
    out.f.push(f);
    out.legacy.push(r.legacy);
  });
  return out;
}

export function measureUniverse(u: UniversePayload, analyzed = u.count): UniverseCoverage {
  let detected = 0;
  let withDiscovery = 0;
  let placed = 0;
  let unattributed = 0;
  let short = 0;
  let legacyPreset = 0;
  for (let k = 0; k < u.count; k++) {
    const f = u.f[k];
    if (f & (FLAG.DISCOVERY | FLAG.SEAM)) detected++;
    if (f & FLAG.DISCOVERY) withDiscovery++;
    if (Number.isFinite(u.p[k * 3]) && Number.isFinite(u.p[k * 3 + 1]) && Number.isFinite(u.p[k * 3 + 2])) placed++;
    if (!(f & FLAG.ATTRIBUTED)) unattributed++;
    if (f & FLAG.SHORT) short++;
    if (f & FLAG.LEGACY) legacyPreset++;
  }
  return {
    corpus: u.count,
    analyzed,
    detected,
    withDiscovery,
    placed,
    unattributed,
    short,
    legacyPreset,
    surahs: u.surahs.length,
  };
}

/** Locus → ordinal, by arithmetic over the surah table. */
export function ordinalOf(u: Pick<UniversePayload, 'surahs'>, surah: number, ayah: number): number | undefined {
  const s = u.surahs[surah - 1];
  if (!s || s.id !== surah || !Number.isInteger(ayah) || ayah < 1 || ayah > s.count) return undefined;
  return s.first + ayah - 1;
}
