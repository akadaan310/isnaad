#!/usr/bin/env tsx
/* ===========================================================================
 *  purl-adapter.ts — prepare → type-check → (execute → read back).
 *
 *    npm run purl                      dry run: discovery GET, prepare, check
 *    PURL_TOKEN=… npm run purl -- --execute
 *                                      create a PRIVATE mission resource, then
 *                                      GET it back and compare the state
 *
 *  It never runs a mutation without both a token and --execute, never puts a
 *  credential in a URL, never publishes publicly, and never touches the
 *  previous mission resource. Every outcome is appended to
 *  docs/studio/evidence/purl/adapter-runs.log.
 * ======================================================================== */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MISSION_SOURCE, checkCreate, stateMatches, urlCarriesCredential, type PurlCreateBody } from '../src/lib/universe/purl';

const BASE = process.env.PURL_BASE ?? 'https://purls-production.up.railway.app';
const ROOT = process.cwd();
const LOG = path.join(ROOT, 'docs', 'studio', 'evidence', 'purl', 'adapter-runs.log');
const note = (s: string) => {
  const line = `${new Date().toISOString()} ${s}`;
  console.log('  ' + line);
  appendFileSync(LOG, line + '\n');
};

async function main() {
  const execute = process.argv.includes('--execute');
  const token = process.env.PURL_TOKEN?.trim();

  // 1. discovery — GET only, grants nothing.
  const wk = `${BASE}/.well-known/purl`;
  let discovery: { identity?: { verified_login_available?: boolean }; protocol?: string } = {};
  try {
    const r = await fetch(wk);
    note(`GET ${r.status} ${wk}`);
    discovery = await r.json();
  } catch (e) {
    note(`GET failed ${wk}: ${String(e)} — continuing offline`);
  }

  // 2. prepare — the compact state from the offline mission package.
  const state = JSON.parse(readFileSync(path.join(ROOT, 'docs', 'studio', 'mission', 'mission.purl-state.json'), 'utf8'));
  const body: PurlCreateBody = {
    title: 'ISNAAD · Private Immersive Research Studio · mission',
    kind: 'mission',
    visibility: 'private',
    source: MISSION_SOURCE,
    state,
    tests: [],
  };

  // 3. type-check.
  const check = checkCreate(body);
  note(`type-check ${check.ok ? 'ok' : 'FAILED: ' + check.problems.join('; ')} (state ${JSON.stringify(state).length} chars)`);
  if (!check.ok) process.exit(1);

  if (!execute || !token) {
    const why = !token ? 'no PURL_TOKEN' : 'no --execute';
    note(`dry run — ${why}; protocol ${discovery.protocol ?? 'unknown'}, verified login available: ${discovery.identity?.verified_login_available ?? 'unknown'}. Nothing was written.`);
    return;
  }

  // 4. execute.
  const url = `${BASE}/api/resources`;
  if (urlCarriesCredential(url)) throw new Error('refusing: credential in URL');
  const idem = `isnaad-mission-${state.package_sha256?.slice(0, 16) ?? Date.now()}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'idempotency-key': idem },
    body: JSON.stringify(body),
  });
  const created = (await r.json().catch(() => ({}))) as { resource?: { id: string; version: number }; error?: unknown };
  note(`POST ${r.status} ${url} ${created.resource ? created.resource.id : JSON.stringify(created.error ?? {})}`);
  if (!r.ok || !created.resource) process.exit(1);

  // 5. read back — a write is not done until it is read.
  const id = created.resource.id;
  const back = await fetch(`${BASE}/api/resources/${id}/continuity`, { headers: { authorization: `Bearer ${token}` } });
  const cont = (await back.json().catch(() => ({}))) as { state?: unknown; resource?: { state?: unknown } };
  const persisted = cont.state ?? cont.resource?.state;
  const same = stateMatches(state, persisted);
  note(`GET ${back.status} …/${id}/continuity — state ${same ? 'matches' : 'DOES NOT MATCH'} what was sent`);
  writeFileSync(path.join(ROOT, 'docs', 'studio', 'mission', 'purl-receipt.json'), JSON.stringify({ id, url: `${BASE}/p/${id}`, version: created.resource.version, verified: same, at: new Date().toISOString() }, null, 2) + '\n');
  if (!same) process.exit(1);
}

main().catch((e) => {
  note(`adapter error: ${String(e)}`);
  process.exit(1);
});
