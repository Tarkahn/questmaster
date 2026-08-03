# Google auth: staying signed in

## Why the old setup timed out

`useGoogleAuth` used `google.accounts.oauth2.initTokenClient` — the **implicit
flow**. It issues access tokens that live exactly one hour and it cannot issue a
refresh token. There is no configuration that makes those tokens last longer.

`App.jsx` worked around that by silently re-requesting a token five minutes
before expiry (`requestAccessToken({ prompt: '' })`). Two problems:

1. **Silent renewal reads a Google session cookie from a hidden iframe.**
   Chrome's third-party cookie restrictions and Safari ITP block exactly this.
   When blocked, renewal just fails.
2. **The failure was invisible.** The token client had no `error_callback`, and
   the success path was `if (response.access_token)`. A failed renewal did
   nothing at all — the app kept the expired token, every Google API call
   started returning 401, and it looked like an abrupt logout.

## What replaced it

The **authorization-code flow** with a server-held refresh token:

1. `initCodeClient` opens the Google popup, which returns a one-time code.
2. `POST /api/auth-exchange` trades that code for an access token *and* a
   refresh token, using the client secret. The refresh token is sealed with
   AES-256-GCM and set as an httpOnly cookie. It never reaches page JavaScript.
3. `POST /api/auth-refresh` mints a new access token from that cookie — on page
   load, on a timer before expiry, and whenever the app returns to the
   foreground. No iframes, no third-party cookies, so nothing for the browser
   to block.
4. `POST /api/auth-logout` revokes the grant at Google and clears the cookie.

Access tokens are no longer written to `localStorage`; they live in memory only,
so an XSS bug can't steal a stored token. Failures now surface on the sign-in
screen instead of failing silently.

Session length is bounded by the refresh token, which for a **published** app
does not expire on a fixed schedule. In practice this means staying signed in
until you explicitly sign out or revoke access in your Google account.

## Required setup

### Environment variables

Both must be set in Vercel (Project → Settings → Environment Variables) for
**Production and Preview**. Vercel classifies them as sensitive and blocks
sensitive values from the Development environment, since that environment can be
pulled down to a local machine — so for local work, put them in `.env` by hand
instead.

| Variable | Value |
| --- | --- |
| `GOOGLE_CLIENT_SECRET` | Google no longer lets you view an existing client secret — only its last 4 characters. Use **+ Add secret** on the OAuth client to mint a new one, which is displayed once at creation. A client can hold several secrets at a time, so adding one does not break the existing one. |
| `SESSION_SECRET` | 32 random bytes, base64. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

After the new client secret is confirmed working, **Disable** the old one (this
is reversible) and delete it only once nothing has broken.

`VITE_GOOGLE_CLIENT_ID` must also cover **Preview**, not just Production. Vite
inlines `VITE_*` values at build time, so a Preview build without it ships an
empty client ID — `initCodeClient` then throws "Missing required parameter
client_id" inside a React effect, React unmounts the tree, and the deployment
renders as a blank page. The hook now guards this and shows a message instead,
but the variable still has to be present for sign-in to work at all.

### Google Cloud Console

- **Publishing status must be "In production", not "Testing."** While an app is
  in Testing, Google expires every refresh token after **7 days** regardless of
  what the code does. Checked on 2026-08-03: this project is already **In
  production**, so it was not the cause of the short sessions — but it's the
  first thing to re-check if long sessions ever regress.
- The OAuth client must be of type **Web application**, with the site's origin
  listed under **Authorized JavaScript origins** (production domain, plus
  `http://localhost:5173` and `http://localhost:3000` for local work). The popup
  code flow exchanges against the literal `postmessage` redirect URI, so no
  extra redirect URI registration is needed.

## Testing locally

`npm run dev` alone is not enough — the `api/*` routes don't run under Vite. Use:

```
vercel dev
```

with `GOOGLE_CLIENT_SECRET` and `SESSION_SECRET` in `.env`. On localhost the
session cookie is set without the `Secure` flag, since plain http would
otherwise drop it.

## Verifying it works

1. Sign in. The consent screen should appear (`prompt: 'consent'` is deliberate
   — it's what makes Google return a refresh token).
2. In DevTools → Application → Cookies, confirm a `qm_rt` cookie exists, marked
   HttpOnly.
3. Close the tab, wait past the hour mark, and reopen. You should land straight
   in the dashboard with no sign-in prompt.

If sign-in reports "Google did not issue a refresh token," the consent screen
was skipped — revoke the app at
[myaccount.google.com/permissions](https://myaccount.google.com/permissions) and
sign in again.
