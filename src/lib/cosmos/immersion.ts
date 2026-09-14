// ============================================================================
//  المنازل — the structural zones, and an unbounded menu over them.
//
//  The Galaxy is not uniform, and the fitted law says so: n(z) ∝ exp(−|z|/h_z)
//  with h_z = 121 pc measured from 300,000 Gaia parallaxes at r² = 0.977. A
//  zone is a region of that structure, and its light is not a chosen palette —
//  it is the integrated flux and mean colour of the population the measured law
//  puts there, run through Planck and the CIE functions.
//
//  Scale-height factors above about 3 leave the 50–600 pc range the law was
//  fitted over. Those zones are extrapolations of a measured law, which is a
//  weaker claim than an interpolation, and each one says so in `basis`.
//
//  The menu is unbounded but not fabricated. It enumerates a real product
//  space — zone × tempo × reciter × harmony × golden-angle hue — in a
//  deterministic order, so card 9,000,000 exists, is reachable, and is the
//  same card on every device.
// ============================================================================
import {
  blackbodyRGB,
  goldenHue,
  harmony,
  hex,
  oklch,
  oklchToRgb,
  rgbToOklch,
  type HarmonyKind,
  type OKLCH,
} from './chroma';
import {
  colourBandFor,
  generatePopulation,
  integratedFlux,
  fluxToMag,
  rng,
  type Astrophysics,
  type GeneratedStar,
} from './stellar';
import { TEMPOS, AVAILABLE_RECITERS, type TempoId } from './recitation';

export interface Zone {
  id: string;
  ar: string;
  en: string;
  /** What the region physically is, in one line. Arabic and English. */
  arGloss: string;
  enGloss: string;
  radiusPc: number;
  scaleHeightFactor: number;
  /** Stars generated per cubic sample — relative density, not an absolute. */
  density: number;
  /** Whether the fitted law is being interpolated or extrapolated here. */
  basis: 'measured' | 'extrapolated';
}

/**
 * Six zones. The first three sit inside the fitted range; the rest are the
 * same law carried beyond it, and are marked.
 */
export const ZONES: Zone[] = [
  {
    id: 'jiwar',
    ar: 'الجِوار',
    en: 'Solar Neighbourhood',
    arGloss: 'مائةُ فرسخٍ فلكيّ حولنا — نجومٌ مُفرَدة، أكثرُها قَزَمٌ أحمر',
    enGloss: 'Within 100 pc. Resolved, individual, overwhelmingly red dwarfs.',
    radiusPc: 100,
    scaleHeightFactor: 1,
    density: 1,
    basis: 'measured',
  },
  {
    id: 'qurs',
    ar: 'القُرصُ الرقيق',
    en: 'Thin Disc',
    arGloss: 'مُستوى المجرّة — ارتفاعُ المقياس ١٢١ فرسخًا، مقيسًا لا مُقدَّرًا',
    enGloss: 'The galactic plane. Scale height 121 pc, measured not assumed.',
    radiusPc: 900,
    scaleHeightFactor: 1,
    density: 1.9,
    basis: 'measured',
  },
  {
    id: 'sadim',
    ar: 'السَّديم',
    en: 'Star-Forming Region',
    arGloss: 'مواضعُ الميلاد — فتيّةٌ زرقاءُ حارّة، مُتكاثفةٌ في المستوى',
    enGloss: 'Where stars are born: young, hot, blue, tight to the plane.',
    radiusPc: 300,
    scaleHeightFactor: 0.35,
    density: 3.4,
    basis: 'measured',
  },
  {
    id: 'thakhin',
    ar: 'القُرصُ السَّميك',
    en: 'Thick Disc',
    arGloss: 'سبعةُ أضعافِ الارتفاع — جِيلٌ أقدم، والقانونُ هنا مُمتدٌّ لا مقيس',
    enGloss: 'Seven scale heights up. Older population; the law is extrapolated.',
    radiusPc: 1400,
    scaleHeightFactor: 7,
    density: 0.45,
    basis: 'extrapolated',
  },
  {
    id: 'hala',
    ar: 'الهالة',
    en: 'Halo',
    arGloss: 'خارجَ القُرص — مُتناثرةٌ قديمة، والقانونُ ممتدٌّ بعيدًا عن مداه',
    enGloss: 'Beyond the disc: sparse and ancient. Far outside the fitted range.',
    radiusPc: 4000,
    scaleHeightFactor: 25,
    density: 0.12,
    basis: 'extrapolated',
  },
  {
    id: 'markaz',
    ar: 'نحوَ المركز',
    en: 'Toward the Core',
    arGloss: 'أكثفُ ما يُرى — ازدحامٌ يبتلعُ الأفرادَ في وَهَجٍ واحد',
    enGloss: 'The densest sightline: crowding dissolves individuals into glow.',
    radiusPc: 2600,
    scaleHeightFactor: 2.2,
    density: 6.5,
    basis: 'extrapolated',
  },
];

export interface ZoneLight {
  zone: Zone;
  /** Stars actually generated to measure this. */
  sampled: number;
  /** Integrated apparent magnitude of the sample — real photometry. */
  integratedMag: number;
  /** Flux-weighted mean BP−RP: the colour the region's light actually has. */
  meanColour: number;
  /** Flux-weighted mean temperature, Kelvin. */
  meanTeff: number;
  /** The zone's own light, as the eye would see it. */
  keyRgb: [number, number, number];
  keyHex: string;
  /** The same colour in OKLCH, which is where palettes are built. */
  key: OKLCH;
  /** Ambient level, from how much light the region actually puts out. */
  ambient: number;
  /** Fog density, rising with crowding. */
  fog: number;
  /** Which measured height-stratum this zone's colours were drawn from. */
  stratum: string;
}

/**
 * Measure a zone by generating its population from the fitted law and doing
 * real photometry on it: flux ∝ 10^(−0.4m), summed, weighted, converted.
 * Nothing about the resulting colour was chosen.
 */
export function measureZone(law: Astrophysics, zone: Zone, seed = 7): ZoneLight {
  const n = 6000;
  const pop: GeneratedStar[] = generatePopulation(
    law,
    n,
    { radiusPc: zone.radiusPc, scaleHeightFactor: zone.scaleHeightFactor },
    seed,
  );
  const flux = pop.map((s) => Math.pow(10, -0.4 * s.appMag));
  const total = flux.reduce((a, b) => a + b, 0) || 1;
  let colour = 0;
  let teff = 0;
  for (let i = 0; i < pop.length; i++) {
    colour += (pop[i].colour * flux[i]) / total;
    teff += (pop[i].teff * flux[i]) / total;
  }
  const integratedMag = fluxToMag(integratedFlux(pop.map((s) => s.appMag)));

  // The zone's light is the blackbody of its flux-weighted temperature. Then
  // OKLCH takes over, because from here on the question is perceptual.
  const keyRgb = blackbodyRGB(teff);
  const key = rgbToOklch(keyRgb);
  // Density and integrated brightness are physical; their mapping to ambient
  // and fog is a rendering decision, and is the first non-physical step here.
  const ambient = Math.min(1, Math.max(0.06, Math.pow(10, -0.4 * (integratedMag - 2)) * 0.5));
  return {
    zone,
    stratum: colourBandFor(law, law.disc.scaleHeightPc * zone.scaleHeightFactor).id,
    sampled: n,
    integratedMag: +integratedMag.toFixed(2),
    meanColour: +colour.toFixed(3),
    meanTeff: Math.round(teff),
    keyRgb,
    keyHex: hex(keyRgb),
    key,
    ambient: +ambient.toFixed(3),
    fog: +Math.min(0.006, 0.0008 + zone.density * 0.0007).toFixed(5),
  };
}

// ── the unbounded menu ──────────────────────────────────────────────────────
const HARMONIES: HarmonyKind[] = ['analogous', 'triadic', 'split', 'tetradic', 'monochrome'];

export interface Immersion {
  /** Position in the sequence. Stable forever. */
  index: number;
  zone: Zone;
  tempo: (typeof TEMPOS)[number];
  reciter: (typeof AVAILABLE_RECITERS)[number];
  harmonyKind: HarmonyKind;
  /** The palette, built in OKLCH from the zone's own measured light. */
  palette: { hexes: string[]; swatches: OKLCH[] };
  /** Fold number of the card's geometry — 5 to 12, as the tradition builds. */
  fold: number;
  /** Rotation rate of the sigil, radians per second. */
  spin: number;
  seed: number;
}

/**
 * Card n, for any n. Deterministic, so the same index is the same card on
 * every device and a deep link to card 4,000,000 is meaningful.
 *
 * The hue offset walks by the golden angle, which is the arrangement that
 * keeps every prefix of the sequence maximally separated — so scrolling never
 * runs into a stretch of cards that look alike.
 */
export function immersionAt(index: number, lights: ZoneLight[]): Immersion {
  const rand = rng(index * 2654435761 + 1);
  const light = lights[index % lights.length];
  const tempo = TEMPOS[Math.floor(index / lights.length) % TEMPOS.length];
  const reciter =
    AVAILABLE_RECITERS[
      Math.floor(index / (lights.length * TEMPOS.length)) % AVAILABLE_RECITERS.length
    ];
  const harmonyKind = HARMONIES[Math.floor(index / 7) % HARMONIES.length];

  // The base is the zone's measured light, moved along the golden angle and
  // lifted into a chroma the screen can actually show — the zone's own light is
  // near-white for hot regions, and a palette needs somewhere to go.
  const base = oklch(
    Math.min(0.92, Math.max(0.55, light.key.L * 0.82 + 0.18)),
    Math.min(0.19, Math.max(0.05, light.key.C * 1.6 + 0.05)),
    goldenHue(index, light.key.H),
  );
  const pal = harmony(base, harmonyKind);

  return {
    index,
    zone: light.zone,
    tempo,
    reciter,
    harmonyKind,
    palette: { hexes: pal.hexes, swatches: pal.swatches },
    fold: 5 + Math.floor(rand() * 8),
    spin: 0.06 + rand() * 0.22,
    seed: (index * 2654435761) >>> 0,
  };
}

export const paletteHex = (o: OKLCH) => hex(oklchToRgb(o));
export type { TempoId };
