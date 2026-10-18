// ============================================================================
//  PURL — an optional adapter, and nothing the studio depends on.
//
//  The contract below was reconstructed on 2026-10-18 from the live service
//  (GET /.well-known/purl, GET …/manifest) and from its source at the deployed
//  revision (akadaan310/purl@367e8ed, service/launch/resources.js, http.js):
//
//    realize  GET /api/identity/config (bootstrap CSRF), then
//             POST /api/identity/guest {kind:'agent'} → a 30-minute agent
//             principal carrying resources:write. No sign-in, no token:
//             authority is realized by asking, not logged into.
//    create   POST /api/resources   (session cookie + x-csrf-token)
//             { title 1–180, source (native PURL), state ≤ 64 KiB JSON,
//               tests ≤ 20, kind: 'mission', visibility: 'private'|'public' }
//    read     GET  /api/resources/<id>/manifest | /continuity
//    write    every later mutation carries expected_version
//    never    credentials in a URL query (the service rejects them)
//
//  This module only prepares and type-checks. scripts/purl-adapter.ts is the
//  one place that performs a request, and only with an explicit --execute.
// ============================================================================

export const PURL_STATE_LIMIT = 65536;
/** The source form the published example mission uses. */
export const MISSION_SOURCE = 'input json | mission.inspect';

export interface PurlCreateBody {
  title: string;
  kind: 'mission';
  visibility: 'private' | 'public';
  source: string;
  state: unknown;
  tests: { input: unknown; expected: unknown }[];
}

export type Check = { ok: true } | { ok: false; problems: string[] };

const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;

/** Type-check a create body against the reconstructed contract. */
export function checkCreate(body: PurlCreateBody): Check {
  const problems: string[] = [];
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 180) problems.push('title must be 1–180 characters');
  if (body.kind !== 'mission') problems.push("kind must be 'mission'");
  if (!['private', 'public'].includes(body.visibility)) problems.push('visibility must be private or public');
  if (typeof body.source !== 'string' || !body.source.trim()) problems.push('source must be native PURL source');
  if (bytes(body.state) > PURL_STATE_LIMIT) problems.push(`state is ${bytes(body.state)} bytes; limit ${PURL_STATE_LIMIT}`);
  if (!Array.isArray(body.tests) || body.tests.length > 20) problems.push('at most 20 tests');
  if (body.tests.some((t) => !t || !('input' in t) || !('expected' in t))) problems.push('each test needs input and expected');
  const flat = JSON.stringify(body);
  if (/(?:sk-|ghp_|github_pat_|eyJhbGci|-----BEGIN)/.test(flat)) problems.push('payload appears to contain a credential');
  return problems.length ? { ok: false, problems } : { ok: true };
}

/** A URL may never carry a credential (the service enforces the same rule). */
export function urlCarriesCredential(u: string): boolean {
  try {
    const url = new URL(u);
    for (const k of url.searchParams.keys()) {
      if (/^(?:token|access_token|auth|key|api_key|apikey|bearer|password|client_secret)$/i.test(k)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

/** Read-back verification: the persisted state must equal what was sent. */
export function stateMatches(sent: unknown, readBack: unknown): boolean {
  const canon = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canon)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])]))
        : v;
  return JSON.stringify(canon(sent)) === JSON.stringify(canon(readBack));
}
