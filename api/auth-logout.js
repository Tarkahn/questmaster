// Ends the session: tells Google to revoke the grant, then drops the cookie.
// The cookie is cleared even if revocation fails, so a network hiccup at
// Google's end can't leave the user stuck in a session they asked to end.
import { readRefreshToken, clearRefreshCookie } from './_session.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const refreshToken = readRefreshToken(req)
  if (refreshToken) {
    try {
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: refreshToken }),
      })
    } catch {
      // Ignored on purpose — see note above.
    }
  }

  clearRefreshCookie(req, res)
  return res.status(200).json({ ok: true })
}
