import { useState, useEffect } from 'react'
import SignIn from './components/SignIn'
import Dashboard from './components/Dashboard'

const TOKEN_KEY = 'qm_token'
const TOKEN_EXPIRY_KEY = 'qm_token_expiry'

export default function App() {
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
    if (stored && expiry && Date.now() < Number(expiry)) {
      setToken(stored)
    }
    setLoading(false)
  }, [])

  function handleSignIn(accessToken, expiresIn) {
    const expiry = Date.now() + expiresIn * 1000
    localStorage.setItem(TOKEN_KEY, accessToken)
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry))
    setToken(accessToken)
  }

  function handleSignOut() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
    setToken(null)
  }

  if (loading) return null

  return token
    ? <Dashboard token={token} onSignOut={handleSignOut} />
    : <SignIn onSignIn={handleSignIn} />
}
