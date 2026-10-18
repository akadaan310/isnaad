#!/usr/bin/env tsx
/* ===========================================================================
 *  mission-package.ts — the offline, content-hashed mission package.
 *
 *  No live mission PURL exists for this mission (docs/studio/PURL.md says why).
 *  This is the machine-readable fallback the mission requires: an objective
 *  graph, progress, artifacts with sha256, tests and their last results,
 *  sources and their HTTP outcomes, exact commits, blockers, a checkpoint and
 *  the next permitted operation — reproducible from the repository alone.
 *
 *    docs/studio/mission/mission.json             the full package
 *    docs/studio/mission/mission.purl-state.json  ≤ 64 KiB, the PURL `state`
 *    docs/studio/mission/MISSION.md               plain-Markdown fallback
 *
 *  Run: npm run mission   (after npm test; reads the browser report if present)
 * ======================================================================== */
import { createHash } from 'node:crypto';
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PURL_STATE_LIMIT } from '../src/lib/universe/purl';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'docs', 'studio', 'mission');
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const git = (c: string) => execSync(`git ${c}`, { cwd: ROOT, encoding: 'utf8' }).trim();
const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v;

const BASELINE = '4c059a1691920a13ea973146e42518e83f31573c';
const BRANCH = 'claude/new-session-g1qcwm';
const head = git('rev-parse HEAD');
const dirty = git('status --porcelain').split('\n').filter(Boolean).length;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, e);
    if (statSync(path.join(ROOT, rel)).isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}
const artifactPaths = [
  ...walk('src/lib/universe'),
  'src/lib/cosmos/legacy-preset.ts',
  'src/lib/access.ts',
  'src/middleware.ts',
  ...walk('src/components/universe'),
  ...walk('src/app/universe'),
  ...walk('src/app/api/universe'),
  'scripts/ingest-universe.ts',
  'scripts/hypotheses.ts',
  'scripts/purl-adapter.ts',
  'scripts/mission-package.ts',
  'scripts/voyage-digest.ts',
  ...walk('tests'),
  ...walk('data/universe'),
  ...walk('docs/studio').filter((p) => !p.startsWith('docs/studio/mission/')),
].filter((p) => existsSync(path.join(ROOT, p)));
const artifacts = artifactPaths.sort().map((p) => {
  const b = readFileSync(path.join(ROOT, p));
  return { path: p, bytes: b.length, sha256: sha(b) };
});

// Tests, run now.
const unit = spawnSync('npm', ['test', '--silent'], { cwd: ROOT, encoding: 'utf8' });
const pass = Number(unit.stdout.match(/# pass (\d+)/)?.[1] ?? 0);
const fail = Number(unit.stdout.match(/# fail (\d+)/)?.[1] ?? -1);
const verify = spawnSync('npm', ['run', '--silent', 'verify'], { cwd: ROOT, encoding: 'utf8' });
const browserPath = path.join(ROOT, 'docs/studio/evidence/studio/report.json');
const browser = existsSync(browserPath) ? (JSON.parse(readFileSync(browserPath, 'utf8')) as { steps: { ok: boolean }[]; failures: string[] }) : null;
const hyp = JSON.parse(readFileSync(path.join(ROOT, 'docs/studio/evidence/hypotheses.json'), 'utf8')) as { results: { id: string; verdict: string; claim: string }[] };
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'data/universe/manifest.json'), 'utf8'));
const probes = readFileSync(path.join(ROOT, 'docs/studio/evidence/purl/probes.log'), 'utf8').trim().split('\n');

const events = git(`log --reverse --format=%H%x09%cI%x09%s ${BASELINE}..HEAD`)
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const [commit, at, subject] = l.split('\t');
    return { commit, at, subject };
  });

const objectives = [
  {
    id: 'O1', title: '100% corpus locus addressability, exact identity, zero silent omissions; legacy fixtures reconstructible',
    status: 'met',
    results: [`${manifest.counts.placed}/${manifest.counts.corpus} āyāt placed`, `${manifest.counts.unattributed} unattributed āyāt on their own shell (were silently d=0.5)`, `legacy 1,000 re-derived with ${manifest.legacy.mismatches} mismatches`],
    evidence: ['tests/universe.test.ts', 'data/universe/manifest.json'],
    depends_on: [],
  },
  {
    id: 'O2', title: 'Reproducible seeded flight paths, rendering provenance; one glitch cause isolated',
    status: 'met (simulated devices only)',
    results: ['voyage digest identical in Node and in Chromium for the same seed', 'half-screen glitch: setSize(w,h,false) in the legacy scene — reproduced at dpr 2/2.625/3, fixed, ?legacy-canvas keeps the repro', 'not yet confirmed on real Android hardware'],
    evidence: ['tests/voyage.test.ts', 'docs/studio/GLITCH.md', 'docs/studio/evidence/glitch/'],
    depends_on: ['O1'],
  },
  {
    id: 'O3', title: 'Guided auto mode for a first-time user, deep expert mode; usability failures captured',
    status: 'partly met — no human first-time user has tried it yet',
    results: [browser ? `${browser.steps.filter((s) => s.ok).length}/${browser.steps.length} scripted browser checks` : 'browser report absent', '8 usability failures found and logged; 7 fixed'],
    evidence: ['tests/browser/studio.mjs', 'docs/studio/USABILITY.md'],
    depends_on: ['O1', 'O2'],
  },
  {
    id: 'O4', title: '≥5 novel geometric/interaction hypotheses with baselines and counterexamples',
    status: 'met',
    results: hyp.results.map((r) => `${r.id} ${r.verdict}`),
    evidence: ['scripts/hypotheses.ts', 'docs/studio/evidence/hypotheses.json', 'docs/studio/HYPOTHESES.md'],
    depends_on: ['O1'],
  },
  {
    id: 'O5', title: 'Portable private replay and a truthful 7u handoff',
    status: 'met locally; PURL publication blocked',
    results: ['recordings export/verify/replay', 'fragment handoff round-trips in a fresh browser context', 'live PURL blocked: no verified identity on the service, no token'],
    evidence: ['src/lib/universe/handoff.ts', 'src/lib/universe/recorder.ts', 'docs/studio/PURL.md'],
    depends_on: ['O2'],
  },
];

const blockers = [
  { id: 'B1', what: 'No live mission PURL', why: 'GET /api/identity/config → available:false (PURL_OIDC_* not configured); only unverified guest principals exist; no PURL_TOKEN was provided', unblock: 'Configure PURL identity or supply a Bearer token with resources:write, then: PURL_TOKEN=… npm run purl -- --execute' },
  { id: 'B2', what: 'No real-device measurements', why: 'This session has headless Chromium (SwiftShader) only', unblock: 'Open /universe on the Android phone, fly 60 s, export the recording (المسجّل → صدّر JSON), add it to docs/studio/evidence/devices/' },
  { id: 'B3', what: 'No private hosting configured', why: 'No deployment credentials were provided and public deployment is out of scope', unblock: 'Follow docs/studio/PRIVACY.md (set STUDIO_ACCESS_TOKEN before the first deploy)' },
  { id: 'B4', what: 'Open-dammatan mapping unconfirmed', why: 'U+065E→U+08F1 is an inference about the source convention', unblock: 'A reader of the muṣḥaf confirms docs/studio/USABILITY.md §U5 before applying it to the legacy views' },
];

const next = [
  'Read docs/studio/HANDOFF.md, then run: npm ci && npm test && npm run build',
  'Next permitted operation: resolve B2 (real-device recording) — it needs no credentials',
  'Then B4 (human confirmation), then B1 (PURL publication with the owner’s token)',
];

const pkg = {
  format: 'isnaad-mission/1',
  mission: 'ISNAAD — Private Immersive Research Studio (Abed & 7u)',
  repository: 'https://github.com/akadaan310/isnaad',
  branch: BRANCH,
  baseline: BASELINE,
  built_from: head,
  working_tree_changes_at_build: dirty,
  built_at: new Date().toISOString(),
  previous_mission_reference: {
    url: 'https://purls-production.up.railway.app/p/resource_95a5662789076892fe698316',
    relation: 'read-only orientation; not modified, not claimed',
  },
  objectives,
  progress: events,
  tests: {
    unit: { command: 'npm test', pass, fail },
    exemplars: { command: 'npm run verify', ok: verify.status === 0 },
    browser: browser ? { command: 'node tests/browser/studio.mjs <base> <out> <digest>', passed: browser.steps.filter((s) => s.ok).length, total: browser.steps.length, failures: browser.failures, devices: 'simulated' } : null,
  },
  hypotheses: hyp.results.map((r) => ({ id: r.id, verdict: r.verdict, claim: r.claim })),
  coverage: manifest.counts,
  artifacts,
  sources: probes,
  blockers,
  checkpoint: {
    summary: 'Full-universe studio built and tested on simulated devices; legacy preserved and reconstructible; one glitch root-caused; six hypotheses tested (1 supported, 5 refused); live PURL blocked on identity.',
    next,
  },
  continuation: {
    next_permitted_operation: 'B2: capture a real-device flight recording — no credentials required',
    not_permitted_without_owner: ['any PURL write', 'any public deployment', 'force-push or history rewrite', 'changes to SNAD or FALAK'],
    purl_publication: 'PURL_TOKEN=<owner token> npm run purl -- --execute  (creates a PRIVATE resource and verifies by read-back)',
  },
};
const package_sha256 = sha(JSON.stringify(canon(pkg)));
const full = { ...pkg, package_sha256 };

// The PURL state: everything but the per-file artifact list, which is
// summarised by count and a hash over it.
const state = {
  ...pkg,
  artifacts: { count: artifacts.length, sha256_of_list: sha(JSON.stringify(artifacts)), full_list: 'docs/studio/mission/mission.json' },
  package_sha256,
};
const stateBytes = Buffer.byteLength(JSON.stringify(state));
if (stateBytes > PURL_STATE_LIMIT) throw new Error(`PURL state is ${stateBytes} bytes, over ${PURL_STATE_LIMIT}`);

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, 'mission.json'), JSON.stringify(full, null, 2) + '\n');
writeFileSync(path.join(OUT, 'mission.purl-state.json'), JSON.stringify(state, null, 2) + '\n');

const md = [
  `# ISNAAD mission — offline package`,
  '',
  `> Fallback for a mission PURL that could not be created (blocker B1). Machine-readable: \`mission.json\` (sha256 \`${package_sha256}\`).`,
  '',
  `- Repository: ${pkg.repository} · branch \`${BRANCH}\``,
  `- Baseline: \`${BASELINE}\` · built from: \`${head}\`${dirty ? ` (+${dirty} uncommitted files at build time)` : ''}`,
  `- Tests: unit ${pass} pass / ${fail} fail · exemplars ${verify.status === 0 ? 'ok' : 'FAILED'}${browser ? ` · browser ${browser.steps.filter((s) => s.ok).length}/${browser.steps.length} (simulated)` : ''}`,
  '',
  '## Objectives',
  ...objectives.map((o) => `- **${o.id}** ${o.title} — _${o.status}_\n  - ${o.results.join('\n  - ')}`),
  '',
  '## Blockers',
  ...blockers.map((b) => `- **${b.id}** ${b.what}. ${b.why}. → ${b.unblock}`),
  '',
  '## Next',
  ...next.map((n, i) => `${i + 1}. ${n}`),
  '',
  `**Next permitted operation:** ${pkg.continuation.next_permitted_operation}`,
  '',
].join('\n');
writeFileSync(path.join(OUT, 'MISSION.md'), md);

console.log(`  mission package ${package_sha256.slice(0, 16)}… · ${artifacts.length} artifacts · state ${stateBytes} B · unit ${pass}/${pass + fail}`);
