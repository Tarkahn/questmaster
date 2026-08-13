import { useState } from 'react'

// BGM starts on its own via the muted→unmuted autoplay trick in Dashboard's
// audio effect, so no tap is required for sound to begin under this screen.
// The button is a real button — only it responds to a tap, not the whole
// screen — and doubles as the iOS audio-unlock fallback (Dashboard's
// document-level gesture listeners) for the rare case, e.g. Low Power Mode,
// where even muted autoplay gets blocked.
export default function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false)

  function enter() {
    if (fading) return
    setFading(true)
    setTimeout(onDone, 600)
  }

  return (
    <div className={`splash${fading ? ' splash--fade' : ''}`}>
      <div className="splash-inner">
        <div className="splash-emblem">⚔️</div>
        <h1 className="splash-title">QuestMaster</h1>
        <p className="splash-tagline">Your adventure awaits...</p>
        <button type="button" className="splash-enter-btn" onPointerDown={enter} onClick={enter}>
          ⚔️ Enter the Realm
        </button>
      </div>
    </div>
  )
}
