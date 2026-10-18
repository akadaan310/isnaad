# Openness

Nothing here is private. It is the Qur'an; the studio, the repository, the
data, the evidence and the mission PURL are all open to anyone.

- **No gate.** Every page and API route answers anyone. There is no login, no
  token, no middleware. (An access gate existed briefly in this branch and was
  removed at the owner's instruction.)
- **Deployment.** Vercel builds the default branch on every push. Nothing needs
  configuring.
- **Caching.** The universe API is cacheable (`public, max-age=3600`).
- **Gallery.** `/gallery` and the composer's publish are open, as in the
  original app.

## What stays on a device, and why

Research notes, bookmarks and the tour-seen flag live in the browser's
`localStorage`. That is not secrecy, just where a browser keeps per-device
conveniences. Any note can be exported as Markdown or JSON and shared.

## The handoff to 7u

A handoff is a small JSON document (locus, lens, camera, voyage code, an
optional note) with an integrity digest. It travels as a link (`#h=…`), as a
downloaded file, or as part of the mission PURL. Each handoff states plainly
what it is: a snapshot of a place and a route. It is not a live session, and it
does not make any external assistant "see" the app. A tampered handoff, or one
whose locus does not match its ordinal, is refused rather than repaired.

## PURL

PURL has no sign-in. Authority is realized: an agent asks for a principal and
receives one (PURL.md). The mission resource is published **public**.
