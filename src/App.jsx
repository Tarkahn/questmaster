import { useState, useEffect, useRef, useCallback } from 'react'
import Landing from './components/Landing'
import Dashboard from './components/Dashboard'
import useGoogleAuth from './hooks/useGoogleAuth'

const TOKEN_KEY = 'qm_token'
const TOKEN_EXPIRY_KEY = 'qm_token_expiry'
// Renew the token this far ahead of its expiry so the silent refresh always
// lands before Google invalidates it.
const REFRESH_BUFFER_MS = 5 * 60 * 1000

export default function App() {
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const refreshTimerRef = useRef(null)

  const handleToken = useCallback((accessToken, expiresIn) => {
    const expiry = Date.now() + expiresIn * 1000
    localStorage.setItem(TOKEN_KEY, accessToken)
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry))
    setToken(accessToken)
  }, [])

  const requestToken = useGoogleAuth(handleToken)

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
    if (stored && expiry && Date.now() < Number(expiry)) {
      setToken(stored)
    }
    setLoading(false)
  }, [])

  // Keep the session alive by silently renewing the access token before it
  // expires, instead of forcing the user back to the sign-in screen every hour.
  useEffect(() => {
    if (!token) return

    function scheduleRefresh() {
      clearTimeout(refreshTimerRef.current)
      const expiry = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || 0)
      const delay = Math.max(expiry - Date.now() - REFRESH_BUFFER_MS, 0)
      refreshTimerRef.current = setTimeout(() => {
        requestToken({ prompt: '' })
      }, delay)
    }

    function handleWake() {
      if (document.visibilityState !== 'visible') return
      const expiry = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || 0)
      if (Date.now() >= expiry - REFRESH_BUFFER_MS) {
        requestToken({ prompt: '' })
      } else {
        scheduleRefresh()
      }
    }

    scheduleRefresh()
    document.addEventListener('visibilitychange', handleWake)
    window.addEventListener('focus', handleWake)
    return () => {
      clearTimeout(refreshTimerRef.current)
      document.removeEventListener('visibilitychange', handleWake)
      window.removeEventListener('focus', handleWake)
    }
  }, [token, requestToken])

  function handleSignOut() {
    clearTimeout(refreshTimerRef.current)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
    setToken(null)
  }

  if (loading) return null

  return token
    ? <Dashboard token={token} onSignOut={handleSignOut} />
    : <Landing onClick={() => requestToken({})} />
}
