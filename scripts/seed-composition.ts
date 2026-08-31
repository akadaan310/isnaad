#!/usr/bin/env tsx
/* ===========================================================================
 *  seed-composition.ts - assemble and publish a starting composition.
 *
 *  One worked example, so the gallery is not empty on a fresh clone and so the
 *  shape of a composition is legible before you write your own. It follows the
 *  arc the constructs themselves suggest: the oath sworn by the positions of
 *  the stars and its answer, the towers set in the sky, the two senses of فلك -
 *  the ship that carries and the orbit that carries - the ship and the fish
 *  standing two ayat apart in as-Saffat, and the unnamed voice from inside a
 *  group that occurs exactly three times and turns the account each time.
 *
 *  Run: npm run seed
 * ======================================================================== */
import { assembleMovement } from '../src/lib/engine/assembler';
import { saveComposition, listCompositions } from '../src/lib/compositions.server';
import { newId, DEFAULT_DWELL, type Composition, type Movement } from '../src/lib/composition';

const SEED_TITLE = 'مواقعُ النجوم';

/** عَلَم -> the برج title and the lesson it carries, overriding the defaults. */
const PROGRAMME: { alam: string; title: string; note: string; limit: number }[] = [
  {
    alam: 'mawaqi-al-nujum',
    title: 'القَسَم بالمواقع',
    note: 'موضعٌ واحدٌ في المصحف كلِّه يُقسَم فيه بمواقع النجوم، وجوابُ القسم بعده: إِنَّهُۥ لَقُرْءَانٌ كَرِيمٌ. فالمواقعُ مقدّمةٌ، والقرآنُ الكريم جوابُها.',
    limit: 2,
  },
  {
    alam: 'buruj',
    title: 'البُرُوج',
    note: 'أربعةُ مواضعَ لا خامسَ لها. وفيها: تَبَارَكَ ٱلَّذِى جَعَلَ فِى ٱلسَّمَآءِ بُرُوجًا — البروجُ مجعولةٌ، ومعها سراجٌ وقمرٌ منير.',
    limit: 4,
  },
  {
    alam: 'falak-madar',
    title: 'فَلَك — المدار',
    note: 'موضعان اثنان فقط: كُلٌّ فِى فَلَكٍ يَسْبَحُونَ. والسباحة إسنادٌ إلى جمعِ العقلاء، والمُسنَد إليه شمسٌ وقمرٌ وليلٌ ونهار.',
    limit: 2,
  },
  {
    alam: 'fulk-mashhun',
    title: 'الفُلْك المَشْحُون',
    note: 'ثلاثةُ مواضع. وثالثُها في الصافّات، يليه بآيتين: فَٱلْتَقَمَهُ ٱلْحُوتُ — فالفُلكُ والحوتُ في سياقٍ واحد.',
    limit: 3,
  },
  {
    alam: 'hut',
    title: 'الحُوت',
    note: 'عند مجمع البحرين اتّخذ سبيله سَرَبًا، وفي الصافّات التقم، وفي القلم صاحبُه مكظوم.',
    limit: 5,
  },
  {
    alam: 'qail-minhum',
    title: 'قائلٌ منهم',
    note: 'ثلاثةُ مواضعَ لا رابعَ لها، وفي كلٍّ منها صوتٌ لا يُسمَّى يخرج من داخل الجماعة فيُحوِّل الخبر: لا تقتلوا يوسف، وكم لبثتم، وإنّي كان لي قرين.',
    limit: 3,
  },
  {
    alam: 'anba-al-ghayb',
    title: 'أنباء الغيب',
    note: 'ثلاثةُ مواضع، وفي كلٍّ منها يُقال للمخاطَب: ما كنتَ حاضرًا. فالنبأُ يصل، والحضورُ منفيّ.',
    limit: 3,
  },
];

async function main() {
  console.log('\n  seeding a composition\n  ' + '-'.repeat(50));

  const existing = await listCompositions(false);
  const already = existing.find((c) => c.title === SEED_TITLE);
  if (already) {
    console.log(`   "${SEED_TITLE}" already exists (${already.id}); nothing to do.`);
    console.log(`   delete it first if you want it rebuilt.\n`);
    return;
  }

  const movements: Movement[] = [];
  for (const p of PROGRAMME) {
    const m = await assembleMovement(p.alam, {
      limit: p.limit,
      interleave: true,
      includeAssociated: false,
    });
    if (!m) {
      console.warn(`   ! unknown alam: ${p.alam}`);
      continue;
    }
    movements.push({ ...m, title: p.title, note: p.note });
    console.log(`   ${p.title.padEnd(22)} ${String(m.stations.length).padStart(3)} stations`);
  }

  const now = new Date().toISOString();
  const composition: Composition = {
    id: newId(),
    title: SEED_TITLE,
    subtitle: 'من القَسَم بالمواقع إلى الصوت الذي لا يُسمَّى',
    intent:
      'تأليفٌ يمشي على أعلامٍ قليلةِ المواضع، معدودةٍ يمكن استقصاؤها كلُّها: مواقعُ النجوم مرةً واحدة، والبروجُ أربعًا، والفَلَكُ مرتين، والفُلكُ المشحونُ ثلاثًا، وقائلٌ منهم ثلاثًا. وعند كل موضعٍ يُعرَض ما وجده محرّكُ الإسناد فيه.',
    movements,
    published: true,
    dwell: DEFAULT_DWELL,
    createdAt: now,
    updatedAt: now,
  };

  const saved = await saveComposition(composition);
  const total = saved.movements.reduce((n, m) => n + m.stations.length, 0);
  console.log('  ' + '-'.repeat(50));
  console.log(`   saved ${saved.id} - ${saved.movements.length} movements, ${total} stations`);
  console.log(`   watch at /watch/${saved.id}\n`);
}

main().catch((e) => {
  console.error('\n  seeding failed:', e);
  process.exit(1);
});
