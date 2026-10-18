# Closing demonstration — a fresh participant, offline package only

**When:** 2026-10-18, on a clean clone of `claude/new-session-g1qcwm` at
`bd0f9a0`.
**Who:** a fresh agent with no prior context, given only the path to
`docs/studio/mission/MISSION.md`. It was told not to modify, push, build, or
write to the network.
**Why the offline package:** there is no live mission PURL (blocker B1).

## Succeeded

- **Reconstructed the state:** O1 and O4 met; O2 met on simulated devices
  only; O3 partly met; O5 met locally. Blockers B1–B4 named correctly.
- **Integrity:** recomputed `package_sha256` (`5d35e04b…`) and it matched.
  Checked **all 110** artifact hashes and byte counts against both the working
  tree and `git show e0589bd:<path>`. All matched.
- **Ran evidence:** `npm test` gave 38 pass, 0 fail. It confirmed the manifest
  counts and the dry-run line "Nothing was written" in the adapter log.
- **Next permitted operation:** B2 (real-device recording, no credentials).
  It also listed what is not permitted without the owner.

## Failed or unclear, and what was done

| finding | fix |
|---|---|
| MISSION.md called the canonical package hash "sha256" of `mission.json`. The file hash differs, and the canonicalisation rule had to be inferred from source | MISSION.md and `hash_rule` now state the rule and say it is not the file hash |
| The package lives one commit after `built_from`, and no package file says so | `package_location` gives the `git log` command |
| The next-steps order differed between MISSION.md (B2→B4→B1) and HANDOFF.md (B2→B4→O3→B1→B3) | one list, generated in HANDOFF.md's order |
| `docs/studio/evidence/devices/` did not exist | created, with naming and procedure |
| `phone-recording.json` read like real-device evidence | renamed `simulated-*-recording.json` |
| The relation to the old mission PURL was unexplained | stated: an earlier, different mission, read once for the contract, not continued |
| The browser checks could not be reproduced from the package alone | `reproduce.browser` gives the commands (a build, a token and a Chromium path are inherent) |
| HANDOFF.md did not name the default branch | named |
| The session's CLAUDE.md belongs to another repository (substrateIO) | outside this repo; noted in the session report, not changed here |

The package was rebuilt after these fixes. The digests in `mission.json`
supersede the ones quoted above.
