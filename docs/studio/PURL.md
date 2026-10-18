# PURL — orientation, contract, and why there is no live mission PURL yet

## What was read (GET only), 2026-10-18

Outcomes are in `evidence/purl/probes.log`; response bodies are saved beside it.

| URL | HTTP | what it says |
|---|---|---|
| `/p/resource_95a5662789076892fe698316` | 200 html | the **previous** mission (version 15). Read only: not modified, not claimed, not continued |
| `/api/resources/resource_95a5…/manifest` | 200 `application/purl+json` | protocol `PURL/launch-1`; operations source/compile/build/run/publish/checkpoint/fork/propose/commit, all `available: false` to an anonymous reader; all need `active-principal` + `resources:write` (+ owner for most); every write carries `expected_version`; limits 64 KiB source/state/artifact |
| `/.well-known/purl` | 200 | endpoints; **`verified_login_available: false`**; "Public reading grants no mutation authority. Preview principals are explicitly unverified." |
| `/api/identity/config` | 200 | `available: false`; blockers: `PURL_OIDC_ISSUER`, `PURL_OIDC_CLIENT_ID`, `PURL_OIDC_CLIENT_SECRET` not configured; `guest_available: true` |
| `/api/resources` | 200 | `{"items":[]}` for an anonymous reader |
| `/api` | 404 | not a discovery surface |
| CGIT Hub `/` | 200 html | reachable; not used (optional, and nothing here needed it) |

The purl repo, branch `codex/purls-cgit-consumer` at `3755290`
(`docs/consumer-launch/HANDOFF.txt`), was also read, along with the service
source at the deployed revision `367e8ed` (`service/launch/resources.js`,
`http.js`). Creation contract:

```
POST /api/resources            Authorization: Bearer <token with resources:write>
{ title: 1–180 chars, kind: "mission", visibility: "private" | "public" (default private),
  source: native PURL source, state: JSON ≤ 64 KiB, tests: ≤ 20 {input, expected} }
```

The service rejects credentials in URL query strings and accepts Bearer
headers only.

**One write attempt, recorded:** an unauthenticated `POST /api/resources`
with a malformed body (two curl data flags concatenated by mistake). It was
rejected `400 invalid_json`, and nothing was created. No other write was made.

## Why no live mission PURL

Creating one needs an active principal with `resources:write`. The service has
no verified identity configured, and no token was provided. A guest preview
principal exists, but the service itself calls it unverified, and a mission
filed under it would not be attributable to Abed. So a live PURL would have
been faked in every sense that matters. It was not created. **Blocker B1.**

## What exists instead

- `docs/studio/mission/mission.json`: the offline, content-hashed mission
  package (objectives, progress by commit, every artifact's sha256, tests and
  results, sources, blockers, checkpoint, next permitted operation).
- `docs/studio/mission/mission.purl-state.json`: the same, bounded to fit the
  64 KiB `state` field.
- `docs/studio/mission/MISSION.md`: the plain-Markdown fallback.
- `npm run purl`: the adapter. It runs prepare → type-check against the
  reconstructed contract (`src/lib/universe/purl.ts`, `tests/purl.test.ts`) →
  execute → read back. Without `PURL_TOKEN` and `--execute` it is a dry run and
  writes nothing.

## Later publication, exactly

```bash
npm run mission                                  # rebuild the package at HEAD
PURL_TOKEN=<owner Bearer token> npm run purl -- --execute
```

This creates a **private** mission resource, then reads its continuity back and
compares the state. A mismatch exits non-zero. The receipt goes to
`docs/studio/mission/purl-receipt.json`, and every outcome is appended to
`evidence/purl/adapter-runs.log`. The adapter refuses public visibility,
credential-looking payloads, and credentials in URLs.

## Studio ↔ PURL

The studio does not depend on PURL. Handoffs work standalone (link fragment or
file). A PURL resource could later carry a handoff document in its `state`, so
7u could open a capability-scoped continuation. That needs the same token, and
is not built.
