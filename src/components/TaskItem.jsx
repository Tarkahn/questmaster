import { useState, useEffect, useRef } from 'react'
import { TIER_INFO, cycleTier } from '../utils/difficulty'
import { computeCoins } from '../utils/coinValue'
import { playDiceRoll, playDiceLand, playQuestComplete, playCoinEarn } from '../utils/audio'

const REVEAL_MS = 10000

export default function TaskItem({
  task, themedTitle, difficulty = 'normal', coinValue = 0, diceBonus = 0,
  onComplete, onDifficultyChange, onEdit,
  // Side-quest props (top-level quests only)
  isSub = false,
  subtasks = [],
  themedTitles = {},
  getEffectiveDifficulty,
  taskSeenMap,
  characterClass,
  onCompleteSubtask,
  onDeleteSubtask,
  onAddSideQuests,
  onDelete,
}) {
  const [phase, setPhase] = useState('idle') // idle | rolling | done
  const [displayNum, setDisplayNum] = useState(null)
  const [earnedXP, setEarnedXP] = useState(null)
  const [revealing, setRevealing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const intervalRef = useRef(null)
  const revealTimerRef = useRef(null)

  useEffect(() => () => {
    clearInterval(intervalRef.current)
    clearTimeout(revealTimerRef.current)
  }, [])

  const tier = TIER_INFO[difficulty] || TIER_INFO.normal
  const subCount = subtasks.length
  const locked = !isSub && subCount > 0 // must clear side quests before completing the parent

  function handleTitleTap() {
    if (!themedTitle || themedTitle === task.title) return // nothing to flip
    setRevealing(true)
    clearTimeout(revealTimerRef.current)
    revealTimerRef.current = setTimeout(() => setRevealing(false), REVEAL_MS)
  }

  function handleClick() {
    if (phase !== 'idle' || locked) return
    setPhase('rolling')
    playDiceRoll()

    let count = 0
    intervalRef.current = setInterval(() => {
      setDisplayNum(Math.ceil(Math.random() * 20))
      count++
      if (count >= 18) {
        clearInterval(intervalRef.current)
        const roll = Math.ceil(Math.random() * 20)
        const total = roll + tier.d20Bonus + diceBonus
        setDisplayNum(roll)
        setEarnedXP(total)
        setPhase('done')
        playDiceLand()
        playQuestComplete()
        if (coinValue > 0) setTimeout(playCoinEarn, 280)
        onComplete(task.id, total, coinValue, difficulty)
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
    <div className={`task-block${isSub ? ' task-block--sub' : ''}`}>
      <div className={`task-item${phase === 'done' ? ' task-done' : ''}${isSub ? ' task-item--sub' : ''}`}>
        <div className="d20-wrap">
          <button
            className={`task-d20${phase === 'rolling' ? ' task-d20--rolling' : ''}${phase === 'done' ? ' task-d20--done' : ''}${locked ? ' task-d20--locked' : ''}`}
            onClick={handleClick}
            disabled={phase !== 'idle' || locked}
            aria-label={locked ? 'Complete all side quests first' : 'Roll to complete quest'}
            title={locked ? 'Complete all side quests first' : undefined}
          >
            <span className="d20-inner">
              {locked && phase === 'idle' && '🔒'}
              {!locked && phase === 'idle' && (isSub ? '◇' : '◆')}
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
            {phase === 'idle' && !isSub && onEdit && (
              <button
                type="button"
                className="item-edit-btn"
                onClick={e => { e.stopPropagation(); onEdit() }}
                aria-label="Edit quest"
              >
                ✏️
              </button>
            )}
            {phase === 'idle' && isSub && onDelete && (
              <button
                type="button"
                className="item-edit-btn"
                onClick={e => { e.stopPropagation(); onDelete() }}
                aria-label="Remove side quest"
              >
                🗑
              </button>
            )}
            {/* Side-quest controls — top-level quests only */}
            {!isSub && phase === 'idle' && (
              subCount > 0 ? (
                <button
                  type="button"
                  className="sidequest-toggle"
                  onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
                  aria-expanded={expanded}
                >
                  ⚡ {subCount} side quest{subCount === 1 ? '' : 's'} {expanded ? '▲' : '▼'}
                </button>
              ) : (
                onAddSideQuests && (
                  <button
                    type="button"
                    className="sidequest-toggle sidequest-toggle--add"
                    onClick={e => { e.stopPropagation(); onAddSideQuests() }}
                  >
                    ⚡ Side Quests
                  </button>
                )
              )
            )}
          </div>
        </div>
        {phase === 'done' && <span className="points-pop">+{earnedXP} XP</span>}
        {phase === 'done' && coinValue > 0 && <span className="coins-pop">+{coinValue} 🪙</span>}
      </div>

      {!isSub && subCount > 0 && expanded && (
        <div className="subtask-area">
          {subtasks.map(sub => {
            const subDiff = getEffectiveDifficulty(sub.id)
            return (
              <TaskItem
                key={sub.id}
                isSub
                task={sub}
                themedTitle={themedTitles[sub.id]}
                difficulty={subDiff}
                coinValue={computeCoins(sub.id, subDiff, taskSeenMap, characterClass)}
                diceBonus={diceBonus}
                onComplete={(id, total, coin, diff) => onCompleteSubtask(task.id, id, total, coin, diff)}
                onDifficultyChange={onDifficultyChange}
                onDelete={() => onDeleteSubtask(task.id, sub.id)}
              />
            )
          })}
          {onAddSideQuests && (
            <button
              type="button"
              className="subtask-add-more"
              onClick={onAddSideQuests}
            >
              + Add more side quests
            </button>
          )}
        </div>
      )}
    </div>
  )
}
