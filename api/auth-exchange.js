// Step 2 of sign-in: trade the one-time authorization code from the Google
// popup for tokens. The access token goes back to the browser; the refresh
// token stays here, sealed in an httpOnly cookie.
import { setRefreshCookie, googleTokenRequest } from './_session.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const code = req.body?.code
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' })
  }

  const result = await googleTokenRequest({
    code,
    grant_type: 'authorization_code',
    // Required literal when the code came from the GIS popup code client
    // rather than a redirect — there is no real redirect URI to send.
    redirect_uri: 'postmessage',
  })

  if (!result.ok) {
    return res.status(result.status).json({ error: result.error })
  }

  const { access_token, expires_in, refresh_token } = result.data

  // Google only returns a refresh token when the user actually passes through
  // the consent screen. The client asks for prompt:'consent' precisely so this
  // is present — if it isn't, sign-in "works" but the long session silently
  // wouldn't, so say so rather than leaving the user to discover it in an hour.
  if (!refresh_token) {
    return res.status(200).json({
      access_token,
      expires_in,
      persistent: false,
      warning: 'Google did not issue a refresh token, so this session ends when the access token expires.',
    })
  }

  setRefreshCookie(req, res, refresh_token)
  return res.status(200).json({ access_token, expires_in, persistent: true })
}
