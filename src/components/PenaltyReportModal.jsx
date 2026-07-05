// "The Night's Toll" — the visible surface for the otherwise-passive penalty
// sweep. Shown on app open whenever the day's toll cost the player XP or HP.

export default function PenaltyReportModal({ report, onClose }) {
  if (!report) return null
  const { hpLost = 0, xpLost = 0, lines = [], atZeroXp = false, died = false } = report

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card penalty-report" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">🌙 The Night's Toll</h2>
        <p className="modal-subtitle">
          Time passes, and every unfinished battle exacts its price.
        </p>

        <div className="penalty-totals">
          <div className="penalty-total penalty-total--hp">
            <span className="penalty-total-value">−{hpLost}</span>
            <span className="penalty-total-label">❤️ HP</span>
          </div>
          <div className="penalty-total penalty-total--xp">
            <span className="penalty-total-value">−{xpLost}</span>
            <span className="penalty-total-label">✦ XP</span>
          </div>
        </div>

        {lines.length > 0 && (
          <ul className="penalty-lines">
            {lines.map((l, i) => (
              <li key={i} className="penalty-line">
                <span className="penalty-line-label">{l.icon} {l.label}</span>
                <span className="penalty-line-cost">
                  {l.hp > 0 && <span className="penalty-cost-hp">−{l.hp} ❤️</span>}
                  {l.xp > 0 && <span className="penalty-cost-xp">−{l.xp} ✦</span>}
                </span>
              </li>
            ))}
          </ul>
        )}

        {died && (
          <p className="penalty-flag penalty-flag--death">
            💀 You have fallen! Your equipment is lost — you are reincarnated.
          </p>
        )}
        {atZeroXp && !died && (
          <p className="penalty-flag penalty-flag--rockbottom">
            ⛓ You've hit rock bottom — 0 XP. There is only the climb back up.
          </p>
        )}

        <div className="modal-actions">
          <button className="modal-btn modal-btn--create" onClick={onClose}>
            Steel yourself
          </button>
        </div>
      </div>
    </div>
  )
}
