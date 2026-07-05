import { useState, useEffect, useRef } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { TIER_INFO, cycleTier } from '../utils/difficulty'
import { computeCoins } from '../utils/coinValue'
import { parseQuestTime, formatQuestTime, parseChecklist, formatDueDate } from '../utils/api'
import { playDiceRoll, playDiceLand, playQuestComplete, playCoinEarn } from '../utils/audio'
import { questUrgency } from '../utils/urgency'

export default function TaskItem({
  task, themedTitle, difficulty = 'normal', coinValue = 0, diceBonus = 0,
  revealMs = 5000,
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
  onEditSubtask,
  onSubtaskDragEnd,
  onAddSideQuests,
  onOpenChecklist,
  onDelete,
  dragHandleProps,
  isDated = false,
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
  // Subtasks only show the urgency bar when they have an explicit due date —
  // the staleness fallback is meaningless for steps under a parent quest.
  const urgency = isSub
    ? (task.due ? questUrgency(task, taskSeenMap) : null)
    : questUrgency(task, taskSeenMap)
  const locked = !isSub && subCount > 0 // must clear side quests before completing the parent
  // Plain checkoff list (e.g. grocery items) — purely for the user, doesn't
  // gate completion the way side quests do.
  const checklist = isSub ? [] : parseChecklist(task.notes)
  const checklistDone = checklist.filter(i => i.done).length

  function handleTitleTap() {
    if (!themedTitle || themedTitle === task.title) return // nothing to flip
    setRevealing(true)
    clearTimeout(revealTimerRef.current)
    revealTimerRef.current = setTimeout(() => setRevealing(false), revealMs)
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
        {urgency && (
          <div className="urgency-bar" title={urgency.label}>
            <div className={`urgency-bar-fill urgency-bar-fill--${urgency.tier}`} style={{ width: `${urgency.pct}%` }} />
          </div>
        )}
        {dragHandleProps && phase === 'idle' && (
          <span
            className="task-drag-handle"
            {...dragHandleProps}
            aria-label="Drag to reorder"
            title="Drag to reorder"
          >⠿</span>
        )}
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
                Due {formatDueDate(task.due)}
              </span>
            )}
            {parseQuestTime(task.notes) && (
              <span className="task-time">⏰ {formatQuestTime(parseQuestTime(task.notes))}</span>
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
            {phase === 'idle' && isSub && onEditSubtask && (
              <button
                type="button"
                className="item-edit-btn"
                onClick={e => { e.stopPropagation(); onEditSubtask(task) }}
                aria-label="Edit side quest"
              >
                ✏️
              </button>
            )}
          </div>
        </div>
        {/* Checklist + Side Quests — top-level quests only, own fixed-width
            column so a long title can't push these around and every card
            lines up the same regardless of content. */}
        {!isSub && phase === 'idle' && (
          <div className="task-actions-col">
            {onOpenChecklist && (
              <button
                type="button"
                className={`sidequest-toggle checklist-toggle${checklist.length === 0 ? ' sidequest-toggle--add' : ''}`}
                onClick={e => { e.stopPropagation(); onOpenChecklist() }}
              >
                📋 {checklist.length > 0 ? `${checklistDone}/${checklist.length} checked` : 'Checklist'}
              </button>
            )}
            {subCount > 0 ? (
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
            )}
          </div>
        )}
        {phase === 'done' && <span className="points-pop">+{earnedXP} XP</span>}
        {phase === 'done' && coinValue > 0 && <span className="coins-pop">+{coinValue} 🪙</span>}
      </div>

      {!isSub && subCount > 0 && expanded && (
        <DragDropContext onDragEnd={result => {
          const { source, destination } = result
          if (!destination || destination.index === source.index) return
          onSubtaskDragEnd?.(task.id, source.index, destination.index)
        }}>
          <Droppable droppableId={`subs-${task.id}`}>
            {(dropProvided) => (
              <div className="subtask-area" ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
                {subtasks.map((sub, index) => {
                  const subDiff = getEffectiveDifficulty(sub.id)
                  const isDatedSub = Boolean(sub.due)
                  return (
                    <Draggable key={sub.id} draggableId={sub.id} index={index} isDragDisabled={isDatedSub}>
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={dragSnapshot.isDragging ? 'task-dragging' : undefined}
                        >
                          <TaskItem
                            isSub
                            task={sub}
                            themedTitle={themedTitles[sub.id]}
                            difficulty={subDiff}
                            coinValue={computeCoins(sub.id, subDiff, taskSeenMap, characterClass)}
                            diceBonus={diceBonus}
                            onComplete={(id, total, coin, diff) => onCompleteSubtask(task.id, id, total, coin, diff)}
                            onDifficultyChange={onDifficultyChange}
                            onEditSubtask={onEditSubtask}
                            onDelete={() => onDeleteSubtask(task.id, sub.id)}
                            taskSeenMap={taskSeenMap}
                            dragHandleProps={isDatedSub ? null : dragProvided.dragHandleProps}
                          />
                        </div>
                      )}
                    </Draggable>
                  )
                })}
                {dropProvided.placeholder}
                {onAddSideQuests && (
                  <button type="button" className="subtask-add-more" onClick={onAddSideQuests}>
                    + Add more side quests
                  </button>
                )}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  )
}
