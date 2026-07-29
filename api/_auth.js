// Shared auth check for the Anthropic-backed endpoints (theme/habit/breakdown).
// Leading underscore keeps Vercel from turning this into its own route.
//
// Verifies the caller sent a live Google OAuth access token by asking Google's
// tokeninfo endpoint about it (no client secret needed — tokeninfo only reads
// public metadata for a token that's already been issued) and checking that
// the token's audience matches our own OAuth client, so a token minted for a
// different app can't be replayed against these endpoints.
export async function authenticate(req) {
  const header = req.headers.authorization || req.headers.Authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  const token = match?.[1]?.trim()
  if (!token) {
    return { ok: false, status: 401, message: 'Missing bearer token' }
  }

  const expectedAud = process.env.VITE_GOOGLE_CLIENT_ID
  if (!expectedAud) {
    console.error('VITE_GOOGLE_CLIENT_ID is not set — cannot verify token audience')
    return { ok: false, status: 500, message: 'Server misconfigured' }
  }

  let info
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`)
    if (!res.ok) {
      return { ok: false, status: 401, message: 'Invalid or expired token' }
    }
    info = await res.json()
  } catch {
    return { ok: false, status: 401, message: 'Unable to verify token' }
  }

  if (info.aud !== expectedAud) {
    return { ok: false, status: 401, message: 'Token audience mismatch' }
  }
  // tokeninfo already 400s on an expired token (caught above), but check the
  // field directly too in case Google ever returns 200 with a stale token.
  if (info.expires_in !== undefined && Number(info.expires_in) <= 0) {
    return { ok: false, status: 401, message: 'Token expired' }
  }
  if (!info.sub) {
    return { ok: false, status: 401, message: 'Token missing subject' }
  }

  return { ok: true, userId: info.sub }
}
