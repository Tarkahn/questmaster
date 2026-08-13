import { useState } from 'react'

// Waits for a tap instead of auto-dismissing on a timer. iOS refuses to play
// any audio before the first user gesture, so an automatic splash meant every
// launch sat silent until the user happened to touch something. Requiring the
// tap here harvests that gesture at the earliest possible moment — the
// document-level BGM unlock listeners (Dashboard) catch it, so the music is
// already playing as the dashboard fades in. Tap-to-enter is the standard
// game-title pattern for exactly this reason.
export default function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false)

  function enter() {
    if (fading) return
    setFading(true)
    setTimeout(onDone, 600)
  }

  return (
    <div
      className={`splash${fading ? ' splash--fade' : ''}`}
      onPointerDown={enter}
      role="button"
      tabIndex={0}
      aria-label="Enter QuestMaster"
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') enter() }}
    >
      <div className="splash-inner">
        <div className="splash-emblem">⚔️</div>
        <h1 className="splash-title">QuestMaster</h1>
        <p className="splash-tagline">Your adventure awaits...</p>
        <p className="splash-tap">· tap to enter the realm ·</p>
      </div>
    </div>
  )
}
