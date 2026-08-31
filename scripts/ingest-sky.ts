#!/usr/bin/env tsx
/* ===========================================================================
 *  ingest-sky.ts - build the whole naked-eye sky under data/sky/
 *
 *  Source: ofrohn/d3-celestial (BSD-3), which repackages the Yale Bright Star
 *  Catalogue and the IAU constellation figures as GeoJSON. Three files:
 *
 *    stars.6.json               every star to magnitude 6 - the naked-eye limit
 *    constellations.lines.json  the figure lines, as RA/Dec vertex chains
 *    constellations.json        names, including a native Arabic name for all 89
 *    starnames.json             Bayer letters and HIP ids per star
 *
 *  The Arabic constellation names ship with the data. Arabic *star* names are
 *  curated here instead, because the ones that matter - الدبران، النسر الواقع،
 *  قلب العقرب - are the Arabic originals the Latin names were transliterated
 *  from, and getting them right is worth doing by hand.
 *
 *  Run: npm run ingest:sky
 * ======================================================================== */
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache');
const OUT = path.join(ROOT, 'data', 'sky');
const BASE = 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data';

const FILES = ['stars.6.json', 'constellations.lines.json', 'constellations.json', 'starnames.json'];

/**
 * Arabic names for the stars whose Latin names are themselves corrupted
 * transliterations of these. Restoring them is not decoration: الدبران is what
 * the star is called, and Aldebaran is a spelling of that.
 */
const ARABIC_STAR_NAMES: Record<string, string> = {
  Aldebaran: 'الدَّبَران', Altair: 'النَّسْر الطَّائِر', Vega: 'النَّسْر الوَاقِع',
  Deneb: 'ذَنَب الدَّجَاجَة', Rigel: 'رِجْل الجَوْزَاء', Betelgeuse: 'يَد الجَوْزَاء',
  Fomalhaut: 'فَم الحُوت', Algol: 'رَأْس الغُول', Mizar: 'المِئْزَر', Alcor: 'السُّهَا',
  Dubhe: 'ظَهْر الدُّبّ', Merak: 'المَراقّ', Alioth: 'الجَوْن', Alkaid: 'القَائِد',
  Phecda: 'فَخِذ الدُّبّ', Megrez: 'المَغْرِز', Sirius: 'الشِّعْرَى اليَمَانِيَة',
  Procyon: 'الشِّعْرَى الشَّامِيَة', Regulus: 'قَلْب الأَسَد', Antares: 'قَلْب العَقْرَب',
  Spica: 'السِّمَاك الأَعْزَل', Arcturus: 'السِّمَاك الرَّامِح', Capella: 'العَيُّوق',
  Achernar: 'آخِر النَّهْر', Alphard: 'الفَرْد', Markab: 'المَرْكَب', Scheat: 'السَّاق',
  Algenib: 'الجَنْب', Alpheratz: 'سُرَّة الفَرَس', Mirach: 'المَراقّ', Menkar: 'المَنْخَر',
  Rasalhague: 'رَأْس الحَوَّاء', Rasalgethi: 'رَأْس الجَاثِي', Unukalhai: 'عُنُق الحَيَّة',
  Shaula: 'الشَّوْلَة', Bellatrix: 'النَّجِيد', Saiph: 'سَيْف الجَبَّار',
  Mintaka: 'المِنْطَقَة', Alnilam: 'النِّظَام', Alnitak: 'النِّطَاق',
  Castor: 'رَأْس التَّوْأَم المُقَدَّم', Pollux: 'رَأْس التَّوْأَم المُؤَخَّر',
  Denebola: 'ذَنَب الأَسَد', Algieba: 'الجَبْهَة', Zosma: 'الظَّهْر',
  Alphecca: 'الفَكَّة', Nunki: 'النُّنكي', Kaus: 'القَوْس', Sadr: 'الصَّدْر',
  'Deneb Algedi': 'ذَنَب الجَدْي', 'Deneb Kaitos': 'ذَنَب قَيْطُس',
  Albireo: 'مِنْقَار الدَّجَاجَة', Enif: 'الأَنْف', Diphda: 'الضِّفْدَع الثَّانِي',
  Hamal: 'الحَمَل', Sheratan: 'الشَّرَطَان', Almaak: 'عَنَاق الأَرْض',
  Polaris: 'الجَدْي', Kochab: 'الكَوْكَب', Wezen: 'الوَزْن', Adhara: 'العَذَارَى',
  Mirzam: 'المِرْزَم', Alhena: 'الهَنْعَة', Alnair: 'النَّيِّر', Atria: 'أَتْرِيَا',
  Avior: 'أَفْيُور', Canopus: 'سُهَيْل', Miaplacidus: 'مِيَاه', Acrux: 'الصَّلِيب',
  Gacrux: 'جَاكْرُوكْس', Hadar: 'حَضَار', Rigil: 'رِجْل القِنْطُورِس',
  Menkent: 'مَنْكِب قِنْطُورِس', Alsephina: 'السَّفِينَة', Suhail: 'سُهَيْل الوَزْن',
  Peacock: 'الطَّاوُوس', Sabik: 'السَّابِق', Eltanin: 'التِّنِّين', Thuban: 'الثُّعْبَان',
  Alderamin: 'الذِّرَاع اليُمْنَى', Caph: 'الكَفّ', Schedar: 'الصَّدْر',
  Ruchbah: 'الرُّكْبَة', Mirfak: 'مِرْفَق الثُّرَيَّا', Alcyone: 'الثُّرَيَّا',
  Menkalinan: 'مَنْكِب ذِي العِنَان', Elnath: 'النَّطْح', Nihal: 'النِّهَال',
  Arneb: 'الأَرْنَب', Zubeneschamali: 'الزُّبَانَى الشَّمَالِيَّة',
  Zubenelgenubi: 'الزُّبَانَى الجَنُوبِيَّة', Dschubba: 'الجَبْهَة',
  Sargas: 'سَرْجَس', Lesath: 'اللَّسْعَة', Alrescha: 'الرِّشَاء',
};

/** The twelve zodiacal signs, which are what البروج names. */
const ZODIAC = ['Ari', 'Tau', 'Gem', 'Cnc', 'Leo', 'Vir', 'Lib', 'Sco', 'Sgr', 'Cap', 'Aqr', 'Psc'];

const log = (...a: unknown[]) => console.log('  ', ...a);

async function exists(p: string) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function fetchCached(file: string, refresh: boolean): Promise<string> {
  await mkdir(CACHE, { recursive: true });
  const dest = path.join(CACHE, file);
  if (!refresh && (await exists(dest))) {
    log(`cache hit   ${file}`);
    return readFile(dest, 'utf8');
  }
  const url = `${BASE}/${file}`;
  log(`downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
  return readFile(dest, 'utf8');
}

interface GeoFeature {
  id: string | number;
  properties: Record<string, string | number>;
  geometry: { type: string; coordinates: number[] | number[][][] };
}

async function main() {
  const refresh = process.argv.includes('--refresh');
  console.log('\n  sky ingestion\n  ' + '-'.repeat(52));

  const [starsRaw, linesRaw, namesRaw, starNamesRaw] = await Promise.all(
    FILES.map((f) => fetchCached(f, refresh)),
  );

  const stars = JSON.parse(starsRaw) as { features: GeoFeature[] };
  const lines = JSON.parse(linesRaw) as { features: GeoFeature[] };
  const names = JSON.parse(namesRaw) as { features: GeoFeature[] };
  const starNames = JSON.parse(starNamesRaw) as Record<
    string,
    { name: string; bayer: string; c: string; hip: string }
  >;

  // -- stars: [ra, dec, mag] rounded, plus a name where one is worth carrying --
  const starRows: [number, number, number][] = [];
  const named: { i: number; en: string; ar?: string; bayer?: string; con?: string }[] = [];

  stars.features.forEach((f) => {
    const [ra, dec] = f.geometry.coordinates as number[];
    const mag = Number(f.properties.mag);
    const i = starRows.length;
    starRows.push([+ra.toFixed(4), +dec.toFixed(4), +mag.toFixed(2)]);

    const meta = starNames[String(f.id)];
    if (!meta) return;
    const proper = (meta.name ?? '').trim();
    if (!proper) return;
    // Exact first, then longest key that ends on a word boundary. A bare
    // prefix test is wrong: `Deneb` is a prefix of `Denebola`, which is a
    // different star with a different Arabic name (ذنب الأسد, not ذنب الدجاجة).
    const lower = proper.toLowerCase();
    const keyword =
      Object.keys(ARABIC_STAR_NAMES).find((k) => k.toLowerCase() === lower) ??
      Object.keys(ARABIC_STAR_NAMES)
        .filter((k) => {
          const kl = k.toLowerCase();
          return lower.startsWith(kl) && (lower.length === kl.length || lower[kl.length] === ' ');
        })
        .sort((a, b) => b.length - a.length)[0];
    named.push({
      i,
      en: proper,
      ar: keyword ? ARABIC_STAR_NAMES[keyword] : undefined,
      bayer: meta.bayer || undefined,
      con: meta.c || undefined,
    });
  });

  // -- constellations: figure lines + a centroid to aim a camera at ----------
  const arabicById = new Map<string, { ar: string; en: string }>();
  for (const f of names.features) {
    arabicById.set(String(f.id), {
      ar: String(f.properties.ar ?? ''),
      en: String(f.properties.en ?? f.properties.name ?? ''),
    });
  }

  const constellations = lines.features.map((f) => {
    const segments = f.geometry.coordinates as unknown as number[][][];
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let n = 0;
    for (const seg of segments) {
      for (const [ra, dec] of seg) {
        // Average on the unit sphere; averaging RA directly breaks at 0h/24h.
        const a = (ra * Math.PI) / 180;
        const d = (dec * Math.PI) / 180;
        sx += Math.cos(d) * Math.cos(a);
        sy += Math.cos(d) * Math.sin(a);
        sz += Math.sin(d);
        n++;
      }
    }
    const cx = sx / (n || 1);
    const cy = sy / (n || 1);
    const cz = sz / (n || 1);
    const centreRa = ((Math.atan2(cy, cx) * 180) / Math.PI + 360) % 360;
    const centreDec = (Math.atan2(cz, Math.hypot(cx, cy)) * 180) / Math.PI;

    const id = String(f.id);
    const nm = arabicById.get(id);
    return {
      id,
      ar: nm?.ar || id,
      en: nm?.en || id,
      zodiac: ZODIAC.includes(id),
      centre: [+centreRa.toFixed(3), +centreDec.toFixed(3)] as [number, number],
      lines: segments.map((seg) =>
        seg.map(([ra, dec]) => [+ra.toFixed(3), +dec.toFixed(3)] as [number, number]),
      ),
    };
  });

  await mkdir(OUT, { recursive: true });
  await writeFile(
    path.join(OUT, 'sky.json'),
    JSON.stringify({
      builtAt: new Date().toISOString(),
      source: 'ofrohn/d3-celestial (BSD-3) — Yale BSC + IAU figures',
      magnitudeLimit: 6,
      stars: starRows,
      named,
      constellations,
    }),
  );

  const zod = constellations.filter((c) => c.zodiac);
  console.log('  ' + '-'.repeat(52));
  log(`stars          ${starRows.length.toLocaleString()} (to magnitude 6)`);
  log(`named stars    ${named.length} (${named.filter((n) => n.ar).length} with Arabic names)`);
  log(`constellations ${constellations.length} (all with Arabic names)`);
  log(`zodiac (بروج)  ${zod.length}: ${zod.map((c) => c.ar).join('، ')}`);
  const bytes = (await stat(path.join(OUT, 'sky.json'))).size;
  log(`written        ${(bytes / 1024).toFixed(0)} KB`);
  console.log('\n  done\n');
}

main().catch((e) => {
  console.error('\n  sky ingestion failed:', e);
  process.exit(1);
});
