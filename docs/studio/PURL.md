# PURL — contract, authority, and publishing this mission

## What was read (GET only), 2026-10-18

Outcomes are in `evidence/purl/probes.log`; response bodies are saved beside it.

| URL | HTTP | what it says |
|---|---|---|
| `/p/resource_95a5662789076892fe698316` | 200 | the **previous** mission (v15): read once for the contract, never modified or claimed |
| `/api/resources/resource_95a5…/manifest` | 200 `application/purl+json` | protocol `PURL/launch-1`; operations source/compile/build/run/publish/checkpoint/fork/propose/commit; writes carry `expected_version`; 64 KiB limits |
| `/.well-known/purl` | 200 | endpoints and authority statement |
| `/api/identity/config` | 200 | bootstrap `csrf_token`; `guest_available: true`. Its `available:false` / `PURL_OIDC_*` concern a future *claim-your-identity* feature, not the authority to write |
| `/api/resources` | 200 | listing |
| `/api` | 404 | not a discovery surface |
| CGIT Hub `/` | 200 | reachable; not needed |

Source read: `akadaan310/purl` at `codex/purls-cgit-consumer` (`3755290`),
including `service/launch/identity.js` and `resources.js`.

## Authority: realized, not logged into

PURL's user is an AI. There is no sign-in and no token. An agent realizes a
principal by asking for one:

```
GET  /api/identity/config                → bootstrap csrf_token + cookie
POST /api/identity/guest {kind:"agent"}  → session cookie (30 min) + bound csrf_token;
                                           scopes include resources:write
POST /api/resources …                    → cookie + x-csrf-token header
```

The create contract is
`{title 1–180, kind: "mission", visibility, source (native PURL), state ≤ 64 KiB, tests ≤ 20}`.
Credentials never go in URLs; the service rejects them there.

An earlier version of this page said a token and a verified login were
required. That was wrong and has been removed.

## Publishing (B1)

```bash
npm run mission                 # rebuild the package at HEAD
npm run purl -- --execute       # realize → create (public) → compile → build →
                                # run → checkpoint → publish → anonymous read-back
```

Each mutation carries `expected_version` and an idempotency key. The receipt
goes to `docs/studio/mission/purl-receipt.json`, and every HTTP outcome is
appended to `evidence/purl/adapter-runs.log`. The resource is public, like
everything in this project. After the 30-minute principal lapses, anyone
continues it by `fork` or `propose` under their own realized principal.
Without `--execute` the adapter is a dry run that writes nothing.

**Status.** In the authoring session the publishing run was stopped by that
coding environment's tool-permission policy, not by PURL. Until it runs,
`docs/studio/mission/` (`mission.json`, `mission.purl-state.json`, and
`MISSION.md` as plain fallback) is the handoff, and
`mission.purl-state.json` is exactly what will be published.

**Recorded mistake:** one early `POST /api/resources` carried a malformed body
(two curl data flags concatenated) and was rejected `400 invalid_json`;
nothing was created.

## Studio ↔ PURL

The studio does not depend on PURL. Handoffs work as a link or a file. A PURL
resource could later carry a handoff document in its `state`, so 7u could
open it as a continuation. That is not built.
