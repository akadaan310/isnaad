# ISNAAD mission — offline package

> Fallback for a mission PURL that could not be created (blocker B1). Machine-readable: `mission.json` (sha256 `5d35e04b425c31c76860d483826849c10f60d68175d6203999b33afe64b754d7`).

- Repository: https://github.com/akadaan310/isnaad · branch `claude/new-session-g1qcwm`
- Baseline: `4c059a1691920a13ea973146e42518e83f31573c` · built from: `e0589bde71bc387e84aadef53a3cf12ed3afa62f`
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

## Next
1. Read docs/studio/HANDOFF.md, then run: npm ci && npm test && npm run build
2. Next permitted operation: resolve B2 (real-device recording) — it needs no credentials
3. Then B4 (human confirmation), then B1 (PURL publication with the owner’s token)

**Next permitted operation:** B2: capture a real-device flight recording — no credentials required
