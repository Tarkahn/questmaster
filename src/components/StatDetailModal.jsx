import { xpForStatLevel } from '../utils/statGlossary'

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function StatDetailModal({ stat, history = [], onEdit, onClose }) {
  const lvlStart = xpForStatLevel(stat.level)
  const lvlEnd = xpForStatLevel(stat.level + 1)
  const into = stat.xp - lvlStart
  const needed = lvlEnd - lvlStart
  const pct = needed > 0 ? Math.min(100, Math.round((into / needed) * 100)) : 100

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>

        <div className="stat-detail-header">
          <span className="stat-detail-emoji">{stat.emoji}</span>
          <div className="stat-detail-header-text">
            <h2 className="modal-title">{stat.name}</h2>
            <span className="stat-detail-level">Level {stat.level}</span>
          </div>
        </div>

        <div className="stat-bar-track stat-bar-track--lg">
          <div className="stat-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="stat-detail-xp-label">{into} / {needed} XP to level {stat.level + 1}</div>

        {stat.description && (
          <p className="stat-detail-desc">{stat.description}</p>
        )}

        {history.length > 0 ? (
          <>
            <div className="settings-section-label">Recent contributions</div>
            <div className="stat-detail-history">
              {history.map((entry, i) => (
                <div key={i} className="stat-detail-entry">
                  <span className="stat-detail-entry-title">{entry.title}</span>
                  <div className="stat-detail-entry-meta">
                    <span className="stat-detail-entry-xp">+{entry.xp} XP</span>
                    <span className="stat-detail-entry-date">{formatDate(entry.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="empty" style={{ marginTop: '12px' }}>
            No contributions yet. Complete quests and missions to earn {stat.name} XP.
          </p>
        )}

        <div className="modal-actions">
          {onEdit ? (
            <>
              <button className="modal-btn modal-btn--cancel" onClick={onEdit}>✏️ Edit</button>
              <button className="modal-btn modal-btn--create" onClick={onClose}>Done</button>
            </>
          ) : (
            <button className="modal-btn modal-btn--create" style={{ marginLeft: 'auto' }} onClick={onClose}>Done</button>
          )}
        </div>

      </div>
    </div>
  )
}
