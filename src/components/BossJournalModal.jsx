export default function BossJournalModal({ defeatedHabits, onReincarnate, onClose }) {
  const sorted = [...defeatedHabits].sort((a, b) =>
    (b.lastCompletedDate || '').localeCompare(a.lastCompletedDate || '')
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal boss-journal-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">📜 Boss Journal</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {sorted.length === 0 ? (
          <p className="boss-journal-empty">No bosses defeated yet. The battle continues…</p>
        ) : (
          <div className="boss-journal-list">
            {sorted.map(habit => (
              <div key={habit.id} className="boss-journal-entry">
                <div className="boss-journal-header">
                  <span className="boss-journal-name">💀 {habit.boss.name}</span>
                  <span className="boss-journal-date">{habit.lastCompletedDate}</span>
                </div>
                <div className="boss-journal-habit">{habit.themedTitle || habit.title}</div>
                {habit.lastNarrative && (
                  <p className="boss-journal-narrative">{habit.lastNarrative}</p>
                )}
                <div className="boss-journal-footer">
                  <span className="boss-journal-strikes">⚔️ {habit.totalCompletions} strikes to vanquish</span>
                  <button
                    className="modal-btn modal-btn--create boss-journal-reincarnate"
                    onClick={() => onReincarnate(habit)}
                  >
                    🔄 Reincarnate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
