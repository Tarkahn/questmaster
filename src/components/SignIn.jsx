export default function SignIn({ onClick }) {
  return (
    <div className="signin-screen">
      <div className="signin-card">
        <div className="app-logo">⚔️</div>
        <h1 className="app-title">QuestMaster</h1>
        <p className="app-tagline">Complete tasks. Build streaks. Level up your day.</p>
        <button className="signin-btn" onClick={onClick}>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
