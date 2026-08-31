import 'server-only';
// ============================================================================
//  Playing a whole sūrah in الفرقان.
//
//  A sūrah becomes a composition whose stations are its āyāt in order. The
//  discoveries are attached as annotations rather than inserted as extra
//  stations: interleaving is right for a برج built around a marker, but it
//  would break a recitation, which has to run in the order it was revealed.
// ============================================================================
import { loadSurah } from '../data.server';
import { DEFAULT_DWELL, type Composition, type Station } from '../composition';
import type { Discovery } from '../types';

const INTERESTING = new Set([
  'jisr-al-naba',
  'istihdar',
  'raj-al-jidhr',
  'nasikh-mirror',
  'alsinat-al-khalq',
]);

export async function surahComposition(id: number): Promise<Composition> {
  const { surah, discoveries } = await loadSurah(id);

  // Strongest annotation per āyah, so a station carries one label not five.
  // `discoveries` arrives sorted by score descending, so the first writer of
  // an āyah is already the strongest and later ones are simply skipped.
  const best = new Map<number, Discovery>();
  for (const d of discoveries) {
    if (!INTERESTING.has(d.kind)) continue;
    for (let n = d.ayahFrom; n <= d.ayahTo; n++) {
      if (!best.has(n)) best.set(n, d);
    }
  }

  const stations: Station[] = surah.ayaat.map((a) => {
    const ann = best.get(a.n);
    return {
      surah: id,
      ayah: a.n,
      seam: ann?.seam,
      caption: ann?.note,
      discoveryKind: ann?.kind,
      source: ann ? 'discovery' : 'manual',
    };
  });

  const now = new Date().toISOString();
  return {
    id: `surah-${id}`,
    title: surah.name,
    subtitle: `${surah.type === 'makkiyyah' ? 'مكية' : 'مدنية'} · ${surah.ayahCount} آية`,
    intent: 'تلاوةُ السورة كاملةً في الفرقان، وعند كل آيةٍ ما وجده محرّك الإسناد فيها.',
    movements: [
      {
        id: `m-surah-${id}`,
        title: surah.name,
        note: `${surah.wordCount} كلمة · أعمقُ تداخلٍ في القول: ${surah.maxDepth}`,
        stations,
      },
    ],
    published: true,
    dwell: DEFAULT_DWELL,
    createdAt: now,
    updatedAt: now,
  };
}
