import { useState, useEffect, useRef } from 'react'
import { TIER_INFO, cycleTier } from '../utils/difficulty'
import { playDiceRoll, playDiceLand, playMissionClaim, playCoinEarn } from '../utils/audio'

const REVEAL_MS = 10000

export default function EventItem({ event, themedTitle, claimed, difficulty = 'normal', coinValue = 0, onClaim, onUnclaim, onDifficultyChange, onEdit }) {
  const [phase, setPhase] = useState(claimed ? 'done' : 'idle') // idle | rolling | done
  const [displayNum, setDisplayNum] = useState(null)
  const [earnedXP, setEarnedXP] = useState(null)
  const [revealing, setRevealing] = useState(false)
  const intervalRef = useRef(null)
  const revealTimerRef = useRef(null)

  useEffect(() => () => {
    clearInterval(intervalRef.current)
    clearTimeout(revealTimerRef.current)
  }, [])

  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime)
  const tier = TIER_INFO[difficulty] || TIER_INFO.normal
  const originalTitle = event.summary || '(No title)'
  const hasThemed = Boolean(themedTitle) && themedTitle !== originalTitle

  function handleTitleTap() {
    if (!hasThemed) return
    setRevealing(true)
    clearTimeout(revealTimerRef.current)
    revealTimerRef.current = setTimeout(() => setRevealing(false), REVEAL_MS)
  }

  function formatTime(dt) {
    return new Date(dt).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    })
  }

  const timeLabel = isAllDay
    ? 'All day'
    : `${formatTime(event.start?.dateTime)} – ${formatTime(event.end?.dateTime)}`

  const displayTitle = (hasThemed && !revealing) ? themedTitle : originalTitle

  function handleClaim() {
    if (phase !== 'idle') return
    setPhase('rolling')
    playDiceRoll()

    let count = 0
    intervalRef.current = setInterval(() => {
      setDisplayNum(Math.ceil(Math.random() * 10))
      count++
      if (count >= 14) {
        clearInterval(intervalRef.current)
        const roll = Math.ceil(Math.random() * 10)
        const total = roll + tier.d10Bonus
        setDisplayNum(roll)
        setEarnedXP(total)
        setPhase('done')
        playDiceLand()
        playMissionClaim()
        if (coinValue > 0) setTimeout(playCoinEarn, 280)
        onClaim(event.id, total, coinValue)
      }
    }, 60)
  }

  function handleDifficultyClick(e) {
    e.stopPropagation()
    onDifficultyChange(event.id, event.summary || '', cycleTier(difficulty))
  }

  const runeChar = phase === 'rolling' ? displayNum : phase === 'done' ? '✦' : 'ᚱ'

  return (
    <div className={`event-item${phase === 'done' ? ' event-item--done' : ''}`}>
      <div className={`rune-outer${phase === 'done' ? ' rune-outer--done' : ''}${phase === 'rolling' ? ' rune-outer--rolling' : ''}`}>
        <button
          className="event-rune"
          onClick={handleClaim}
          disabled={phase !== 'idle'}
          aria-label="Claim mission XP"
        >
          <span className="rune-inner">{runeChar}</span>
        </button>
      </div>
      <div className="event-content">
        <div className="event-time">{timeLabel}</div>
        <button
          type="button"
          className={`event-title${phase === 'done' ? ' event-title--done' : ''}${revealing ? ' event-title--original' : ''}${hasThemed ? ' event-title--flippable' : ''}`}
          onClick={handleTitleTap}
          disabled={!hasThemed || phase !== 'idle'}
          aria-label={revealing ? 'Showing original event' : (hasThemed ? 'Tap to reveal original event' : undefined)}
        >
          {displayTitle}
        </button>
        <div className="event-meta">
          <button
            className={`difficulty-badge difficulty-badge--${difficulty}`}
            onClick={handleDifficultyClick}
            disabled={phase !== 'idle'}
            aria-label={`Difficulty: ${tier.label}. Tap to change.`}
          >
            {tier.emoji} {tier.label}{tier.d10Bonus > 0 ? ` +${tier.d10Bonus}` : ''}
          </button>
          {phase === 'idle' && onEdit && (
            <button
              type="button"
              className="item-edit-btn"
              onClick={e => { e.stopPropagation(); onEdit() }}
              aria-label="Edit mission"
            >
              ✏️
            </button>
          )}
        </div>
      </div>
          {phase === 'done' && onUnclaim && (
        <button
          className="event-unclaim-btn"
          onClick={e => {
            e.stopPropagation()
            onUnclaim(event.id)
            setPhase('idle')
            setEarnedXP(null)
            setDisplayNum(null)
          }}
          aria-label="Unclaim mission"
        >↩</button>
      )}
      {phase === 'done' && <span className="points-pop points-pop--rune">+{earnedXP} XP</span>}
      {phase === 'done' && coinValue > 0 && <span className="coins-pop coins-pop--rune">+{coinValue} 🪙</span>}
    </div>
  )
}
