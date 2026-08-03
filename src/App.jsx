import { useState, useEffect, useRef, useCallback } from 'react'
import Landing from './components/Landing'
import Dashboard from './components/Dashboard'
import useGoogleAuth from './hooks/useGoogleAuth'

// Renew this far ahead of expiry so a slow network can't let the token lapse
// mid-request.
const REFRESH_BUFFER_MS = 5 * 60 * 1000
// Legacy keys from the old implicit flow. Access tokens are no longer kept in
// localStorage at all — they live in memory and are re-minted from the
// server-side refresh token, so an XSS bug can't walk off with a stored token.
const LEGACY_KEYS = ['qm_token', 'qm_token_expiry']

export default function App() {
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  const expiryRef = useRef(0)
  const timerRef = useRef(null)

  const applyToken = useCallback((accessToken, expiresIn) => {
    expiryRef.current = Date.now() + expiresIn * 1000
    setToken(accessToken)
    setAuthError(null)
  }, [])

  const endSession = useCallback(() => {
    clearTimeout(timerRef.current)
    expiryRef.current = 0
    setToken(null)
  }, [])

  // Ask the server for a fresh access token off the refresh-token cookie.
  // Returns false when there's no usable session, which is the signal to fall
  // back to the sign-in screen instead of sitting on a dead token.
  const refresh = useCallback(async (opts = {}) => {
    try {
      const res = await fetch('/api/auth-refresh', {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        endSession()
        if (opts.announce) setAuthError(data.error || 'Session expired — please sign in again')
        return false
      }
      const data = await res.json()
      applyToken(data.access_token, data.expires_in)
      return true
    } catch {
      // Offline or the function is down. Keep the current token — it may still
      // be valid — and let the next wake-up retry.
      return false
    }
  }, [applyToken, endSession])

  const handleCode = useCallback(async (code) => {
    try {
      const res = await fetch('/api/auth-exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sign-in failed')
      applyToken(data.access_token, data.expires_in)
      if (data.warning) setAuthError(data.warning)
    } catch (err) {
      endSession()
      setAuthError(err.message)
    }
  }, [applyToken, endSession])

  const requestCode = useGoogleAuth({ onCode: handleCode, onError: setAuthError })

  // Resume on load. No token is persisted client-side any more, so a cold start
  // always goes through the refresh endpoint.
  useEffect(() => {
    LEGACY_KEYS.forEach(k => localStorage.removeItem(k))
    let cancelled = false
    ;(async () => {
      await refresh()
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [refresh])

  useEffect(() => {
    if (!token) return

    function schedule() {
      clearTimeout(timerRef.current)
      const delay = Math.max(expiryRef.current - Date.now() - REFRESH_BUFFER_MS, 0)
      timerRef.current = setTimeout(() => { refresh({ announce: true }) }, delay)
    }

    // Timers don't fire reliably in a backgrounded tab or a sleeping PWA, so
    // re-check whenever the app comes back to the foreground.
    function handleWake() {
      if (document.visibilityState !== 'visible') return
      if (Date.now() >= expiryRef.current - REFRESH_BUFFER_MS) refresh({ announce: true })
      else schedule()
    }

    schedule()
    document.addEventListener('visibilitychange', handleWake)
    window.addEventListener('focus', handleWake)
    return () => {
      clearTimeout(timerRef.current)
      document.removeEventListener('visibilitychange', handleWake)
      window.removeEventListener('focus', handleWake)
    }
  }, [token, refresh])

  async function handleSignOut() {
    clearTimeout(timerRef.current)
    try {
      await fetch('/api/auth-logout', { method: 'POST', credentials: 'same-origin' })
    } catch {
      // Cookie clearing is best-effort; drop the local session regardless.
    }
    endSession()
    setAuthError(null)
  }

  if (loading) return null

  return token
    ? <Dashboard token={token} onSignOut={handleSignOut} />
    : <Landing onClick={requestCode} error={authError} />
}
