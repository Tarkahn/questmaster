// Mints a fresh access token from the stored refresh token. Called on page
// load to resume a session, and again shortly before each access token expires.
//
// This replaces the old hidden-iframe silent renewal, which depended on a
// third-party Google session cookie and broke under Chrome's cookie
// restrictions and Safari ITP — a server-side refresh has no such dependency.
import {
  readSession,
  clearRefreshCookie,
  googleTokenRequest,
  googleAccountId,
  getSharedRefreshToken,
  putSharedRefreshToken,
  setSessionCookie,
} from './_session.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = readSession(req)
  if (!session) {
    return res.status(401).json({ error: 'No session' })
  }

  // v2 reads the shared slot, so a device picks up whatever token the most
  // recent sign-in on any device left there. v1 cookies still carry their own
  // copy and get migrated below once this refresh succeeds.
  const refreshToken =
    session.version === 2
      ? await getSharedRefreshToken(session.sub)
      : session.refreshToken

  if (!refreshToken) {
    // Signed out on every device, or the store entry aged out.
    clearRefreshCookie(req, res)
    return res.status(401).json({ error: 'Session expired — please sign in again' })
  }

  const result = await googleTokenRequest({
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  if (!result.ok) {
    // The refresh token is gone for good (revoked in the Google account, or
    // expired because the consent screen is still in Testing mode, which caps
    // refresh tokens at 7 days). Drop the cookie so the app stops retrying and
    // sends the user back to a clean sign-in.
    if (result.code === 'invalid_grant') {
      clearRefreshCookie(req, res)
      return res.status(401).json({ error: 'Session expired — please sign in again' })
    }
    return res.status(result.status).json({ error: result.error })
  }

  const { access_token, expires_in, refresh_token, id_token } = result.data

  // Google usually returns no refresh token on a refresh, but hands one back
  // when it rotates. Storing it keeps every device on the live one.
  const sub =
    session.version === 2
      ? session.sub
      : await googleAccountId({ id_token, access_token })

  if (sub && refresh_token && refresh_token !== refreshToken) {
    await putSharedRefreshToken(sub, refresh_token)
  }

  // Migrate a v1 device onto the shared slot on its first refresh, so it stops
  // depending on its own private copy surviving.
  if (session.version === 1 && sub) {
    const seeded = await putSharedRefreshToken(sub, refresh_token || refreshToken)
    if (seeded) setSessionCookie(req, res, sub)
  }

  return res.status(200).json({ access_token, expires_in })
}
