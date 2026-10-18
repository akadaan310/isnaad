# Migration and rollback

## What changed in files that existed before

Everything else is new and additive: `src/lib/universe/`,
`src/components/universe/`, `/universe`, `/api/universe/*`, `data/universe/`,
`tests/`, `docs/studio/`, and a few scripts.

| file | change | why |
|---|---|---|
| `src/components/cosmos/scene.tsx` | `setSize(w, h, false)` → `setSize(w, h, !legacyCanvas)` | the glitch fix; `?legacy-canvas` restores the old call |
| `src/components/studio.tsx` | optional `initial` prop (default هود ٢٩ as before) | the inspector opens the studio on a locus |
| `src/app/studio/page.tsx` | reads `?s=&a=` | same |
| `src/lib/engine/detectors.ts` | `stitchBetween` exported | the H2 test measures what the detector measures; behaviour unchanged (`npm run verify` passes) |
| `package.json` | scripts added: test, ingest:universe, hypotheses, mission, purl, test:browser | no dependency added |

Untouched: all of `data/corpus`, `data/index`, `data/sky`, `data/cosmos`,
`data/compositions`, every ingest script, the Supabase schema, both side
branches, and all history. The default branch was fast-forwarded from
`4c059a1` at the owner's instruction; nothing was force-pushed.

## Migrating a deployment

1. Nothing to configure: the app is open, as the original was.
2. No data migration: `data/universe/` is committed, and it can be rebuilt with
   `npm run ingest:universe`, which also re-proves the legacy preset.
3. Supabase: unchanged.

## Rollback

| to undo | do |
|---|---|
| everything | redeploy `4c059a1` (the default branch was fast-forwarded from it; nothing was rewritten) |
| only the glitch fix | open `/?legacy-canvas` for one view, or revert the 8-line hunk in `scene.tsx` |
| only the new studio | remove the `/universe` link; nothing else imports it |

To compare, open the old and new side by side: `/` is the original composite
field, and `/universe` is the full universe.
