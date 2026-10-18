# ISNAAD mission — offline package

> Fallback for a mission PURL that could not be created (blocker B1). Machine-readable: `mission.json`.
> Canonical package hash `93e1812fec7d4c705e8db875905ac96378e16124666bdd7a89e86b4f25632189`: sha256 over JSON.stringify of the package minus `package_sha256`, keys sorted recursively, compact, raw UTF-8. It is not the sha256 of the file.
> This package is committed in the commit after `built_from`: `git log -1 -- docs/studio/mission/mission.json`. Human entry point: `docs/studio/HANDOFF.md`.

- Repository: https://github.com/akadaan310/isnaad · branch `claude/new-session-g1qcwm`
- Baseline: `4c059a1691920a13ea973146e42518e83f31573c` · built from: `072323d0427fb512e08d49c08a9b3c4ce67a3111`
- Tests: unit 38 pass / 0 fail · exemplars ok · browser 32/32 (simulated)

## Objectives
- **O1** 100% corpus locus addressability, exact identity, zero silent omissions; legacy fixtures reconstructible — _met_
  - 6236/6236 āyāt placed
  - 352 unattributed āyāt on their own shell (were silently d=0.5)
  - legacy 1,000 re-derived with 0 mismatches
- **O2** Reproducible seeded flight paths, rendering provenance; one glitch cause isolated — _met (simulated devices only)_
  - voyage digest identical in Node and in Chromium for the same seed
  - half-screen glitch: setSize(w,h,false) in the legacy scene — reproduced at dpr 2/2.625/3, fixed, ?legacy-canvas keeps the repro
  - not yet confirmed on real Android hardware
- **O3** Guided auto mode for a first-time user, deep expert mode; usability failures captured — _partly met — no human first-time user has tried it yet_
  - 32/32 scripted browser checks
  - 8 usability failures found and logged; 7 fixed
- **O4** ≥5 novel geometric/interaction hypotheses with baselines and counterexamples — _met_
  - H1 refused
  - H2 refused
  - H3 refused
  - H4 refused
  - H5 refused
  - H6 supported
- **O5** Portable private replay and a truthful 7u handoff — _met locally; PURL publication blocked_
  - recordings export/verify/replay
  - fragment handoff round-trips in a fresh browser context
  - live PURL blocked: no verified identity on the service, no token

## Blockers
- **B1** No live mission PURL. GET /api/identity/config → available:false (PURL_OIDC_* not configured); only unverified guest principals exist; no PURL_TOKEN was provided. → Configure PURL identity or supply a Bearer token with resources:write, then: PURL_TOKEN=… npm run purl -- --execute
- **B2** No real-device measurements. This session has headless Chromium (SwiftShader) only. → Open /universe on the Android phone, fly 60 s, export the recording (المسجّل → صدّر JSON), add it to docs/studio/evidence/devices/
- **B3** No private hosting configured. No deployment credentials were provided and public deployment is out of scope. → Follow docs/studio/PRIVACY.md (set STUDIO_ACCESS_TOKEN before the first deploy)
- **B4** Open-dammatan mapping unconfirmed. U+065E→U+08F1 is an inference about the source convention. → A reader of the muṣḥaf confirms docs/studio/USABILITY.md §U5 before applying it to the legacy views

## Reproduce
- npm ci && npm test && npm run verify
- Browser (needs a build, a token and a Chromium path): `npm run build && STUDIO_ACCESS_TOKEN=t npm start & then CHROMIUM_PATH=<chromium or headless_shell> STUDIO_TOKEN=t node tests/browser/studio.mjs http://127.0.0.1:3000 /tmp/out a35fb9a1`
- npm run ingest:universe (only manifest.builtAt changes on a rerun)

## Next (same order as HANDOFF.md)
1. B2: record a real flight on the Android phone (/universe → المسجّل → صدّر JSON), save it in docs/studio/evidence/devices/, run npx tsx scripts/analyze-recording.ts on it — no credentials needed
2. B4: a reader of the muṣḥaf confirms the U+065E → U+08F1 display mapping; then apply it to the reader, player and composer
3. O3: one first-time human session (docs/studio/USABILITY.md, "For the first human session")
4. B1: with the owner’s token, PURL_TOKEN=… npm run purl -- --execute (private resource, verified by read-back)
5. B3: private hosting per docs/studio/PRIVACY.md

Previous mission PURL (https://purls-production.up.railway.app/p/resource_95a5662789076892fe698316): a different, earlier mission (PURLs × CGIT Hub launch). Read once, GET only, to learn the PURL contract; this mission does not continue, modify or claim it, and nothing here depends on reaching it.

Evidence named `simulated-*` came from headless Chromium on SwiftShader, not from a device.

**Next permitted operation:** B2: capture a real-device flight recording — no credentials required
