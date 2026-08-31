#!/usr/bin/env tsx
/* ===========================================================================
 *  verify-exemplars.ts - the engine's acceptance tests.
 *
 *  Three passages were used to design the detectors. They are the standard the
 *  engine is held to: if a change stops finding them, the change is wrong.
 *
 *    11:29  Nuh speaks of the believers in absence (إِنَّهُم مُّلَٰقُوا۟ رَبِّهِمْ)
 *           and the tongue turns, in the same breath, to address his people
 *           directly (وَلَٰكِنِّىٓ أَرَىٰكُمْ) - the referent is summoned forward.
 *
 *    50:2   Wonder is predicated of them while they are absent (عَجِبُوٓا۟), and
 *           the same root comes back out of their own mouths (عَجِيبٌ).
 *
 *    28:4-5 A closed past account of Fir'awn gives way to نُرِيدُ ... نَمُنَّ -
 *           the imperfect first person, landing on the reader's own clock.
 *
 *  Run: npx tsx scripts/verify-exemplars.ts
 * ======================================================================== */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSurah, analyze, parseCorpus, type SurahSource } from '../src/lib/corpus';
import type { AnalyzedSurah } from '../src/lib/corpus';
import type { Discovery } from '../src/lib/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');

let metaCache: Record<number, SurahSource> | null = null;
const cache = new Map<number, AnalyzedSurah>();

async function load(id: number): Promise<AnalyzedSurah> {
  const hit = cache.get(id);
  if (hit) return hit;
  metaCache ??= JSON.parse(await readFile(path.join(DATA, 'corpus', 'meta.json'), 'utf8'));
  const rows = parseCorpus(await readFile(path.join(DATA, 'corpus', `${id}.txt`), 'utf8'));
  const analyzed = analyze(buildSurah(id, rows, metaCache![id]));
  cache.set(id, analyzed);
  return analyzed;
}

interface Check {
  name: string;
  surah: number;
  ayah: number;
  kind: Discovery['kind'];
  /** Extra condition the winning discovery must satisfy. */
  where?: (d: Discovery) => boolean;
  detail: (d: Discovery) => string;
}

const CHECKS: Check[] = [
  {
    name: '11:29  istihdar - absence summoned into address',
    surah: 11,
    ayah: 29,
    kind: 'istihdar',
    detail: (d) =>
      `run=${d.evidence['طول الغيبة']} gap=${d.evidence['مسافة الخطاب']} ` +
      `mirror=${d.evidence['تقابل النواسخ']} anchor=${d.evidence['مرساة المتكلم']}`,
  },
  {
    name: '11:29  nasikh mirror - إِنَّ carrying 3rd, then لٰكِنَّ carrying 1st',
    surah: 11,
    ayah: 29,
    kind: 'nasikh-mirror',
    detail: (d) => `${d.evidence['الناسخ']}  ${d.evidence['من']} -> ${d.evidence['إلى']}`,
  },
  {
    name: '50:2   root return - عجب predicated, then uttered',
    surah: 50,
    ayah: 2,
    kind: 'raj-al-jidhr',
    where: (d) => d.evidence['الجذر'] === 'عجب',
    detail: (d) =>
      `root=${d.evidence['الجذر']} distance=${d.evidence['المسافة']} ` +
      `enteredSpeech=${d.evidence['دخول القول']} sayer=${d.evidence['مطابقة القائل']}`,
  },
  {
    name: '28:5   naba bridge - past account into the living imperfect',
    surah: 28,
    ayah: 5,
    kind: 'jisr-al-naba',
    detail: (d) =>
      `narrative=${d.evidence['طول السرد']} perfects=${d.evidence['مواضع الماضي']} ` +
      `sustain=${d.evidence['امتداد المضارع']} crossing=[${(d.evidence['جذور عابرة'] as string[]).join(' ')}]`,
  },
  {
    name: '28:5   ribat - lexis held while the attribution swings',
    surah: 28,
    ayah: 5,
    kind: 'ribat',
    detail: (d) =>
      `${d.evidence['من']} -> ${d.evidence['إلى']} ` +
      `roots=[${(d.evidence['الجذور الرابطة'] as string[]).join(' ')}]`,
  },
];

async function main() {
  console.log('\n  acceptance: the three passages the engine was built from\n  ' + '-'.repeat(64));
  let failed = 0;

  for (const c of CHECKS) {
    const { discoveries } = await load(c.surah);
    const hits = discoveries
      .filter((d) => d.kind === c.kind && c.ayah >= d.ayahFrom && c.ayah <= d.ayahTo)
      .filter((d) => (c.where ? c.where(d) : true))
      .sort((a, b) => b.score - a.score);

    if (!hits.length) {
      failed++;
      console.log(`  FAIL  ${c.name}`);
      continue;
    }
    const best = hits[0];
    console.log(`  ok    ${c.name}`);
    console.log(`        score ${best.score.toFixed(3)}  ${c.detail(best)}`);
  }

  // Nesting must exist somewhere, or the frame tree is not doing its job.
  console.log('\n  ' + '-'.repeat(64) + '\n  deepest attribution nesting found:');
  const deep: { surah: number; name: string; depth: number; chain: string }[] = [];
  for (let id = 1; id <= 114; id++) {
    const { surah, discoveries } = await load(id);
    for (const x of discoveries.filter((x) => x.kind === 'tabaqat-al-isnad')) {
      deep.push({
        surah: id,
        name: surah.name,
        depth: x.evidence['العمق'] as number,
        chain: (x.evidence['السلسلة'] as string[]).join(' -> '),
      });
    }
  }
  deep.sort((a, b) => b.depth - a.depth);
  if (!deep.length) {
    failed++;
    console.log('  FAIL  no nested attribution found anywhere');
  } else {
    for (const d of deep.slice(0, 6)) {
      console.log(`        ${d.surah}:${d.name}  depth ${d.depth}  ${d.chain}`);
    }
    console.log(`        (${deep.length} nested frames in total)`);
  }

  console.log('\n  ' + (failed ? `${failed} CHECK(S) FAILED` : 'all checks passed') + '\n');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
