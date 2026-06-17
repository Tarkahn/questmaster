import { useEffect, useRef } from 'react'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPES = [
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.appdata',
  'email',
  'profile',
].join(' ')

export default function SignIn({ onSignIn }) {
  const clientRef = useRef(null)

  useEffect(() => {
    function initClient() {
      clientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          if (response.access_token) {
            onSignIn(response.access_token, response.expires_in)
          }
        },
      })
    }

    if (window.google) {
      initClient()
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval)
          initClient()
        }
      }, 100)
      return () => clearInterval(interval)
    }
  }, [onSignIn])

  function handleClick() {
    clientRef.current?.requestAccessToken()
  }

  return (
    <div className="signin-screen">
      <div className="signin-card">
        <div className="app-logo">⚔️</div>
        <h1 className="app-title">QuestMaster</h1>
        <p className="app-tagline">Complete tasks. Build streaks. Level up your day.</p>
        <button className="signin-btn" onClick={handleClick}>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
