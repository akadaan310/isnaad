# Privacy and access

The studio is private by default, and nothing in it is shared unless a person
does the sharing.

## The gate (`src/middleware.ts`, rule in `src/lib/access.ts`, tests in `tests/access.test.ts`)

| situation | result |
|---|---|
| `next dev` on your machine, no token set | open (development) |
| any server with `STUDIO_ACCESS_TOKEN` set | HTTP Basic (any username, the token as password) or `Authorization: Bearer <token>`; otherwise **401** |
| production with **no** token | **503 for everything**, with a message saying how to configure it |
| production with `STUDIO_ALLOW_PUBLIC=1` | open: an explicit operator choice, never a default |

The gate covers every page and API route, including `/gallery` and the
composer's publish. "Public gallery" therefore means *visible to token
holders* unless someone deliberately opens the whole studio. Responses carry
`x-robots-tag: noindex, nofollow` and `referrer-policy: no-referrer`; the
universe API also sends `cache-control: private, no-store`. Tokens are compared
in constant time.

Verified against the production build (`next start`): anonymous 401, wrong
token 401, Basic 200, Bearer 200, gallery anonymous 401, no-token
configuration 503.

## Private deployment plan (not executed: no hosting credentials were given)

1. Choose a host that runs Node (any Next.js host). Set
   `STUDIO_ACCESS_TOKEN` to a long random value **before** the first deploy,
   for example `openssl rand -base64 32`.
2. Deploy over HTTPS only (Basic credentials must never cross plain HTTP).
3. Give the token to Abed and 7u by a channel you trust. To revoke it, change
   the variable and redeploy.
4. Compositions: on a read-only serverless filesystem, saving needs Supabase
   (README). Supabase keys stay server-side; the studio never sends them to the
   browser beyond the public anon key the original app already used.

## What stays on the device

Research notes, bookmarks and the tour-seen flag live in `localStorage`, per
browser and per device. Flight recordings live in memory until exported.
Nothing is uploaded.

## The handoff to 7u

A handoff is a small JSON document (locus, lens, camera, voyage code, an
optional note) with an integrity digest. It travels only in ways the user
starts:

- **Link:** encoded in the URL fragment (`/universe#h=…`). Browsers do not send
  fragments to servers, so the studio's host never sees the content. The link
  only opens for someone who can pass the gate.
- **File:** a downloaded `.json` the user attaches wherever they choose.
- **PURL:** optional, private, and only with the owner's token (PURL.md).

The document states its own limits, and the recipient sees them: it gives no
live access to the app, it lets no external assistant (ChatGPT or any other)
"see" the session, and it is sent nowhere unless the user sends it. A tampered
handoff, or one whose locus does not match its ordinal, is refused rather than
repaired.

## Not done

There is no opt-in live collaboration and no presence. Building either needs a
real supported integration and an explicit consent design, and neither is
pretended here.
