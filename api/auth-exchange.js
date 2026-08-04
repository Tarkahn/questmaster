// Step 2 of sign-in: trade the one-time authorization code from the Google
// popup for tokens. The access token goes back to the browser; the refresh
// token stays here, sealed in the shared server-side store, with the browser
// holding only an httpOnly cookie naming the Google account it belongs to.
import {
  setSessionCookie,
  googleTokenRequest,
  googleAccountId,
  putSharedRefreshToken,
} from './_session.js'

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

  const { access_token, expires_in, refresh_token, id_token } = result.data

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

  // Everything from here needs to know which Google account the token belongs
  // to, so all this user's devices can share one slot.
  const sub = await googleAccountId({ id_token, access_token })
  if (!sub) {
    return res.status(200).json({
      access_token,
      expires_in,
      persistent: false,
      warning: 'Could not identify the Google account, so this session ends when the access token expires.',
    })
  }

  const stored = await putSharedRefreshToken(sub, refresh_token)
  if (!stored) {
    // No shared store configured. Rather than silently fall back to a
    // per-device token — the exact arrangement that logs the other device out
    // — say so, because the cause is a missing env var, not anything the user
    // can fix by signing in again.
    return res.status(200).json({
      access_token,
      expires_in,
      persistent: false,
      warning: 'Session storage is not configured on the server, so this session ends when the access token expires.',
    })
  }

  setSessionCookie(req, res, sub)
  return res.status(200).json({ access_token, expires_in, persistent: true })
}
