// Public landing page shown at "/" for signed-out visitors. Doubles as the
// Google OAuth verification home page (app name, description, privacy link)
// and the sign-in entry point. The Google token client itself lives in
// useGoogleAuth (owned by App) so the same client can silently renew the
// token later — this component just fires the flow via onClick.
export default function Landing({ onClick }) {
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
        <button className="signin-btn" onClick={onClick}>
          Sign in with Google
        </button>
        <a className="signin-privacy-link" href="/privacy.html" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>
      </div>
    </div>
  )
}
