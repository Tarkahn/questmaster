import { useState, useEffect, useRef } from 'react'
import { TIER_INFO, cycleTier } from '../utils/difficulty'

const REVEAL_MS = 10000

export default function TaskItem({ task, themedTitle, difficulty = 'normal', onComplete, onDifficultyChange }) {
  const [phase, setPhase] = useState('idle') // idle | rolling | done
  const [displayNum, setDisplayNum] = useState(null)
  const [earnedXP, setEarnedXP] = useState(null)
  const [revealing, setRevealing] = useState(false)
  const intervalRef = useRef(null)
  const revealTimerRef = useRef(null)

  useEffect(() => () => {
    clearInterval(intervalRef.current)
    clearTimeout(revealTimerRef.current)
  }, [])

  const tier = TIER_INFO[difficulty] || TIER_INFO.normal

  function handleTitleTap() {
    if (!themedTitle || themedTitle === task.title) return // nothing to flip
    setRevealing(true)
    clearTimeout(revealTimerRef.current)
    revealTimerRef.current = setTimeout(() => setRevealing(false), REVEAL_MS)
  }

  function handleClick() {
    if (phase !== 'idle') return
    setPhase('rolling')

    let count = 0
    intervalRef.current = setInterval(() => {
      setDisplayNum(Math.ceil(Math.random() * 20))
      count++
      if (count >= 18) {
        clearInterval(intervalRef.current)
        const roll = Math.ceil(Math.random() * 20)
        const total = roll + tier.d20Bonus
        setDisplayNum(roll)
        setEarnedXP(total)
        setPhase('done')
        onComplete(task.id, total)
      }
    }, 55)
  }

  function handleDifficultyClick(e) {
    e.stopPropagation()
    onDifficultyChange(task.id, task.title, cycleTier(difficulty))
  }

  const hasThemed = Boolean(themedTitle) && themedTitle !== task.title
  const displayTitle = (hasThemed && !revealing) ? themedTitle : task.title

  return (
    <div className={`task-item${phase === 'done' ? ' task-done' : ''}`}>
      <div className="d20-wrap">
        <button
          className={`task-d20${phase === 'rolling' ? ' task-d20--rolling' : ''}${phase === 'done' ? ' task-d20--done' : ''}`}
          onClick={handleClick}
          disabled={phase !== 'idle'}
          aria-label="Roll to complete quest"
        >
          <span className="d20-inner">
            {phase === 'idle' && '◆'}
            {phase === 'rolling' && displayNum}
            {phase === 'done' && '✓'}
          </span>
        </button>
      </div>
      <div className="task-content">
        <button
          type="button"
          className={`task-title${phase === 'done' ? ' task-title--done' : ''}${revealing ? ' task-title--original' : ''}${hasThemed ? ' task-title--flippable' : ''}`}
          onClick={handleTitleTap}
          disabled={!hasThemed || phase !== 'idle'}
          aria-label={revealing ? 'Showing original task' : (hasThemed ? 'Tap to reveal original task' : undefined)}
        >
          {displayTitle}
        </button>
        <div className="task-meta">
          {task.due && (
            <span className="task-due">
              Due {new Date(task.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <button
            className={`difficulty-badge difficulty-badge--${difficulty}`}
            onClick={handleDifficultyClick}
            disabled={phase !== 'idle'}
            aria-label={`Difficulty: ${tier.label}. Tap to change.`}
          >
            {tier.emoji} {tier.label}{tier.d20Bonus > 0 ? ` +${tier.d20Bonus}` : ''}
          </button>
        </div>
      </div>
      {phase === 'done' && <span className="points-pop">+{earnedXP} XP</span>}
    </div>
  )
}
