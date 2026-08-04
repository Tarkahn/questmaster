// Refresh-token session cookie for the Google authorization-code flow.
// Leading underscore keeps Vercel from turning this into its own route.
//
// The refresh token never reaches the browser as readable data: it is sealed
// with AES-256-GCM and stored in an httpOnly cookie, so JavaScript on the page
// can't read it (XSS can't steal it) and a leaked cookie is useless without
// SESSION_SECRET. The browser only ever holds short-lived access tokens.
import crypto from 'node:crypto'
import { Redis } from '@upstash/redis'

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

function readCookieValue(req) {
  const jar = req.headers.cookie || ''
  const hit = jar
    .split(';')
    .map(s => s.trim())
    .find(s => s.startsWith(`${COOKIE_NAME}=`))
  if (!hit) return null
  return unseal(decodeURIComponent(hit.slice(COOKIE_NAME.length + 1)))
}

// The cookie used to carry the refresh token itself, one private copy per
// device. Google does not guarantee that older refresh tokens survive when it
// issues a new one for the same account and client, so signing in on a second
// device could kill the first device's token — see the multi-device section of
// docs/google-auth-long-sessions.md. Now the cookie carries only the Google
// account id and the token lives in one shared server-side slot, so every
// device follows whichever token is currently valid.
//
// v1 cookies (raw refresh token) are still accepted so the change doesn't sign
// anyone out on deploy; they get upgraded to v2 on their next refresh.
export function readSession(req) {
  const raw = readCookieValue(req)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.v === 2 && parsed.sub) return { version: 2, sub: parsed.sub }
  } catch {
    // Not JSON — a v1 cookie holding the refresh token directly.
  }
  return { version: 1, refreshToken: raw }
}

export function setSessionCookie(req, res, sub) {
  const value = seal(JSON.stringify({ v: 2, sub }))
  res.setHeader('Set-Cookie', cookie(req, encodeURIComponent(value), MAX_AGE_S))
}

export function clearRefreshCookie(req, res) {
  res.setHeader('Set-Cookie', cookie(req, '', 0))
}

// The shared refresh-token slot. Sealed with the same key as the cookie, so a
// dump of the store on its own yields nothing usable without SESSION_SECRET.
let redis = null
if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  })
}

export function hasSharedStore() {
  return redis !== null
}

const storeKey = sub => `qm:rt:${sub}`

export async function putSharedRefreshToken(sub, refreshToken) {
  if (!redis) return false
  await redis.set(storeKey(sub), seal(refreshToken), { ex: MAX_AGE_S })
  return true
}

export async function getSharedRefreshToken(sub) {
  if (!redis) return null
  const sealed = await redis.get(storeKey(sub))
  return sealed ? unseal(sealed) : null
}

// Reading the account id out of Google's token response. The id_token comes
// straight from Google over TLS in a response to our own authenticated
// request, so decoding the payload is enough here — there's no third party in
// the middle whose signature we'd need to check. Falls back to the userinfo
// endpoint on the rare response that carries no id_token.
export async function googleAccountId({ id_token, access_token }) {
  if (id_token) {
    const payload = String(id_token).split('.')[1]
    if (payload) {
      try {
        const sub = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))?.sub
        if (sub) return sub
      } catch {
        // Fall through to userinfo.
      }
    }
  }
  if (!access_token) return null
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (!res.ok) return null
    return (await res.json())?.sub || null
  } catch {
    return null
  }
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
