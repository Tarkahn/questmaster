import { useEffect, useState } from 'react'

export default function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1900)
    const doneTimer = setTimeout(onDone, 2500)
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer) }
  }, [onDone])

  return (
    <div className={`splash${fading ? ' splash--fade' : ''}`}>
      <div className="splash-inner">
        <div className="splash-emblem">⚔️</div>
        <h1 className="splash-title">QuestMaster</h1>
        <p className="splash-tagline">Your adventure awaits...</p>
      </div>
    </div>
  )
}
