// Mints a fresh access token from the stored refresh token. Called on page
// load to resume a session, and again shortly before each access token expires.
//
// This replaces the old hidden-iframe silent renewal, which depended on a
// third-party Google session cookie and broke under Chrome's cookie
// restrictions and Safari ITP — a server-side refresh has no such dependency.
import { readRefreshToken, clearRefreshCookie, googleTokenRequest } from './_session.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const refreshToken = readRefreshToken(req)
  if (!refreshToken) {
    return res.status(401).json({ error: 'No session' })
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

  const { access_token, expires_in } = result.data
  return res.status(200).json({ access_token, expires_in })
}
