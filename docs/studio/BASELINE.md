# Baseline — what existed before this mission

Recorded read-only before any change.

## Pinned commit

`4c059a1691920a13ea973146e42518e83f31573c`, *الرِّحلة — one realm, no chrome,
and bodies at the scale of places* (2026-09-14). It is the head of the default
branch `claude/quran-isnaad-explorer-prototype-0ml0tp`, and this mission's
branch `claude/new-session-g1qcwm` started from it.

## Branches (read, not merged, not modified)

| branch | head | relation to baseline |
|---|---|---|
| `claude/quran-isnaad-explorer-prototype-0ml0tp` (default) | `4c059a1` | = baseline |
| `claude/nav-computed-relationships-af4xla` | `db345c3` | +1 commit on the baseline: الالتقاء, navigation by convergence (`lib/cosmos/convergence.ts`, `iltiqa.tsx`, +1,819 lines) |
| `claude/computational-universe-api-aksppy` | `f7b2937` | forked at `b49bbd4`: الفهرس, FIHRIS/1 request protocol over the codebase (`docs/fihris.json`, +5,001 lines) |

Neither is merged here. Both remain intact, and both are compatible in
principle: الالتقاء could run over `data/universe/relations.json`, and the
فهرس could index `src/lib/universe`.

## Baseline checks, as run

- `npx tsc --noEmit`: clean.
- `npm run verify`: all checks passed (هود ٢٩ استحضار 0.940, تقابل النواسخ 0.660;
  ق ٢ رجع الجذر 0.808; القصص ٥ جسر النبأ 1.000, رباط 0.535; 77 nested frames).
- `npm run verify:cosmos`: all checks passed (1000/6236 āyāt; 2474/8209 motif
  occurrences; 2500 of 7057 discoveries retained in the index; 282 رِباط
  displacements).

## Architecture map

```
data/                      committed, 11.2 MB; the app needs no network or DB
  corpus/<n>.txt           QAC v0.4 morphology rows (mustafa0x/quran-morphology)
  corpus/meta.json         names, types, Uthmani text (risan/quran-json)
  index/                   ayaat (6,236 rows), roots (1,651), motifs (400),
                           discoveries (top 2,500 of 7,057), aalam, manifest
  sky/                     5,044 stars, 89 constellation figures; Gaia fits
  cosmos/nodes.json        THE THOUSAND: TARGET=1000, ≤29/sūrah, ≥3 words
src/lib/
  corpus.ts isnad.ts       build a sūrah from rows; isnād spine, seams, vectors
  engine/                  8 detectors, frames, motifs (suffix automaton),
                           graph, assembler, aalam miner
  cosmos/                  placement (radius = discourse distance), locus join,
                           strands, coverage, basis, voyage, device, immersion,
                           stellar/chroma (Gaia), morphogen, textures
src/components/
  cosmos/scene.tsx         / — الكون: WebGL field of the thousand + sky shell
  cosmos/rihla-scene.tsx   /rihla — immersive recitation-paced travel
  studio.tsx reader.tsx    /studio — three-pane morphology studio
  composer.tsx furqan/     /compose /gallery /watch — compositions
scripts/                   ingest-*, verify-*, compare-basis, find-structures
supabase/                  optional schema; JSON files otherwise
```

Rendering: three.js r169, custom `ShaderMaterial` points and lines with
additive blending, no depth writes, Arabic labels as a DOM pool positioned
from projected 3D.

## Defects found in the baseline (all recorded, none hidden)

1. `scene.tsx` `setSize(w, h, false)`: the half-screen glitch (GLITCH.md).
2. `distanceOf()` returns 0.5 for zero person mass, which silently seats 352
   āyāt on the المتكلم shell. None of the 352 is in the legacy thousand
   (checked against the flags), so the defect matters only once every āyah is
   placed.
3. The Amiri Quran subset lacks U+065E (USABILITY.md U5).
4. الرحلة (`/rihla`) is not replay-deterministic: it starts at a
   `Math.random()` āyah (`rihla-scene.tsx:475`), and dust and bodies are seeded
   the same way (`rihla-scene.tsx:302–306`, `body-field.ts:176,208`). Not
   changed; the new voyage is seeded instead.
