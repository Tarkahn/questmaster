import { useState, useRef, useEffect } from 'react'
import { isCompletedToday } from '../utils/habits'

export default function BossCard({ habit, onComplete, onPause, onResume, onDelete, onReset }) {
  const [checking, setChecking] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const menuRef = useRef(null)

  const { boss, themedTitle, lastNarrative, totalCompletions, status } = habit
  const hpPct = (boss.currentHP / boss.maxHP) * 100
  const completedToday = isCompletedToday(habit)
  const defeated = status === 'defeated'
  const paused = status === 'paused'

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
        setConfirmDelete(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  function hpColor() {
    if (hpPct > 60) return 'var(--green)'
    if (hpPct > 25) return 'var(--gold)'
    return 'var(--fire)'
  }

  async function handleCheckIn() {
    if (completedToday || checking || defeated || paused) return
    setChecking(true)
    await onComplete(habit.id)
    setChecking(false)
  }

  function handleMenuAction(action) {
    setMenuOpen(false)
    setConfirmDelete(false)
    setConfirmRestart(false)
    if (action === 'pause') onPause(habit.id)
    if (action === 'resume') onResume(habit.id)
    if (action === 'delete') onDelete(habit.id)
    if (action === 'restart') onReset(habit.id)
  }

  return (
    <div className={`boss-card${defeated ? ' boss-card--defeated' : ''}${paused ? ' boss-card--paused' : ''}`}>
      <div className="boss-header">
        <div className="boss-name-wrap">
          <span className="boss-emoji">{defeated ? '💀' : paused ? '⏸' : '🐉'}</span>
          <div>
            <div className="boss-name">{boss.name}</div>
            <div className="boss-habit">{themedTitle}</div>
          </div>
        </div>
        <div className="boss-header-right">
          <div className="boss-hp-label">
            {defeated ? 'DEFEATED' : paused ? 'PAUSED' : `${boss.currentHP} / ${boss.maxHP} HP`}
          </div>
          <div className="boss-menu-wrap" ref={menuRef}>
            <button
              className="boss-menu-btn"
              onClick={() => { setMenuOpen(o => !o); setConfirmDelete(false) }}
              aria-label="Habit options"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="boss-menu-dropdown">
                {!defeated && !paused && (
                  <button className="boss-menu-item" onClick={() => handleMenuAction('pause')}>
                    ⏸ Pause
                  </button>
                )}
                {paused && (
                  <button className="boss-menu-item" onClick={() => handleMenuAction('resume')}>
                    ▶ Resume
                  </button>
                )}
                {!confirmRestart ? (
                  <button
                    className="boss-menu-item boss-menu-item--danger"
                    onClick={() => { setConfirmDelete(false); setConfirmRestart(true) }}
                  >
                    ↺ Restart
                  </button>
                ) : (
                  <button
                    className="boss-menu-item boss-menu-item--confirm"
                    onClick={() => handleMenuAction('restart')}
                  >
                    Confirm Restart
                  </button>
                )}
                {!confirmDelete ? (
                  <button
                    className="boss-menu-item boss-menu-item--danger"
                    onClick={() => { setConfirmRestart(false); setConfirmDelete(true) }}
                  >
                    🗑 Delete
                  </button>
                ) : (
                  <button
                    className="boss-menu-item boss-menu-item--confirm"
                    onClick={() => handleMenuAction('delete')}
                  >
                    Confirm Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="boss-hp-track">
        <div
          className="boss-hp-fill"
          style={{ width: `${hpPct}%`, background: paused ? 'var(--muted)' : hpColor() }}
        />
      </div>

      {lastNarrative && (
        <p className="boss-narrative">{lastNarrative}</p>
      )}

      {paused && (
        <p className="boss-paused-note">This boss is on hold — no penalties accumulate while paused.</p>
      )}

      {!defeated && !paused && (
        <div className="boss-footer">
          <span className="boss-days">{totalCompletions} days in · {boss.currentHP} HP left</span>
          <div className="shield-wrap">
            <button
              className={`habit-shield${completedToday ? ' habit-shield--done' : ''}${checking ? ' habit-shield--checking' : ''}`}
              onClick={handleCheckIn}
              disabled={completedToday || checking}
              aria-label="Complete today's habit"
            >
              <span className="shield-inner">
                {checking ? '…' : completedToday ? '✓' : '🛡'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
