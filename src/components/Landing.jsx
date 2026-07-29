import { useEffect, useRef } from 'react'

// Public landing page shown at "/" for signed-out visitors. Doubles as the
// Google OAuth verification home page (app name, description, privacy link)
// and the sign-in entry point — the button below fires the real Google OAuth
// flow directly, with no separate intermediate screen.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPES = [
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.appdata',
  'email',
  'profile',
].join(' ')

export default function Landing({ onSignIn }) {
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
      <div className="signin-card landing-card">
        <div className="app-logo">⚔️</div>
        <h1 className="app-title">QuestMaster</h1>
        <p className="app-tagline">Complete tasks. Build streaks. Level up your day.</p>
        <p className="landing-description">
          QuestMaster is a gamified quest tracker that turns your real to-dos into a
          D&amp;D-style adventure. It syncs with your own Google Tasks and Google Calendar,
          so your quests are your actual tasks and events — complete them to earn XP,
          gold, and streaks. AI-powered features theme your tasks into quest titles and
          suggest subtask breakdowns, while your progress syncs privately across devices
          through your Google Drive.
        </p>
        <button className="signin-btn" onClick={handleClick}>
          Sign in with Google
        </button>
        <a className="signin-privacy-link" href="/privacy.html" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>
      </div>
    </div>
  )
}
