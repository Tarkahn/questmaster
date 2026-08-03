// Refresh-token session cookie for the Google authorization-code flow.
// Leading underscore keeps Vercel from turning this into its own route.
//
// The refresh token never reaches the browser as readable data: it is sealed
// with AES-256-GCM and stored in an httpOnly cookie, so JavaScript on the page
// can't read it (XSS can't steal it) and a leaked cookie is useless without
// SESSION_SECRET. The browser only ever holds short-lived access tokens.
import crypto from 'node:crypto'

const COOKIE_NAME = 'qm_rt'
// Google refresh tokens for a published app don't expire on a fixed schedule,
// so this is just an upper bound on how long we'll try to resume a session.
const MAX_AGE_S = 180 * 24 * 60 * 60

function sessionKey() {
  const raw = process.env.SESSION_SECRET
  if (!raw) throw new Error('SESSION_SECRET is not set')
  const buf = Buffer.from(raw, 'base64')
  if (buf.length !== 32) {
    throw new Error('SESSION_SECRET must be 32 random bytes, base64-encoded')
  }
  return buf
}

// A fresh random IV per seal, with the GCM auth tag kept alongside so unseal
// can detect tampering rather than returning garbage.
function seal(value) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey(), iv)
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), enc].map(b => b.toString('base64url')).join('.')
}

function unseal(sealed) {
  const parts = String(sealed).split('.')
  if (parts.length !== 3) return null
  try {
    const [iv, tag, enc] = parts.map(p => Buffer.from(p, 'base64url'))
    const decipher = crypto.createDecipheriv('aes-256-gcm', sessionKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
  } catch {
    // Wrong key, tampered payload, or a cookie sealed under a rotated secret.
    return null
  }
}

// `vercel dev` serves over plain http on localhost, where a Secure cookie is
// silently dropped — so only set Secure once we're actually on a real host.
function isLocalhost(req) {
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host || '')
}

function cookie(req, value, maxAge) {
  const flags = [
    `${COOKIE_NAME}=${value}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAge}`,
  ]
  if (!isLocalhost(req)) flags.splice(2, 0, 'Secure')
  return flags.join('; ')
}

export function readRefreshToken(req) {
  const jar = req.headers.cookie || ''
  const hit = jar
    .split(';')
    .map(s => s.trim())
    .find(s => s.startsWith(`${COOKIE_NAME}=`))
  if (!hit) return null
  return unseal(decodeURIComponent(hit.slice(COOKIE_NAME.length + 1)))
}

export function setRefreshCookie(req, res, refreshToken) {
  res.setHeader('Set-Cookie', cookie(req, encodeURIComponent(seal(refreshToken)), MAX_AGE_S))
}

export function clearRefreshCookie(req, res) {
  res.setHeader('Set-Cookie', cookie(req, '', 0))
}

// Shared by auth-exchange and auth-refresh: both POST form-encoded bodies to
// the same Google token endpoint and differ only in grant parameters.
export async function googleTokenRequest(params) {
  const clientId = process.env.VITE_GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return { ok: false, status: 500, error: 'Server misconfigured: missing Google client credentials' }
  }

  let res
  let data
  try {
    res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...params, client_id: clientId, client_secret: clientSecret }),
    })
    data = await res.json()
  } catch {
    return { ok: false, status: 502, error: 'Could not reach Google' }
  }

  if (!res.ok) {
    return {
      ok: false,
      status: 401,
      // invalid_grant means the refresh token is dead — revoked, expired, or
      // issued while the consent screen was still in Testing mode.
      code: data?.error,
      error: data?.error_description || data?.error || 'Google rejected the request',
    }
  }
  return { ok: true, data }
}
