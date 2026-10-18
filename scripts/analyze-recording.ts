#!/usr/bin/env tsx
// Summarise flight recordings: integrity, frame times, diagnosis. Usage: tsx scripts/analyze-recording.ts <file…>
import { readFileSync } from 'node:fs';
import { diagnose, frameStats, verifyRecording, type Recording } from '../src/lib/universe/recorder';

for (const f of process.argv.slice(2)) {
  const r = JSON.parse(readFileSync(f, 'utf8')) as Recording;
  const s = frameStats(r.frames);
  console.log(`\n${f}`);
  console.log(`  integrity ${verifyRecording(r) ? 'ok' : 'FAILED'} · device ${r.env.device} · ${r.env.gpu.renderer}`);
  console.log(`  viewport ${r.env.viewport.join('×')} · canvas ${r.canvas.map((g) => `${g.cssW}×${g.cssH}css/${g.bufW}×${g.bufH}buf@${g.dpr}`).join(', ')}`);
  console.log(`  frames ${r.frames.length} (dropped ${r.dropped}) · median ${s.median.toFixed(1)} ms · p95 ${s.p95.toFixed(1)} ms · max ${s.max.toFixed(1)} ms · ~${s.fps.toFixed(0)} fps`);
  console.log(`  events ${Object.entries(r.events.reduce<Record<string, number>>((m, e) => ((m[e.kind] = (m[e.kind] ?? 0) + 1), m), {})).map(([k, v]) => `${k}:${v}`).join(' ')}`);
  for (const d of diagnose(r)) console.log(`  ${d.supported ? '✗' : '✓'} ${d.cls}: ${d.evidence}`);
}
