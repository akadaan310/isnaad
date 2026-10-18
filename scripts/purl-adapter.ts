#!/usr/bin/env tsx
/* ===========================================================================
 *  purl-adapter.ts — publish this mission as a native PURL.
 *
 *  PURL's user is an AI, and authority is realized, not logged into: there is
 *  no sign-in and no token to supply. An agent asks the service for a
 *  principal (POST /api/identity/guest {kind:'agent'}, after the bootstrap
 *  CSRF from GET /api/identity/config) and receives a 30-minute session that
 *  carries resources:write. Everything below acts as that principal.
 *
 *    npm run purl                 prepare + type-check only, writes nothing
 *    npm run purl -- --execute    realize → create → compile → build → run →
 *                                 checkpoint → publish, reading every step back
 *
 *  Every mutation carries expected_version and an idempotency key; nothing is
 *  done on a GET's say-so; the session cookie and CSRF are held in memory and
 *  never written to disk or logs. The resource is public so that any later
 *  participant can read it after the session ends — it carries mission
 *  metadata, hashes and paths, never credentials or corpus text. The previous
 *  mission resource is never touched.
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

/** A minimal cookie jar: name → value, from Set-Cookie headers. */
class Session {
  private jar = new Map<string, string>();
  csrf = '';
  take(res: Response) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      if (value) this.jar.set(name, value);
      else this.jar.delete(name);
    }
  }
  headers(write: boolean, idem?: string): Record<string, string> {
    const h: Record<string, string> = { accept: 'application/json' };
    if (this.jar.size) h.cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    if (write) {
      h['content-type'] = 'application/json';
      if (this.csrf) h['x-csrf-token'] = this.csrf;
      if (idem) h['idempotency-key'] = idem;
    }
    return h;
  }
  async call(method: 'GET' | 'POST', p: string, body?: unknown, idem?: string) {
    const url = `${BASE}${p}`;
    if (urlCarriesCredential(url)) throw new Error('refusing: credential in URL');
    const res = await fetch(url, {
      method,
      headers: this.headers(method === 'POST', idem),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.take(res);
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    note(`${method} ${res.status} ${p}${json.error ? ' ' + JSON.stringify(json.error) : ''}`);
    return { status: res.status, ok: res.ok, json };
  }
}

type Resource = { id: string; version: number; visibility?: string; state?: unknown };
const resourceOf = (j: Record<string, unknown>) => (j.resource ?? j) as Resource;

async function main() {
  const execute = process.argv.includes('--execute');
  const state = JSON.parse(readFileSync(path.join(ROOT, 'docs', 'studio', 'mission', 'mission.purl-state.json'), 'utf8'));
  const body: PurlCreateBody = {
    title: 'ISNAAD · Private Immersive Research Studio · mission',
    kind: 'mission',
    visibility: 'private', // created private, published public at the end (see header)
    source: MISSION_SOURCE,
    state,
    tests: [],
  };
  const check = checkCreate(body);
  note(`type-check ${check.ok ? 'ok' : 'FAILED: ' + check.problems.join('; ')} (state ${JSON.stringify(state).length} chars)`);
  if (!check.ok) process.exit(1);
  if (!execute) {
    note('dry run (no --execute): nothing was written');
    return;
  }

  const s = new Session();
  const tag = String(state.package_sha256 ?? Date.now()).slice(0, 16);

  // 1. realize a principal — the bootstrap CSRF binds the request to this jar.
  const cfg = await s.call('GET', '/api/identity/config');
  s.csrf = String(cfg.json.csrf_token ?? '');
  const who = await s.call('POST', '/api/identity/guest', { kind: 'agent', csrf_token: s.csrf });
  if (!who.ok) process.exit(1);
  s.csrf = String(who.json.csrf_token ?? '');
  const identity = who.json.identity as { id?: string; kind?: string; scopes?: string[]; expiresAt?: string };
  note(`principal ${identity?.id} kind=${identity?.kind} scopes=${(identity?.scopes ?? []).join(',')} expires=${identity?.expiresAt}`);

  // 2. create.
  const created = await s.call('POST', '/api/resources', body, `isnaad-create-${tag}`);
  if (!created.ok) process.exit(1);
  let r = resourceOf(created.json);
  const id = r.id;
  const root = `/api/resources/${id}`;
  const step = async (name: string, extra: Record<string, unknown> = {}) => {
    const out = await s.call('POST', `${root}/${name}`, { expected_version: r.version, ...extra }, `isnaad-${name}-${tag}`);
    if (!out.ok) throw new Error(`${name} failed`);
    const next = (out.json.resource as Resource | undefined) ?? (await s.call('GET', `${root}`)).json.resource as Resource;
    if (next?.version) r = next;
    return out.json;
  };

  // 3. compile, build, run — the native execution of `input json | mission.inspect`.
  await step('compile');
  await step('build');
  const run = await step('run');
  const execution = (run.execution as { id?: string } | undefined)?.id;
  note(`execution queued ${execution ?? '(id not returned)'}`);

  // 4. checkpoint, then publish.
  await step('checkpoint', {
    summary: state.checkpoint.summary,
    next: state.checkpoint.next,
    evidence: [
      `https://github.com/akadaan310/isnaad/tree/${state.built_from}`,
      `https://github.com/akadaan310/isnaad/blob/claude/new-session-g1qcwm/docs/studio/mission/mission.json`,
      `package_sha256:${state.package_sha256}`,
    ],
  });
  await step('publish', { visibility: 'public' });

  // 5. read back as nobody — what a later participant will see.
  const anon = new Session();
  const manifest = await anon.call('GET', `${root}/manifest`);
  const cont = await anon.call('GET', `${root}/continuity`);
  const c = cont.json as { state?: unknown; resource?: { state?: unknown } };
  const persisted = c.state ?? c.resource?.state;
  const same = stateMatches(state, persisted);
  note(`anonymous read-back: manifest ${manifest.status}, continuity ${cont.status}, state ${same ? 'matches' : 'DOES NOT MATCH'}`);

  const receipt = {
    id,
    url: `${BASE}/p/${id}`,
    manifest: `${BASE}${root}/manifest`,
    continuity: `${BASE}${root}/continuity`,
    version: r.version,
    execution: execution ?? null,
    principal: { id: identity?.id, kind: identity?.kind, realized: 'POST /api/identity/guest {kind:agent}', expiresAt: identity?.expiresAt },
    state_verified_anonymously: same,
    package_sha256: state.package_sha256,
    at: new Date().toISOString(),
  };
  writeFileSync(path.join(ROOT, 'docs', 'studio', 'mission', 'purl-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  note(`mission PURL ${receipt.url}`);
  if (!same) process.exit(1);
}

main().catch((e) => {
  note(`adapter error: ${String(e)}`);
  process.exit(1);
});
