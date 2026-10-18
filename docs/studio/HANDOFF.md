# ISNAAD studio — start here

**Live:** https://isnaad-bice.vercel.app/universe (the original field at `/`). Open to anyone.

**Resumable checkpoint.** The machine-readable state is
`docs/studio/mission/mission.json`, with `MISSION.md` as the plain fallback.
The mission PURL is published by `npm run purl -- --execute` (PURL.md, B1).

- Repository: `akadaan310/isnaad` · branch `claude/new-session-g1qcwm`
- Baseline: `4c059a1`. The default branch `claude/quran-isnad-explorer-prototype-0ml0tp` has since been fast-forwarded to this work and deploys to Vercel on every push
- Commits: `git log 4c059a1..claude/new-session-g1qcwm`

## Run it

```bash
npm ci
npm test                 # 33 unit/property tests (node:test via tsx)
npm run verify           # the three exemplar passages, unchanged
npm run dev              # http://localhost:3000/universe   (open in dev)
# production:
npm run build && npm start
```

Browser checks need Chromium. In this container that is the headless shell:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell \
node tests/browser/studio.mjs http://127.0.0.1:3000 /tmp/shots a35fb9a1
```

Rebuild derived data: `npm run ingest:universe` (also re-proves the legacy
thousand), `npm run hypotheses`, `npm run mission`.

## Where things are

| | |
|---|---|
| `/universe` | the new studio: all 6,236 āyāt, the two lenses, voyage, recorder, handoff |
| `/` | the original composite field (the thousand), preserved; glitch fixed |
| `src/lib/universe/` | placement, relations, voyage, recorder, handoff, PURL adapter: pure and tested |
| `docs/studio/GLITCH.md` | the half-screen glitch: root cause, reproduction, fix |
| `docs/studio/HYPOTHESES.md` | six tested claims, 1 supported and 5 refused, including the master metric's limit |
| `docs/studio/USABILITY.md` | eight observed failures (seven fixed), and what only a person can test |
| `docs/studio/PERFORMANCE.md` | simulated-device numbers, and how to get real ones |
| `docs/studio/OPENNESS.md` | everything open; what the handoff does and does not do |
| `docs/studio/MIGRATION.md` | what changed in old files, and how to roll back |
| `docs/studio/COMPARISON.md` | original vs new |
| `docs/studio/BASELINE.md` | the pinned baseline and architecture map |
| `docs/studio/evidence/` | screenshots, recordings, probe logs, hypothesis output, sample voyage |

## Observed vs inferred

**Observed** in this session:
- Every count in the manifest, and the legacy reconstruction (0 mismatches).
- All test results.
- The glitch, in simulated devices.
- The voyage digest matching between Node and Chromium.
- The PURL HTTP outcomes.
- The missing glyph.
- The usability failures.

**Inferred**, and marked as such where it appears:
- That the simulated glitch is the one seen on the phone.
- That U+065E is open dammatan.
- Why the desktop renders slower than the phone under software rendering.

## Next permitted operations, in order

1. **B2.** Record a real flight on the Android phone (المسجّل → صدّر JSON) and run
   `npx tsx scripts/analyze-recording.ts`. No credentials are needed. This tells
   us whether the glitch is gone there.
2. **B4.** A reader of the muṣḥaf confirms the U+065E → U+08F1 display mapping;
   then apply it to the reader, the player and the composer.
3. **O3.** One first-time human session (USABILITY.md, "For the first human
   session").
4. **B1.** `npm run purl -- --execute`: no token. It realizes an agent principal,
   publishes the public mission PURL, and verifies by anonymous read-back.

Not permitted without the owner: any history rewrite, any change to SNAD or
FALAK, any change to the previous mission resource.
